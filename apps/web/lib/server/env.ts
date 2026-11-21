/**
 * The only place the attest and relay routes read secrets from the environment (docs/04 section 7.4). Secrets
 * (`ATTESTER_PRIVATE_KEY`, `ATTESTATION_ID_SECRET`, `PRIVY_APP_SECRET`, `RELAYER_PRIVATE_KEY`) are read on the server
 * only and never carry a `NEXT_PUBLIC_` prefix. Handlers are built lazily on first request, so `next build` and
 * unit tests never need the variables; a missing variable becomes a 503 that names the variable in the log only.
 */
import { createWalletClient, http, fallback, nonceManager, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { NetworkError, resolveNetwork } from 'config/network';
import { formatUsdc, huiCircleFullAbi, huiFactoryAbi, erc2771ForwarderAbi, mockUsdcAbi } from 'sdk';
import { createAttestHandler, ATTEST_PER_HOUR, type AttestDeps } from './attest';
import { createEntryDebtGuard } from './entryGuard';
import { chainFor, ConfigError, loadDeployment, makePublicClient } from './chain';
import { consoleLogger, errorResponse, makeRequestIdGenerator, trustProxyFrom } from './http';
import { createPrivyVerifier } from './privy';
import { SlidingWindowLimiter } from './ratelimit';
import {
  CREATE_CIRCLE_PER_HOUR,
  GLOBAL_PER_HOUR,
  IP_PER_HOUR,
  RELAY_PER_HOUR,
  createMutex,
  createRelayHandler,
} from './relay';
import { PERMIT_PER_HOUR, createRelayPermitHandler } from './relayPermit';

type Env = Record<string, string | undefined>;
type Handler = (req: Request) => Promise<Response>;

/** The RPC must answer with the chain this process was configured for (audit L-02: no silent wrong-chain reads). */
async function assertChainId(client: { getChainId(): Promise<number> }, expected: number): Promise<void> {
  const actual = await client.getChainId();
  if (actual !== expected) throw new ConfigError(`RPC reports chain ${actual}, expected ${expected}`);
}

function requireVar(env: Env, name: string): string {
  const v = env[name];
  if (!v) throw new ConfigError(`missing environment variable ${name}`);
  return v;
}

function requireKey(env: Env, name: string): Hex {
  const v = requireVar(env, name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) throw new ConfigError(`${name} is not a 32-byte hex key`);
  return v as Hex;
}

export async function buildAttestHandler(env: Env = process.env): Promise<Handler> {
  const network = resolveNetwork(env);
  const deployment = loadDeployment(network);
  const account = privateKeyToAccount(requireKey(env, 'ATTESTER_PRIVATE_KEY'));
  const idSecret = requireVar(env, 'ATTESTATION_ID_SECRET');
  const verifier = createPrivyVerifier(requireVar(env, 'NEXT_PUBLIC_PRIVY_APP_ID'), requireVar(env, 'PRIVY_APP_SECRET'));
  const publicClient = makePublicClient(network);
  await assertChainId(publicClient, network.chainId);

  // The circle only accepts signatures from the attester recorded in the factory config.
  const config = await publicClient.readContract({ address: deployment.factory, abi: huiFactoryAbi, functionName: 'config' });
  if (config.attester.toLowerCase() !== account.address.toLowerCase()) {
    throw new ConfigError('ATTESTER_PRIVATE_KEY does not match the attester of the deployed factory');
  }

  // One index per process, shared by every attest request (member lists of circles past Forming are fixed).
  const debtGuard = createEntryDebtGuard({
    allCircles: () => publicClient.readContract({ address: deployment.factory, abi: huiFactoryAbi, functionName: 'allCircles' }),
    state: async (c) => Number(await publicClient.readContract({ address: c, abi: huiCircleFullAbi, functionName: 'state' })),
    members: (c) => publicClient.readContract({ address: c, abi: huiCircleFullAbi, functionName: 'members' }) as Promise<readonly `0x${string}`[]>,
    memberInfo: (c, w) =>
      publicClient.readContract({ address: c, abi: huiCircleFullAbi, functionName: 'memberInfo', args: [w] }) as Promise<{ defaulted: boolean; debt: bigint }>,
  });

  const deps: AttestDeps = {
    verifier,
    attester: { address: account.address, signTypedData: (args) => account.signTypedData(args) },
    idSecret,
    chainId: network.chainId,
    isCircle: (circle) =>
      publicClient.readContract({ address: deployment.factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [circle] }),
    checkEligibility: async (circle, wallet) => {
      // Cheap reads of this circle first; the debt check only for a request that passed them (audit 21/11 M-02).
      const [mi, params, balance] = await Promise.all([
        publicClient.readContract({ address: circle, abi: huiCircleFullAbi, functionName: 'memberInfo', args: [wallet] }) as Promise<{ joined: boolean }>,
        publicClient.readContract({ address: circle, abi: huiCircleFullAbi, functionName: 'params' }) as Promise<{
          mode: number;
          contribution: bigint;
          revealBondBps: number;
        }>,
        publicClient.readContract({ address: deployment.usdc, abi: mockUsdcAbi, functionName: 'balanceOf', args: [wallet] }) as Promise<bigint>,
      ]);
      if (mi.joined) {
        return { ok: false, status: 409, code: 'AlreadyMember', message: 'Bạn đã ở trong dây này rồi.' };
      }
      const revealBond = Number(params.mode) === 1 ? (BigInt(params.contribution) * BigInt(params.revealBondBps)) / 10_000n : 0n;
      const minNeeded = BigInt(params.contribution) + revealBond;
      if (BigInt(balance) < minNeeded) {
        return {
          ok: false,
          status: 422,
          code: 'InsufficientBalance',
          message: `Ví của bạn hiện có ${formatUsdc(BigInt(balance))}, cần tối thiểu ${formatUsdc(minNeeded)} cho kỳ đầu để vào dây. Hãy nhận USDC thử nghiệm trước.`,
        };
      }
      // Real debt in the wallet's own circles, not the registry counters (docs/05 8.1). Fails closed (audit B28 L-02):
      // a failed or malformed read throws and the route answers 502, never "no defaults".
      const debt = await debtGuard.check(wallet);
      if (debt.kind === 'incomplete') {
        consoleLogger('warn', 'attest debt index incomplete', { unread: debt.unread });
        return {
          ok: false,
          status: 503,
          code: 'EntryCheckUnavailable',
          message: 'Tạm thời chưa kiểm được lịch sử nợ của ví để vào dây. Hãy thử lại sau ít phút.',
        };
      }
      if (debt.kind === 'unpaid') {
        return {
          ok: false,
          status: 422,
          code: 'UnresolvedDefault',
          message: 'Ví này đang có khoản vỡ nợ chưa hoàn trả ở dây trước nên chưa được vào dây mới. Hãy hoàn trả nợ cũ trước.',
        };
      }
      return { ok: true };
    },
    userLimiter: new SlidingWindowLimiter(ATTEST_PER_HOUR),
    ipLimiter: new SlidingWindowLimiter(120),
    trustProxy: trustProxyFrom(env),
    now: Date.now,
    requestId: makeRequestIdGenerator(),
    log: consoleLogger,
  };
  return createAttestHandler(deps);
}

interface RelayShared {
  deployment: ReturnType<typeof loadDeployment>;
  publicClient: ReturnType<typeof makePublicClient>;
  wallet: ReturnType<typeof createWalletClient>;
  address: `0x${string}`;
  ipLimiter: SlidingWindowLimiter;
  globalLimiter: SlidingWindowLimiter;
  trustProxy: boolean;
  sendLock: ReturnType<typeof createMutex>;
}

/**
 * Relayer wallet, chain client, nonce mutex and the IP/global budgets, built once per process and shared by
 * /api/relay and /api/relay/permit: one account pays for both, so one nonce sequence and one gas budget.
 */
const SHARED_KEY = Symbol.for('huisafe.relayShared');
type SharedHolder = { [SHARED_KEY]?: WeakMap<Env, Promise<RelayShared>> };
function relayShared(env: Env): Promise<RelayShared> {
  // Kept on globalThis so the two route bundles of one Node process see ONE mutex and ONE set of budgets (audit L-02).
  const holder = globalThis as SharedHolder;
  const sharedByEnv = (holder[SHARED_KEY] ??= new WeakMap());
  let p = sharedByEnv.get(env);
  if (!p) {
    p = (async (): Promise<RelayShared> => {
      const network = resolveNetwork(env);
      const deployment = loadDeployment(network);
      // nonceManager: the relayer's nonce counter lives in this process, so a flaky RPC fallback cannot hand out a stale one.
      const account = privateKeyToAccount(requireKey(env, 'RELAYER_PRIVATE_KEY'), { nonceManager });
      const publicClient = makePublicClient(network);
      await assertChainId(publicClient, network.chainId);
      const transports = network.rpcUrls.map((u) => http(u));
      const wallet = createWalletClient({
        account,
        chain: chainFor(network),
        transport: transports.length > 1 ? fallback(transports) : transports[0]!,
      });
      const config = await publicClient.readContract({ address: deployment.factory, abi: huiFactoryAbi, functionName: 'config' });
      if (config.forwarder.toLowerCase() !== deployment.forwarder.toLowerCase()) {
        throw new ConfigError('forwarder in the deployment file differs from the factory config');
      }
      return {
        deployment,
        publicClient,
        wallet,
        address: account.address,
        ipLimiter: new SlidingWindowLimiter(IP_PER_HOUR),
        globalLimiter: new SlidingWindowLimiter(GLOBAL_PER_HOUR),
        trustProxy: trustProxyFrom(env),
        sendLock: createMutex(),
      };
    })();
    sharedByEnv.set(env, p);
    p.catch(() => sharedByEnv.delete(env)); // a failed build is retried on the next request
  }
  return p;
}

/** `POST /api/relay/permit` (docs/05 section 8.2b): shares the relayer wallet, nonce mutex and budgets with /api/relay. */
export async function buildRelayPermitHandler(env: Env = process.env): Promise<Handler> {
  const sh = await relayShared(env);
  const { deployment, wallet } = sh;
  return createRelayPermitHandler({
    publicClient: sh.publicClient,
    factory: deployment.factory,
    usdc: deployment.usdc,
    sender: {
      address: sh.address,
      permit: ({ usdc, permit: p, gas }) =>
        wallet.writeContract({
          address: usdc,
          abi: mockUsdcAbi,
          functionName: 'permit',
          args: [p.owner, p.spender, p.value, p.deadline, p.v, p.r, p.s],
          gas,
        } as never),
    },
    ownerLimiter: new SlidingWindowLimiter(PERMIT_PER_HOUR),
    ipLimiter: sh.ipLimiter,
    globalLimiter: sh.globalLimiter,
    trustProxy: sh.trustProxy,
    sendLock: sh.sendLock,
    now: Date.now,
    requestId: makeRequestIdGenerator(),
    log: consoleLogger,
  });
}

export async function buildRelayHandler(env: Env = process.env): Promise<Handler> {
  const sh = await relayShared(env);
  const { deployment, wallet, publicClient } = sh;

  return createRelayHandler({
    publicClient,
    factory: deployment.factory,
    forwarder: deployment.forwarder,
    sender: {
      address: sh.address,
      execute: ({ forwarder, request, gas }) =>
        wallet.writeContract({ address: forwarder, abi: erc2771ForwarderAbi, functionName: 'execute', args: [request], gas } as never),
    },
    limiter: new SlidingWindowLimiter(RELAY_PER_HOUR),
    ipLimiter: sh.ipLimiter,
    globalLimiter: sh.globalLimiter,
    trustProxy: sh.trustProxy,
    sendLock: sh.sendLock,
    verifier: createPrivyVerifier(requireVar(env, 'NEXT_PUBLIC_PRIVY_APP_ID'), requireVar(env, 'PRIVY_APP_SECRET')),
    createLimiter: new SlidingWindowLimiter(CREATE_CIRCLE_PER_HOUR),
    now: Date.now,
    requestId: makeRequestIdGenerator(),
    log: consoleLogger,
  });
}

/** Builds the handler once; configuration problems answer 503 and are retried on the next request. */
export function lazyHandler(build: () => Promise<Handler>, name: string): Handler {
  let cached: Promise<Handler> | undefined;
  return async (req) => {
    let handler: Handler;
    try {
      cached ??= build();
      handler = await cached;
    } catch (e) {
      cached = undefined; // only a failed BUILD is retried; a handler error must not reset limiters or the nonce mutex
      if (e instanceof ConfigError || e instanceof NetworkError) {
        consoleLogger('error', `${name} not configured`, { reason: e.message });
        return errorResponse(503, 'NotConfigured', 'Dịch vụ chưa được cấu hình. Hãy thử lại sau.');
      }
      consoleLogger('error', `${name} failed`, { reason: e instanceof Error ? e.name : 'unknown' });
      return errorResponse(500, 'Internal', 'Có lỗi hệ thống. Hãy thử lại sau.');
    }
    try {
      return await handler(req);
    } catch {
      consoleLogger('error', `${name} failed`, { reason: 'handler error' });
      return errorResponse(500, 'Internal', 'Có lỗi hệ thống. Hãy thử lại sau.');
    }
  };
}
