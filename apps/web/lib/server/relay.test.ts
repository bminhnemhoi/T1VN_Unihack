import { concat, encodeErrorResult, encodeFunctionData } from 'viem';
import { describe, expect, it } from 'vitest';
import { huiCircleAbi, huiFactoryAbi, erc2771ForwarderAbi } from 'sdk';
import { InvalidTokenError } from './privy';
import {
  CREATE_CIRCLE_PER_HOUR,
  GAS_CAP,
  GAS_CAP_HEAVY,
  RELAY_PER_HOUR,
  createRelayHandler,
  type ForwardRequestData,
  type RelayDeps,
} from './relay';
import { SlidingWindowLimiter } from './ratelimit';

const factory = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const forwarder = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;
const circle = '0xcccccccccccccccccccccccccccccccccccccccc' as const;
const stranger = '0xdddddddddddddddddddddddddddddddddddddddd' as const;
const member = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;
const relayer = '0x9999999999999999999999999999999999999999' as const;
const NOW = 1_800_000_000_000;

type Sim = 'ok' | 'forwarder-failed-call' | 'revert-bid';

interface Harness {
  deps: RelayDeps;
  sent: ForwardRequestData[];
  logs: string[];
  state: { verify: boolean; sim: Sim; balance: bigint; active: number; maxActive: number; globalLimit: number };
}

function harness(): Harness {
  const sent: ForwardRequestData[] = [];
  const logs: string[] = [];
  const state = { verify: true, sim: 'ok' as Sim, balance: 5n * 10n ** 18n, active: 0, maxActive: 0, globalLimit: 1000 };
  const failedCall = encodeErrorResult({ abi: erc2771ForwarderAbi, errorName: 'FailedCall' as never });
  const bidTooHigh = encodeErrorResult({ abi: huiCircleAbi, errorName: 'BidTooHigh', args: [9_000_000n, 6_575_342n] });
  const publicClient = {
    async readContract(args: { functionName: string; args?: readonly unknown[] }) {
      if (args.functionName === 'isCircle') return args.args?.[0] === circle;
      if (args.functionName === 'verify') return state.verify;
      throw new Error('unexpected read');
    },
    async simulateContract() {
      if (state.sim === 'ok') return {};
      throw { data: failedCall };
    },
    async call() {
      if (state.sim === 'revert-bid') throw { cause: { data: bidTooHigh } };
      return {};
    },
    async getBalance() {
      return state.balance;
    },
  } as unknown as RelayDeps['publicClient'];
  const deps: RelayDeps = {
    publicClient,
    factory,
    forwarder,
    sender: {
      address: relayer,
      async execute({ request }) {
        state.active++;
        state.maxActive = Math.max(state.maxActive, state.active);
        await new Promise((r) => setTimeout(r, 5));
        sent.push(request);
        state.active--;
        return `0x${sent.length.toString(16).padStart(64, '0')}`;
      },
    },
    limiter: new SlidingWindowLimiter(RELAY_PER_HOUR, 3_600_000, () => NOW),
    ipLimiter: new SlidingWindowLimiter(1000, 3_600_000, () => NOW),
    globalLimiter: new SlidingWindowLimiter(state.globalLimit, 3_600_000, () => NOW),
    verifier: {
      async verifyToken(token) {
        if (token === 'bad') throw new InvalidTokenError('x');
        return { userId: `did:privy:${token}` };
      },
      async walletOf(userId) {
        return userId === 'did:privy:owner' ? member : stranger;
      },
    },
    createLimiter: new SlidingWindowLimiter(CREATE_CIRCLE_PER_HOUR, 3_600_000, () => NOW),
    now: () => NOW,
    requestId: () => 'req-1',
    log: (_l, m, f) => void logs.push(JSON.stringify({ m, ...f })),
  };
  return { deps, sent, logs, state };
}

const commit = encodeFunctionData({ abi: huiCircleAbi, functionName: 'commitBid', args: [`0x${'11'.repeat(32)}`] });
const settle = encodeFunctionData({ abi: huiCircleAbi, functionName: 'settleRound' });
const pause = encodeFunctionData({ abi: huiCircleAbi, functionName: 'pause' });

const body = (over: { to?: string; data?: string; value?: string; gas?: string; from?: string } = {}) => ({
  request: {
    from: over.from ?? member,
    to: over.to ?? circle,
    value: over.value ?? '0',
    gas: over.gas ?? '500000',
    deadline: NOW / 1000 + 600,
    data: over.data ?? commit,
  },
  signature: `0x${'ab'.repeat(65)}`,
});

const post = (h: (r: Request) => Promise<Response>, b: unknown, headers: Record<string, string> = {}) =>
  h(new Request('http://x/api/relay', { method: 'POST', headers, body: typeof b === 'string' ? b : JSON.stringify(b) }));
