import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memorySaltStore, type CircleView, type FetchLike, type ShortfallView } from 'sdk';
import type { ChainConfig } from './config';
import { devWallet } from './wallet';
import { join, payLate, repayDebt, type TxContext } from './write';

// payLate/repayDebt/join read the circle through `readCircle`; give them a fixed demo circle (N = 5, C = 10 USDC).
const mocks = vi.hoisted(() => ({ view: undefined as unknown }));
vi.mock('sdk', async (orig) => ({ ...(await orig<typeof import('sdk')>()), readCircle: async () => mocks.view }));

const U = 1_000_000n;
const CIRCLE = '0x00000000000000000000000000000000000000c1' as const;
const HASH = `0x${'1'.repeat(64)}`;
const PERMIT_HASH = `0x${'2'.repeat(64)}`;
const wallet = devWallet(5, 31337);

const shortfall = (round: number, o: Partial<ShortfallView> = {}): ShortfallView => ({
  round,
  member: wallet.address,
  amount: 10n * U,
  fromHoldback: 0n,
  fromBond: 10n * U,
  fromReserve: 0n,
  uncovered: 0n,
  since: 1_799_999_900,
  resolved: false,
  pausedAtSettle: 0,
  graceEndsAt: 1_800_000_020,
  ...o,
});

beforeEach(() => {
  mocks.view = {
    address: CIRCLE,
    mode: 'bidding',
    lateRateBps: 1000,
    pausedTotal: 0,
    settledRounds: 2,
    requiredAllowance: 40_400_000n,
    revealBond: 100_000n,
    params: { N: 5, C: 10n * U, periodSeconds: 30 * 86_400, roundDuration: 180 },
    rounds: [1, 2, 3, 4, 5].map((k) => ({ k, shortfalls: k === 2 ? [shortfall(2)] : [] })),
  } as unknown as CircleView;
});

type Call = { url: string; body: Record<string, unknown> };

function setup(allowance: bigint, fetchOver?: FetchLike) {
  const calls: Call[] = [];
  const waited: string[] = [];
  const client = {
    async readContract({ functionName }: { functionName: string }) {
      if (functionName === 'allowance') return allowance;
      if (functionName === 'nonces') return 0n;
      if (functionName === 'name') return 'USDC';
      if (functionName === 'version') return '2';
      if (functionName === 'requiredAllowance') return 40_400_000n;
      if (functionName === 'params') return { contribution: 10n * U };
      throw new Error(`unexpected read ${functionName}`);
    },
    async getBlock() {
      return { timestamp: 1_800_000_000n };
    },
    async waitForTransactionReceipt({ hash }: { hash: string }) {
      waited.push(hash);
      return { status: 'success', blockNumber: 7n, gasUsed: 100n, logs: [] };
    },
  };
  const chain = {
    network: 'anvil',
    chainId: 31337,
    factory: '0x00000000000000000000000000000000000000f1',
    registry: '0x00000000000000000000000000000000000000e1',
    usdc: '0x00000000000000000000000000000000000000d1',
    forwarder: '0x00000000000000000000000000000000000000a1',
    fromBlock: 0n,
    vndPerUsdc: 26_000,
    pollMs: 1000,
    client,
  } as unknown as ChainConfig;
  const fetchFn: FetchLike =
    fetchOver ??
    (async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ txHash: url.endsWith('/permit') ? PERMIT_HASH : HASH }), { status: 200 });
    });
  const ctx: TxContext = { chain, wallet, fetchFn, saltStore: memorySaltStore() };
  return { ctx, calls, waited };
}

