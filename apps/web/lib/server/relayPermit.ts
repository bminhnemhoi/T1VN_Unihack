/**
 * POST /api/relay/permit core (docs/05 section 8.2b, M-02 option (a)). A member without AVAX signs an EIP-2612 permit
 * for the circle; the relayer pays gas to submit it, so `payLate`/`repayDebt` can pull the allowance they need. The
 * permit authenticates itself by signature, no forwarder is involved. The request is never altered: a tampered permit
 * simply fails the simulation. The relayer key lives only in the injected `sender`.
 *
 * Before the checks: the per-IP limit. Then, in order:
 *   1. `factory.isCircle(spender)`                          4. `now < deadline <= now + 1 hour` (chain time)
 *   2. `owner` joined that circle, which is Active and        5. simulate `USDC.permit`; a revert is accepted only when
 *      where `owner` has debt (the only use of this route)       the allowance is already >= value (nothing is sent)
 *   3. 0 < value <= 2 x requiredAllowance                    6. 10 requests/hour per owner, charged ONLY after step 5
 * then the global hourly budget (shared with /api/relay, charged only for a permit that will be sent, so junk cannot
 * lock honest members out, audit H-01), the hard stop when the relayer is nearly out of AVAX, and the send through
 * the shared nonce mutex.
 */
import { BaseError, HttpRequestError, TimeoutError, type PublicClient } from 'viem';
import { z } from 'zod';
import { decodeError, huiCircleFullAbi, huiFactoryAbi, mockUsdcAbi } from 'sdk';
import { takeIp, errorResponse, jsonResponse, readLimited, type Logger } from './http';
import { HARD_STOP_WEI, LOW_BALANCE_WEI } from './relay';
import type { SlidingWindowLimiter } from './ratelimit';

type Address = `0x${string}`;
type Hex = `0x${string}`;

export const PERMIT_PER_HOUR = 10;
export const PERMIT_MAX_TTL_SEC = 3600;
/** The cap on `value`, in multiples of the circle's `requiredAllowance`. */
export const PERMIT_VALUE_FACTOR = 2n;
const PERMIT_GAS = 150_000n;
const MAX_BODY_BYTES = 4_096;

const ACTIVE = 1;

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const word = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const bodySchema = z.object({
  permit: z.object({
    owner: addr,
    spender: addr,
    value: z.string().regex(/^\d{1,40}$/),
    deadline: z.number().int().positive(),
    v: z.number().int().min(27).max(28),
    r: word,
    s: word,
  }),
});

export interface PermitArgs {
  owner: Address;
  spender: Address;
  value: bigint;
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
}

/** Sends `USDC.permit` as the relayer. The production implementation wraps a viem wallet client. */
export interface PermitSender {
  address: Address;
  permit(args: { usdc: Address; permit: PermitArgs; gas: bigint }): Promise<Hex>;
}

export interface RelayPermitDeps {
  publicClient: Pick<PublicClient, 'readContract' | 'simulateContract' | 'getBalance' | 'getBlock'>;
  factory: Address;
  usdc: Address;
  sender: PermitSender;
  /** Per owner, charged only after the simulation passed. */
  ownerLimiter: SlidingWindowLimiter;
  /** Same instances as /api/relay: one IP budget and one global hourly budget for the relayer's gas. */
  ipLimiter: SlidingWindowLimiter;
  globalLimiter: SlidingWindowLimiter;
  /** Read the client IP from proxy headers (`TRUST_PROXY=true`); default false = one shared bucket. */
  trustProxy?: boolean;
  /** The mutex of /api/relay: one relayer account, one nonce sequence. */
  sendLock: <T>(fn: () => Promise<T>) => Promise<T>;
  requestId: () => string;
  now: () => number;
  log: Logger;
}

/** True when the failure is the RPC transport (network, timeout), not a revert of the contract call. */
function isTransportError(e: unknown): boolean {
  return e instanceof BaseError && e.walk((x) => x instanceof HttpRequestError || x instanceof TimeoutError) !== null;
}

