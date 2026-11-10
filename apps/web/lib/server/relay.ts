/**
 * POST /api/relay core (docs/05 section 8.2, docs/04 section 7.1). The relayer pays gas for a meta-transaction the
 * member already signed (ERC-2771). The checks run in the documented order and the request is never altered, so a
 * tampered request simply fails `forwarder.verify`. The relayer key lives only in the injected `sender`.
 *
 * Before the checks: a per-IP limit and a global hourly budget (abuse protection that costs nothing to evaluate).
 *   1. `to` is the factory or `factory.isCircle(to)`          4. `forwarder.verify(request)` by eth_call
 *   2. selector is on the allowlist for that target           5. rate limit 30 requests/hour per `from`, charged
 *   3. value == 0 and gas within the cap (3M; 5M for             ONLY for a valid signature (audit H-01)
 *      settleRound and finalize)                              6. `createCircle` needs a Privy login of that wallet
 *                                                             7. simulate `forwarder.execute` by eth_call
 * then a hard stop when the relayer is nearly out of AVAX, and the send, serialised through a mutex so concurrent
 * requests cannot reuse one relayer nonce.
 */
import { concat, getAbiItem, toFunctionSelector, type Abi, type AbiFunction, type PublicClient } from 'viem';
import { z } from 'zod';
import { decodeError, erc2771ForwarderAbi, huiCircleAbi, huiFactoryAbi } from 'sdk';
import { clientIp, errorResponse, jsonResponse, readLimited, type Logger } from './http';
import { InvalidTokenError, NoWalletError, type PrivyVerifier } from './privy';
import type { SlidingWindowLimiter } from './ratelimit';

type Address = `0x${string}`;
type Hex = `0x${string}`;

export const RELAY_PER_HOUR = 30;
export const GAS_CAP = 3_000_000n;
export const GAS_CAP_HEAVY = 5_000_000n;
export const LOW_BALANCE_WEI = 2n * 10n ** 16n; // 0.02 AVAX: warn
export const HARD_STOP_WEI = 5n * 10n ** 15n; // 0.005 AVAX: refuse to send, the relayer cannot pay for gas anyway
export const IP_PER_HOUR = 300;
export const GLOBAL_PER_HOUR = 1500;
export const CREATE_CIRCLE_PER_HOUR = 5;
const MAX_BODY_BYTES = 24_576;

const selectorOf = (abi: Abi, name: string): Hex => toFunctionSelector(getAbiItem({ abi, name }) as AbiFunction);

/** Functions a member may relay to a circle (docs/05 section 8.2). `pause`, `unpause`, `emergencyUnwind`: never. */
const CIRCLE_USER = [
  'depositBond',
  'withdrawBond',
  'join',
  'leave',
  'activate',
  'commitBid',
  'revealBid',
  'payLate',
  'repayDebt',
  'claim',
] as const;
/** Anyone-can-call functions, relayed so the "Chốt kỳ" button works for free when the keeper is slow. */
const CIRCLE_PUBLIC = ['settleRound', 'markDefault', 'finalize', 'cancel'] as const;

export const CIRCLE_SELECTORS: ReadonlyMap<Hex, string> = new Map(
  [...CIRCLE_USER, ...CIRCLE_PUBLIC].map((n) => [selectorOf(huiCircleAbi, n), n]),
);
export const FACTORY_SELECTORS: ReadonlyMap<Hex, string> = new Map([[selectorOf(huiFactoryAbi, 'createCircle'), 'createCircle']]);
const HEAVY = new Set(['settleRound', 'finalize']);

const hex = z.string().regex(/^0x([0-9a-fA-F]{2})*$/);
const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bodySchema = z.object({
  request: z.object({
    from: addr,
    to: addr,
    value: z.string().regex(/^\d+$/),
    gas: z.string().regex(/^\d{1,18}$/),
    deadline: z.number().int().positive(),
    data: hex,
  }),
  signature: hex,
});

/** Sends transactions as the relayer. The production implementation wraps a viem wallet client. */
export interface RelaySender {
  address: Address;
  /** Submits `forwarder.execute(request)` with the given gas limit and returns the transaction hash. */
  execute(args: { forwarder: Address; request: ForwardRequestData; gas: bigint }): Promise<Hex>;
}

export interface ForwardRequestData {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  deadline: number;
  data: Hex;
  signature: Hex;
}

export interface RelayDeps {
  publicClient: Pick<PublicClient, 'readContract' | 'simulateContract' | 'call' | 'getBalance'>;
  factory: Address;
  forwarder: Address;
  sender: RelaySender;
  /** Per signer, charged only after `forwarder.verify` passes. */
  limiter: SlidingWindowLimiter;
  /** Per client IP, charged before anything else. */
  ipLimiter: SlidingWindowLimiter;
  /** Every relayed request, all signers together: caps what the relayer can be made to spend per hour. */
  globalLimiter: SlidingWindowLimiter;
  /** `createCircle` is open to any wallet, so it needs a Privy login of the same wallet and its own small quota. */
  verifier: PrivyVerifier;
  createLimiter: SlidingWindowLimiter;
  /** Optional shared send lock, so /api/relay/permit and /api/relay never reuse one relayer nonce. */
  sendLock?: <T>(fn: () => Promise<T>) => Promise<T>;
  now: () => number;
  requestId: () => string;
  log: Logger;
}

