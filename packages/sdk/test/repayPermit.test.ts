import { privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress, type PublicClient } from 'viem';
import { describe, expect, it } from 'vitest';
import { lateFee } from '../src/huiMath';
import { repayPermitQuote, signRepayPermit } from '../src/repayPermit';
import { permitTypes, usdcPermitDomain } from '../src/typedData';
import type { CircleView, ShortfallView } from '../src/view';

const U = 1_000_000n;
const M = '0x00000000000000000000000000000000000000a4' as const;
const usdc = '0x00000000000000000000000000000000000000bb' as const;
const circle = '0x00000000000000000000000000000000000000cc' as const;

const sf = (round: number, o: Partial<ShortfallView>): ShortfallView => ({
  round,
  member: M,
  amount: 10n * U,
  fromHoldback: 0n,
  fromBond: 0n,
  fromReserve: 0n,
  uncovered: 0n,
  since: 1000,
  resolved: false,
  pausedAtSettle: 0,
  graceEndsAt: 1120,
  ...o,
});

// Demo circle (docs/DE-XUAT-M02 section 2): N = 5, C = 10, reveal bond 0.1, required allowance 40.4, demo timing.
const view = (settledRounds: number, shortfalls: ShortfallView[]): CircleView =>
  ({
    address: circle,
    mode: 'bidding',
    lateRateBps: 1000,
    pausedTotal: 0,
    settledRounds,
    requiredAllowance: 40_400_000n,
    revealBond: 100_000n,
    params: { N: 5, C: 10n * U, periodSeconds: 30 * 86_400, roundDuration: 180 },
    rounds: [1, 2, 3, 4, 5].map((k) => ({ k, shortfalls: shortfalls.filter((s) => s.round === k) })),
  }) as unknown as CircleView;

describe('repayPermitQuote (DE-XUAT-M02 section 2)', () => {
  it('is future contributions plus the debt plus the worst-case late fee', () => {
    // Shortfall in round 2, paid at second 120 of the grace: 3 x (10 + 0.1) + 10 + fee(10, 120 s)
    const v = view(2, [sf(2, { fromBond: 10n * U })]);
    const q = repayPermitQuote(v, M, 1120, { round: 2 });
    const fee = lateFee(10n * U, 1000n, 120n, BigInt(30 * 86_400), 180n);
    expect(fee).toBe(54_794n); // 0.054794 USDC, the doc's figure
    expect(q.quote.total).toBe(10n * U + fee);
    expect(q.futureContributions).toBe(3n * 10_100_000n);
    expect(q.value).toBe(10n * U + fee + 3n * 10_100_000n); // 40.354794: within 2 x 40.4
  });

  it('a fixed-mode circle has no reveal bond to reserve', () => {
    const v = { ...view(2, [sf(2, { fromBond: 10n * U })]), mode: 'fixed' } as CircleView;
    expect(repayPermitQuote(v, M, 1000, { round: 2 }).futureContributions).toBe(3n * 10n * U);
  });

  it('is capped at 2 x requiredAllowance, the ceiling the relay accepts', () => {
    const v = { ...view(1, [sf(1, { fromBond: 10n * U })]), requiredAllowance: 10n * U } as CircleView;
    expect(repayPermitQuote(v, M, 1000, { round: 1 }).value).toBe(20n * U);
  });

  it('repayDebt: only the principal asked for is added to the future contributions', () => {
    const v = view(3, [sf(1, { fromBond: 6n * U }), sf(2, { fromBond: 4n * U })]);
    const q = repayPermitQuote(v, M, 1000, { principal: 6n * U });
    expect(q.quote.principal).toBe(6n * U);
    expect(q.value).toBe(6n * U + q.quote.lateFee + 2n * 10_100_000n);
  });
});

describe('signRepayPermit', () => {
  it('signs an EIP-2612 permit of exactly the quoted value for the circle, recoverable to the member', async () => {
    const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
    const v = view(2, [sf(2, { member: account.address, fromBond: 10n * U })]);
    const publicClient = {
      readContract: async ({ functionName }: { functionName: string }) =>
        functionName === 'name' ? 'USD Coin' : functionName === 'version' ? '2' : 7n,
    } as unknown as PublicClient;
    const ctx = {
      publicClient,
      chainId: 43113,
      signer: {
        address: account.address,
        signTypedData: (a: never) => account.signTypedData(a),
      },
    };
    const out = await signRepayPermit(ctx, usdc, v, 1120, { round: 2 }, 5_000n);
    expect(out.permit.value).toBe(out.value);
    expect(out.owner).toBe(account.address);
    const sig = `0x${out.permit.r.slice(2)}${out.permit.s.slice(2)}${out.permit.v.toString(16)}` as const;
    const recovered = await recoverTypedDataAddress({
      domain: usdcPermitDomain(usdc, 'USD Coin', '2', 43113),
      types: permitTypes,
      primaryType: 'Permit',
      message: { owner: account.address, spender: circle, value: out.value, nonce: 7n, deadline: 5_000n },
      signature: sig,
    });
    expect(recovered).toBe(account.address);
  });
});