const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe('POST /api/relay', () => {
  it('relays an allowed call and returns the tx hash', async () => {
    const t = harness();
    const res = await post(createRelayHandler(t.deps), body());
    expect(res.status).toBe(200);
    expect(((await res.json()) as { txHash: string }).txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]!.from).toBe(member);
  });

  it('rejects malformed bodies', async () => {
    const h = createRelayHandler(harness().deps);
    expect((await post(h, 'nope')).status).toBe(400);
    expect((await post(h, { request: {} })).status).toBe(400);
  });

  it('check 1: target must be the factory or a circle', async () => {
    const res = await post(createRelayHandler(harness().deps), body({ to: stranger }));
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('TargetNotAllowed');
  });

  it('check 2: selector allowlist, per kind of target', async () => {
    const t = harness();
    const h = createRelayHandler(t.deps);
    expect(await code(await post(h, body({ data: pause })))).toBe('SelectorNotAllowed');
    const create = encodeFunctionData({
      abi: huiFactoryAbi,
      functionName: 'createCircle',
      args: [
        {
          mode: 1,
          memberCount: 5,
          contribution: 10_000_000n,
          periodSeconds: 2_592_000,
          roundDuration: 180,
          commitWindow: 90,
          revealWindow: 60,
          graceSeconds: 120,
          alphaBps: 2000,
          commissionMode: true,
          feeBps: 100,
          reserveBps: 100,
          revealBondBps: 100,
          capBps: 2000,
          joinDeadline: 1n,
          organizerIsMember: false,
          label: `0x${'00'.repeat(32)}`,
          commissionShareBps: 0,
          termsHash: `0x${'11'.repeat(32)}`,
        },
      ],
    });
    expect((await post(h, body({ data: create, to: factory }), { authorization: 'Bearer owner' })).status).toBe(200);
    expect(await code(await post(h, body({ data: create })))).toBe('SelectorNotAllowed'); // createCircle on a circle
    expect(await code(await post(h, body({ to: factory })))).toBe('SelectorNotAllowed'); // commitBid on the factory
    for (const fn of ['settleRound', 'finalize', 'cancel'] as const) {
      const data = encodeFunctionData({ abi: huiCircleAbi, functionName: fn });
      expect((await post(h, body({ data }))).status).toBe(200);
    }
    expect(await code(await post(h, body({ data: '0x12345678' })))).toBe('SelectorNotAllowed');
    expect(await code(await post(h, body({ data: '0x' })))).toBe('SelectorNotAllowed');
  });

  it('check 3: value must be zero and gas within 3M, or 5M for settleRound and finalize', async () => {
    const h = createRelayHandler(harness().deps);
    expect(await code(await post(h, body({ value: '1' })))).toBe('ValueNotAllowed');
    expect((await post(h, body({ gas: GAS_CAP.toString() }))).status).toBe(200);
    expect(await code(await post(h, body({ gas: (GAS_CAP + 1n).toString() })))).toBe('GasTooHigh');
    expect((await post(h, body({ data: settle, gas: GAS_CAP_HEAVY.toString() }))).status).toBe(200);
    expect(await code(await post(h, body({ data: settle, gas: (GAS_CAP_HEAVY + 1n).toString() })))).toBe('GasTooHigh');
    expect(await code(await post(h, body({ gas: '0' })))).toBe('GasTooHigh');
  });

  it('check 4: 30 requests per hour per signer, independent across signers', async () => {
    const h = createRelayHandler(harness().deps);
    for (let i = 0; i < RELAY_PER_HOUR; i++) expect((await post(h, body())).status).toBe(200);
    const blocked = await post(h, body());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect((await post(h, body({ from: stranger }))).status).toBe(200);
  });

  it('check 5: forwarder.verify must pass', async () => {
    const t = harness();
    t.state.verify = false;
    const res = await post(createRelayHandler(t.deps), body());
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('InvalidSignature');
    expect(t.sent).toHaveLength(0);
  });

  it('check 6: a reverting call is not sent and the real custom error is decoded', async () => {
    const t = harness();
    t.state.sim = 'revert-bid';
    const res = await post(createRelayHandler(t.deps), body());
    expect(res.status).toBe(422);
    const out = (await res.json()) as { error: { code: string; message: string } };
    expect(out.error.code).toBe('BidTooHigh');
    expect(out.error.message).toContain('6,575342 USDC');
    expect(t.sent).toHaveLength(0);
  });

  it('serialises sends so one relayer nonce is never used twice', async () => {
    const t = harness();
    const h = createRelayHandler(t.deps);
    await Promise.all([1, 2, 3, 4].map(() => post(h, body())));
    expect(t.sent).toHaveLength(4);
    expect(t.state.maxActive).toBe(1);
  });

  it('warns in the log when the relayer holds less than 0.02 AVAX, without leaking signatures', async () => {
    const t = harness();
    t.state.balance = 10n ** 16n; // 0.01 AVAX: above the hard stop, below the warning
    await post(createRelayHandler(t.deps), body());
    await new Promise((r) => setTimeout(r, 10));
    const all = t.logs.join('\n');
    expect(all).toContain('relayer balance below 0.02 AVAX');
    expect(all).not.toContain('abababab');
    expect(all).toContain('"fn":"commitBid"');
  });

  it('concat helper sanity: inner call appends the signer (ERC-2771)', () => {
    expect(concat([commit, member]).endsWith(member.slice(2))).toBe(true);
  });

  it('H-01: invalid signatures do not consume the signer quota', async () => {
    const t = harness();
    const h = createRelayHandler(t.deps);
    t.state.verify = false;
    for (let i = 0; i < RELAY_PER_HOUR + 5; i++) expect((await post(h, body())).status).toBe(400);
    t.state.verify = true;
    expect((await post(h, body())).status).toBe(200);
  });

  it('H-02: createCircle needs a Privy login of the signing wallet, with its own quota', async () => {
    const h = createRelayHandler(harness().deps);
    const create = encodeFunctionData({
      abi: huiFactoryAbi,
      functionName: 'createCircle',
      args: [
        {
          mode: 1,
          memberCount: 5,
          contribution: 10_000_000n,
          periodSeconds: 2_592_000,
          roundDuration: 180,
          commitWindow: 90,
          revealWindow: 60,
          graceSeconds: 120,
          alphaBps: 2000,
          commissionMode: true,
          feeBps: 100,
          reserveBps: 100,
          revealBondBps: 100,
          capBps: 2000,
          joinDeadline: 1n,
          organizerIsMember: false,
          label: `0x${'00'.repeat(32)}`,
          commissionShareBps: 0,
          termsHash: `0x${'11'.repeat(32)}`,
        },
      ],
    });
    const b = () => body({ data: create, to: factory });
    expect((await post(h, b())).status).toBe(401); // no token
    expect((await post(h, b(), { authorization: 'Bearer bad' })).status).toBe(401);
    expect(await code(await post(h, b(), { authorization: 'Bearer someone-else' }))).toBe('WalletMismatch');
    for (let i = 0; i < CREATE_CIRCLE_PER_HOUR; i++) {
      expect((await post(h, b(), { authorization: 'Bearer owner' })).status).toBe(200);
    }
    expect((await post(h, b(), { authorization: 'Bearer owner' })).status).toBe(429);
  });

  it('a global hourly budget and a per-IP limit protect the relayer', async () => {
    const t = harness();
    const small = createRelayHandler({ ...t.deps, globalLimiter: new SlidingWindowLimiter(2, 3_600_000, () => NOW) });
    expect((await post(small, body())).status).toBe(200);
    expect((await post(small, body())).status).toBe(200);
    expect(await code(await post(small, body()))).toBe('RelayBusy');
    const ipOnly = createRelayHandler({ ...t.deps, trustProxy: true, ipLimiter: new SlidingWindowLimiter(1, 3_600_000, () => NOW) });
    expect((await post(ipOnly, body(), { 'x-forwarded-for': '1.2.3.4' })).status).toBe(200);
    expect((await post(ipOnly, body(), { 'x-forwarded-for': '1.2.3.4' })).status).toBe(429);
    expect((await post(ipOnly, body(), { 'x-forwarded-for': '5.6.7.8' })).status).toBe(200);
  });

  it('without TRUST_PROXY junk traffic cannot lock a valid signer out (audit A14 H-01, A15 H-01)', async () => {
    const t = harness();
    const h = createRelayHandler({ ...t.deps, ipLimiter: new SlidingWindowLimiter(1, 3_600_000, () => NOW) });
    for (let i = 0; i < 5; i++) expect((await post(h, '{}', { 'x-forwarded-for': `6.6.6.${i}` })).status).toBe(400);
    expect((await post(h, body(), { 'x-forwarded-for': '1.2.3.4' })).status).toBe(200);
    expect((await post(h, body(), { 'x-forwarded-for': '5.6.7.8' })).status).toBe(200);
  });

  it('junk and invalid signatures do not use the global hourly budget (audit H-01)', async () => {
    const t = harness();
    t.deps.globalLimiter = new SlidingWindowLimiter(1, 3_600_000, () => NOW);
    const h = createRelayHandler(t.deps);
    await post(h, 'nope');
    await post(h, body({ to: stranger }));
    t.state.verify = false;
    expect((await post(h, body())).status).toBe(400);
    t.state.verify = true;
    expect((await post(h, body())).status).toBe(200); // the single unit of budget was still there
    expect((await post(h, body())).status).toBe(503);
  });

  it('refuses to send when the relayer is nearly out of AVAX', async () => {
    const t = harness();
    t.state.balance = 10n ** 15n; // 0.001 AVAX
    const res = await post(createRelayHandler(t.deps), body());
    expect(res.status).toBe(503);
    expect(await code(res)).toBe('RelayUnavailable');
    expect(t.sent).toHaveLength(0);
  });
});