export function createRelayPermitHandler(deps: RelayPermitDeps): (req: Request) => Promise<Response> {
  return async function POST(req: Request): Promise<Response> {
    const requestId = deps.requestId();
    const started = deps.now();
    const fields: Record<string, string | number | boolean> = { requestId };
    const done = (res: Response, outcome: string): Response => {
      deps.log(res.status >= 500 ? 'error' : 'info', 'relay-permit', {
        ...fields,
        outcome,
        status: res.status,
        ms: deps.now() - started,
      });
      return res;
    };
    const chainDown = () => done(errorResponse(502, 'ChainUnavailable', 'Chưa đọc được dữ liệu từ mạng. Hãy thử lại.'), 'chain-error');

    const ip = takeIp(deps.ipLimiter, req, deps.trustProxy);
    if (!ip.ok) {
      return done(
        errorResponse(429, 'RateLimited', 'Bạn gửi quá nhiều yêu cầu. Hãy thử lại sau.', { 'retry-after': String(ip.retryAfterSec) }),
        'ip-limited',
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

    const p = parsed.data.permit;
    const permit: PermitArgs = {
      owner: p.owner as Address,
      spender: p.spender as Address,
      value: BigInt(p.value),
      deadline: BigInt(p.deadline),
      v: p.v,
      r: p.r as Hex,
      s: p.s as Hex,
    };
    fields.owner = permit.owner;
    fields.spender = permit.spender;

    const read = <T,>(address: Address, abi: unknown, functionName: string, args: readonly unknown[] = []): Promise<T> =>
      deps.publicClient.readContract({ address, abi, functionName, args } as never) as Promise<T>;

    // 1. The spender must be a circle the factory created.
    // 2. The owner must be in that circle and the circle must still be Forming or Active.
    // 3. The value must be sane: positive and at most twice what the circle asked for at join.
    let required: bigint;
    try {
      const isCircle = await read<boolean>(deps.factory, huiFactoryAbi, 'isCircle', [permit.spender]);
      if (!isCircle) {
        return done(errorResponse(403, 'TargetNotAllowed', 'Địa chỉ nhận quyền không phải một dây của HụiSafe.'), 'bad-spender');
      }
      const [info, state, requiredAllowance] = await Promise.all([
        read<{ joined: boolean; debt: bigint }>(permit.spender, huiCircleFullAbi, 'memberInfo', [permit.owner]),
        read<number>(permit.spender, huiCircleFullAbi, 'state'),
        read<bigint>(permit.spender, huiCircleFullAbi, 'requiredAllowance'),
      ]);
      if (!info.joined) {
        return done(errorResponse(403, 'NotAMember', 'Ví này không phải thành viên của dây.'), 'not-member');
      }
      // The route exists for payLate/repayDebt, which only an Active circle and a member with an open debt can use.
      if (state !== ACTIVE || info.debt === 0n) {
        return done(errorResponse(409, 'WrongState', 'Chỉ dây đang chạy và thành viên còn khoản thiếu mới cần cấp quyền này.'), 'wrong-state');
      }
      required = requiredAllowance;
    } catch {
      return chainDown();
    }
    if (permit.value <= 0n || permit.value > PERMIT_VALUE_FACTOR * required) {
      return done(errorResponse(400, 'ValueNotAllowed', 'Số tiền cấp quyền không hợp lệ.'), 'value');
    }

    // 4. Deadline within (now, now + 1 hour] on chain time (the token checks block.timestamp, and so does the client).
    let chainNow: bigint;
    try {
      chainNow = (await deps.publicClient.getBlock({ blockTag: 'latest' })).timestamp;
    } catch {
      return chainDown();
    }
    if (permit.deadline <= chainNow || permit.deadline > chainNow + BigInt(PERMIT_MAX_TTL_SEC)) {
      return done(errorResponse(400, 'DeadlineInvalid', 'Hạn của chữ ký không hợp lệ. Hãy ký lại.'), 'deadline');
    }

    // 5. Simulate the permit. A revert is fine only when somebody already sent it (front-run) and the allowance is there.
    try {
      await deps.publicClient.simulateContract({
        account: deps.sender.address,
        address: deps.usdc,
        abi: mockUsdcAbi,
        functionName: 'permit',
        args: [permit.owner, permit.spender, permit.value, permit.deadline, permit.v, permit.r, permit.s],
        gas: PERMIT_GAS,
      });
    } catch (simError) {
      // A node outage says nothing about the signature: do not tell the member to sign again (audit L-03).
      if (isTransportError(simError)) return chainDown();
      let allowance: bigint;
      try {
        allowance = await read<bigint>(deps.usdc, mockUsdcAbi, 'allowance', [permit.owner, permit.spender]);
      } catch {
        return chainDown();
      }
      if (allowance >= permit.value) return done(jsonResponse(200, { skipped: true }), 'already-granted');
      fields.error = decodeError(simError).code;
      return done(
        errorResponse(422, 'InvalidSignature', 'Chữ ký không hợp lệ hoặc đã dùng rồi. Hãy ký lại.'),
        'simulation-reverted',
      );
    }

    // 6. Per-owner quota, only for a permit that would really execute.
    const quota = deps.ownerLimiter.take(permit.owner.toLowerCase());
    if (!quota.ok) {
      return done(
        errorResponse(429, 'RateLimited', 'Bạn gửi quá nhiều yêu cầu. Hãy thử lại sau.', { 'retry-after': String(quota.retryAfterSec) }),
        'rate-limited',
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

    try {
      const balance = await deps.publicClient.getBalance({ address: deps.sender.address });
      if (balance < HARD_STOP_WEI) {
        deps.log('error', 'relayer out of AVAX, refusing to send', { requestId, balanceWei: balance.toString() });
        return done(errorResponse(503, 'RelayUnavailable', 'Dịch vụ miễn phí tạm ngưng. Hãy thử lại sau.'), 'relayer-empty');
      }
    } catch {
      return chainDown();
    }
    try {
      const hash = await deps.sendLock(() => deps.sender.permit({ usdc: deps.usdc, permit, gas: PERMIT_GAS }));
      fields.txHash = hash;
      void deps.publicClient
        .getBalance({ address: deps.sender.address })
        .then((b) => {
          if (b < LOW_BALANCE_WEI) deps.log('warn', 'relayer balance below 0.02 AVAX', { requestId, balanceWei: b.toString() });
        })
        .catch(() => undefined);
      return done(jsonResponse(200, { txHash: hash }), 'sent');
    } catch {
      return done(errorResponse(503, 'RelayUnavailable', 'Chưa gửi được giao dịch. Hãy thử lại sau ít phút.'), 'send-failed');
    }
  };
}
