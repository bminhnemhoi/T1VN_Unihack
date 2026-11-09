import { describe, expect, it } from 'vitest';
import { quoteRepay } from '../src/repay';
import { lateFee } from '../src/huiMath';
import { vndPerRound } from '../src/read';
import type { CircleView, ShortfallView } from '../src/view';

const M = '0x00000000000000000000000000000000000000a4' as const;
const U = 1_000_000n;
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
const view = (shortfalls: ShortfallView[], pausedTotal = 0): CircleView =>
  ({
    lateRateBps: 1000,
    pausedTotal,
    params: { periodSeconds: 30 * 86_400, roundDuration: 180 },
    rounds: [{ k: 1, shortfalls: shortfalls.filter((s) => s.round === 1) }, { k: 2, shortfalls: shortfalls.filter((s) => s.round === 2) }],
  }) as unknown as CircleView;

const fee = (p: bigint, elapsed: bigint) => lateFee(p, 1000n, elapsed, BigInt(30 * 86_400), 180n);

describe('quoteRepay', () => {
  it('payLate: M4 owes 8 (holdback) + 2 (bond), fee charged per part, rounded per part', () => {
    const v = view([sf(2, { fromHoldback: 8n * U, fromBond: 2n * U })]);
    const q = quoteRepay(v, M, 1060, { round: 2 });
    expect(q.principal).toBe(10n * U);
    expect(q.parts.map((p) => p.source)).toEqual(['bond', 'holdback']); // refund order: uncovered, reserve, bond, holdback
    expect(q.lateFee).toBe(fee(2n * U, 60n) + fee(8n * U, 60n));
    expect(q.total).toBe(q.principal + q.lateFee);
  });
  it('pause time after the shortfall does not accrue fees', () => {
    const v = view([sf(1, { fromBond: 10n * U, pausedAtSettle: 0 })], 40);
    expect(quoteRepay(v, M, 1100, { round: 1 }).lateFee).toBe(fee(10n * U, 60n));
  });
  it('repayDebt applies principal oldest round first, uncovered before reserve before bond before holdback', () => {
    const v = view([
      sf(2, { fromBond: 5n * U }),
      sf(1, { uncovered: 3n * U, fromReserve: 4n * U, fromHoldback: 3n * U }),
    ]);
    const q = quoteRepay(v, M, 1000, { principal: 8n * U });
    expect(q.parts.map((p) => `${p.round}:${p.source}:${p.principal / U}`)).toEqual(['1:uncovered:3', '1:reserve:4', '1:holdback:1']);
    expect(q.lateFee).toBe(0n);
  });
  it('without a round or amount it quotes everything open; resolved and other members are ignored', () => {
    const v = view([sf(1, { fromBond: 2n * U }), sf(2, { fromBond: 5n * U, resolved: true }), sf(2, { member: '0x00000000000000000000000000000000000000b1', fromBond: 9n * U })]);
    expect(quoteRepay(v, M, 1000).principal).toBe(2n * U);
    expect(quoteRepay(v, M, 1000, { round: 2 }).total).toBe(0n);
  });
});

describe('vndPerRound', () => {
  it('N x C at the configured rate, 5 x 100 USDC at 26,000', () => {
    expect(vndPerRound(5, 100n * U, 26_000)).toBe(13_000_000);
    expect(vndPerRound(30, 10_000n * U, 26_000)).toBe(7_800_000_000);
  });
});