/** Serialises the send step: one relayer account, one nonce sequence. Shared with /api/relay/permit. */
export function createMutex(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}

export function createRelayHandler(deps: RelayDeps): (req: Request) => Promise<Response> {
  const sendLock = deps.sendLock ?? createMutex();

  return async function POST(req: Request): Promise<Response> {
    const requestId = deps.requestId();
    const started = deps.now();
    const fields: Record<string, string | number | boolean> = { requestId };
    const done = (res: Response, outcome: string): Response => {
      deps.log(res.status >= 500 ? 'error' : 'info', 'relay', {
        ...fields,
        outcome,
        status: res.status,
        ms: deps.now() - started,
      });
      return res;
    };

    const ip = deps.ipLimiter.take(clientIp(req));
    if (!ip.ok) {
      return done(
        errorResponse(429, 'RateLimited', 'Bạn gửi quá nhiều yêu cầu. Hãy thử lại sau.', {
          'retry-after': String(ip.retryAfterSec),
        }),
        'ip-limited',
      );
    }
    const budget = deps.globalLimiter.take('all');
    if (!budget.ok) {
      return done(
        errorResponse(503, 'RelayBusy', 'Dịch vụ miễn phí đang quá tải. Hãy thử lại sau ít phút.', {
          'retry-after': String(budget.retryAfterSec),
        }),
        'global-budget',
      );
    }

    const raw = await readLimited(req, MAX_BODY_BYTES).catch(() => null);
    if (raw === null) return done(errorResponse(413, 'TooLarge', 'Yêu cầu quá lớn.'), 'too-large');
    let parsed;
    try {
      parsed = bodySchema.safeParse(JSON.parse(raw));
    } catch {
      parsed = undefined;
    }
    if (!parsed?.success) return done(errorResponse(400, 'BadRequest', 'Yêu cầu không hợp lệ.'), 'bad-body');

    const r = parsed.data.request;
    const request: ForwardRequestData = {
      from: r.from as Address,
      to: r.to as Address,
      value: BigInt(r.value),
      gas: BigInt(r.gas),
      deadline: r.deadline,
      data: r.data as Hex,
      signature: parsed.data.signature as Hex,
    };
    const selector = (request.data.length >= 10 ? request.data.slice(0, 10).toLowerCase() : '0x') as Hex;
    fields.from = request.from;
    fields.to = request.to;
    fields.selector = selector;
    fields.gas = Number(request.gas);

    // 1. Target must be the factory or a circle the factory created.
    let allowed: ReadonlyMap<Hex, string>;
    try {
      if (request.to.toLowerCase() === deps.factory.toLowerCase()) {
        allowed = FACTORY_SELECTORS;
      } else {
        const isCircle = await deps.publicClient.readContract({
          address: deps.factory,
          abi: huiFactoryAbi,
          functionName: 'isCircle',
          args: [request.to],
        });
        if (!isCircle) {
          return done(errorResponse(403, 'TargetNotAllowed', 'Địa chỉ đích không phải một dây của HụiSafe.'), 'bad-target');
        }
        allowed = CIRCLE_SELECTORS;
      }
    } catch {
      return done(errorResponse(502, 'ChainUnavailable', 'Chưa đọc được dữ liệu từ mạng. Hãy thử lại.'), 'chain-error');
    }

    // 2. Selector allowlist for that kind of target.
    const fn = allowed.get(selector);
    if (!fn) return done(errorResponse(403, 'SelectorNotAllowed', 'Thao tác này không được gửi qua dịch vụ miễn phí.'), 'bad-selector');
    fields.fn = fn;

    // 3. No value; gas within the cap.
    if (request.value !== 0n) return done(errorResponse(400, 'ValueNotAllowed', 'Yêu cầu không được kèm tiền.'), 'value');
    const cap = HEAVY.has(fn) ? GAS_CAP_HEAVY : GAS_CAP;
    if (request.gas === 0n || request.gas > cap) {
      return done(errorResponse(400, 'GasTooHigh', `Mức gas vượt trần ${cap.toString()}.`), 'gas');
    }

    // 4. The forwarder accepts the signature, nonce and deadline.
    let valid: boolean;
    try {
      valid = await deps.publicClient.readContract({
        address: deps.forwarder,
        abi: erc2771ForwarderAbi,
        functionName: 'verify',
        args: [request],
      });
    } catch {
      return done(errorResponse(502, 'ChainUnavailable', 'Chưa đọc được dữ liệu từ mạng. Hãy thử lại.'), 'chain-error');
    }
    if (!valid) {
      return done(
        errorResponse(400, 'InvalidSignature', 'Chữ ký không hợp lệ hoặc yêu cầu đã hết hạn. Hãy ký lại.'),
        'verify-failed',
      );
    }

    // 5. Per-signer quota, charged only for a valid signature: an attacker cannot burn a victim's quota with junk.
    const limit = deps.limiter.take(request.from.toLowerCase());
    if (!limit.ok) {
      return done(
        errorResponse(429, 'RateLimited', 'Bạn gửi quá nhiều yêu cầu. Hãy thử lại sau.', {
          'retry-after': String(limit.retryAfterSec),
        }),
        'rate-limited',
      );
    }

    // 6. Creating a circle is open to everyone and each clone is costly: require a Privy login of the same wallet.
    if (fn === 'createCircle') {
      const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
      if (!token) return done(errorResponse(401, 'Unauthorized', 'Cần đăng nhập để tạo dây qua dịch vụ miễn phí.'), 'create-no-token');
      try {
        const { userId } = await deps.verifier.verifyToken(token);
        const quota = deps.createLimiter.take(userId);
        if (!quota.ok) {
          return done(
            errorResponse(429, 'RateLimited', 'Bạn tạo dây quá nhiều lần. Hãy thử lại sau.', {
              'retry-after': String(quota.retryAfterSec),
            }),
            'create-limited',
          );
        }
        const wallet = await deps.verifier.walletOf(userId);
        if (wallet.toLowerCase() !== request.from.toLowerCase()) {
          return done(errorResponse(403, 'WalletMismatch', 'Ví ký không phải ví của tài khoản đang đăng nhập.'), 'create-wallet-mismatch');
        }
      } catch (e) {
        if (e instanceof InvalidTokenError) {
          return done(errorResponse(401, 'Unauthorized', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'), 'create-bad-token');
        }
        if (e instanceof NoWalletError) {
          return done(errorResponse(409, 'NoWallet', 'Tài khoản chưa có ví.'), 'create-no-wallet');
        }
        return done(errorResponse(502, 'AuthUnavailable', 'Chưa xác minh được đăng nhập. Hãy thử lại.'), 'create-auth-error');
      }
    }

    // 7. Simulate the whole execute. The forwarder hides the inner revert (it only reports FailedCall), so on failure
    // replay the inner call as the forwarder would (sender appended, ERC-2771) to decode the real custom error.
    const gasLimit = request.gas + request.gas / 32n + 200_000n;
    try {
      await deps.publicClient.simulateContract({
        account: deps.sender.address,
        address: deps.forwarder,
        abi: erc2771ForwarderAbi,
        functionName: 'execute',
        args: [request],
        gas: gasLimit,
      });
    } catch (simError) {
      let decoded = decodeError(simError);
      if (decoded.code === 'Unknown' || decoded.code === 'FailedCall') {
        try {
          await deps.publicClient.call({
            account: deps.forwarder,
            to: request.to,
            data: concat([request.data, request.from]),
            gas: request.gas,
          });
        } catch (innerError) {
          decoded = decodeError(innerError);
        }
      }
      fields.error = decoded.code;
      return done(errorResponse(422, decoded.code, decoded.message), 'simulation-reverted');
    }

    // Hard stop when the relayer cannot pay for gas; warn (log only) below 0.02 AVAX after a send.
    try {
      const balance = await deps.publicClient.getBalance({ address: deps.sender.address });
      if (balance < HARD_STOP_WEI) {
        deps.log('error', 'relayer out of AVAX, refusing to send', { requestId, balanceWei: balance.toString() });
        return done(errorResponse(503, 'RelayUnavailable', 'Dịch vụ miễn phí tạm ngưng. Hãy thử lại sau.'), 'relayer-empty');
      }
    } catch {
      return done(errorResponse(502, 'ChainUnavailable', 'Chưa đọc được dữ liệu từ mạng. Hãy thử lại.'), 'chain-error');
    }
    try {
      const hash = await sendLock(() => deps.sender.execute({ forwarder: deps.forwarder, request, gas: gasLimit }));
      fields.txHash = hash;
      void deps.publicClient
        .getBalance({ address: deps.sender.address })
        .then((b) => {
          if (b < LOW_BALANCE_WEI) deps.log('warn', 'relayer balance below 0.02 AVAX', { requestId, balanceWei: b.toString() });
        })
        .catch(() => undefined);
      return done(jsonResponse(200, { txHash: hash }), 'sent');
    } catch (sendError) {
      const decoded = decodeError(sendError);
      if (decoded.code !== 'Unknown') return done(errorResponse(422, decoded.code, decoded.message), 'send-reverted');
      return done(errorResponse(503, 'RelayUnavailable', 'Chưa gửi được giao dịch. Hãy thử lại sau ít phút.'), 'send-failed');
    }
  };
}