describe('payLate without approve (M-02)', () => {
  it('allowance too low: signs a permit, relays it, waits for it to be mined, then relays payLate', async () => {
    const { ctx, calls, waited } = setup(10n * U); // far below principal + 3 more contributions
    const r = await payLate(ctx, CIRCLE, 2);
    expect(r.ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(['/api/relay/permit', '/api/relay']);
    const permit = calls[0]!.body.permit as Record<string, unknown>;
    expect(permit).toMatchObject({ owner: wallet.address, spender: CIRCLE, v: expect.any(Number) });
    // 10 principal + fee (a bit over 0.054 for ~620 s of the quote margin) + 3 x (10 + 0.1)
    const value = BigInt(permit.value as string);
    expect(value).toBeGreaterThan(40_300_000n);
    expect(value).toBeLessThanOrEqual(2n * 40_400_000n);
    expect(permit.deadline).toBe(1_800_000_000 + 1800);
    expect(waited).toEqual([PERMIT_HASH, HASH]); // the permit is mined before payLate is sent
  });

  it('allowance already enough: no permit call at all', async () => {
    const { ctx, calls } = setup(100n * U);
    expect((await payLate(ctx, CIRCLE, 2)).ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(['/api/relay']);
  });

  it('a skipped permit (already granted by somebody) still goes on to payLate', async () => {
    const calls: string[] = [];
    const { ctx } = setup(
      1n * U,
      async (url) => {
        calls.push(url);
        return new Response(JSON.stringify(url.endsWith('/permit') ? { skipped: true } : { txHash: HASH }), { status: 200 });
      },
    );
    expect((await payLate(ctx, CIRCLE, 2)).ok).toBe(true);
    expect(calls).toEqual(['/api/relay/permit', '/api/relay']);
  });

  it('a refused permit stops the flow with the server message and sends no payLate', async () => {
    const calls: string[] = [];
    const { ctx } = setup(
      1n * U,
      async (url) => {
        calls.push(url);
        return new Response(JSON.stringify({ error: { code: 'RateLimited', message: 'Bạn gửi quá nhiều yêu cầu.' } }), { status: 429 });
      },
    );
    expect(await payLate(ctx, CIRCLE, 2)).toEqual({ ok: false, code: 'RateLimited', message: 'Bạn gửi quá nhiều yêu cầu.' });
    expect(calls).toEqual(['/api/relay/permit']);
  });

  it('never answers NeedAllowance, and reports a round with no open shortfall', async () => {
    const { ctx, calls } = setup(0n);
    expect(await payLate(ctx, CIRCLE, 3)).toMatchObject({ ok: false, code: 'NoShortfall' });
    expect(calls).toHaveLength(0);
  });
});

describe('repayDebt without approve (M-02)', () => {
  it('permit for the principal asked plus the remaining contributions, then repayDebt', async () => {
    const { ctx, calls } = setup(0n);
    const r = await repayDebt(ctx, CIRCLE, 6n * U);
    expect(r.ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(['/api/relay/permit', '/api/relay']);
    const value = BigInt((calls[0]!.body.permit as { value: string }).value);
    expect(value).toBeGreaterThanOrEqual(6n * U + 3n * 10_100_000n);
    expect(value).toBeLessThan(6n * U + 3n * 10_100_000n + 1n * U);
  });

  it('refuses more than is owed, and zero, without calling anything', async () => {
    const { ctx, calls } = setup(0n);
    expect(await repayDebt(ctx, CIRCLE, 11n * U)).toMatchObject({ ok: false, code: 'RepayTooLarge' });
    expect(await repayDebt(ctx, CIRCLE, 0n)).toMatchObject({ ok: false, code: 'InvalidAmount' });
    expect(calls).toHaveLength(0);
  });
});

describe('join keeps the permit at exactly requiredAllowance', () => {
  it('the circle permits exactly that value, so a larger one would make join revert', async () => {
    const { ctx, calls } = setup(0n, undefined);
    const att = { member: wallet.address, circle: CIRCLE, attestationId: `0x${'3'.repeat(64)}`, expiry: '1800003600' };
    const f: FetchLike = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (url === '/api/attest') return new Response(JSON.stringify({ attestation: att, signature: `0x${'ab'.repeat(65)}` }), { status: 200 });
      return new Response(JSON.stringify({ txHash: HASH }), { status: 200 });
    };
    const r = await join({ ...ctx, fetchFn: f, getAccessToken: async () => 'tok' }, CIRCLE, { ageConfirmed: true });
    expect(r.ok).toBe(true);
    const data = (calls.find((c) => c.url === '/api/relay')!.body.request as { data: string }).data;
    expect(data).toContain((40_400_000n).toString(16).padStart(64, '0')); // requiredAllowance, not + C
    expect(data).not.toContain((50_400_000n).toString(16).padStart(64, '0'));
  });
});
