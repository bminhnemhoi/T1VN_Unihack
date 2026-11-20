import { describe, expect, it } from 'vitest';
import { bondUsedThrough, coverOf, getSampleCircle, type SampleCircleData, type SampleShortfall } from '@/lib/sample-circles';

const U = 1_000_000n;
// The Fuji default circle 0xc628...5Bfc after finalize: M4 (seat 3) short 10 in rounds 2-5. Round 2 was covered 8 from his
// holdback + 2 from the bond; finalize wrote the holdback part off, so the "still to restore" fields no longer show it.
const sf = (round: number, covered: SampleShortfall['covered'], left: { h: bigint; b: bigint }): SampleShortfall => ({
  round,
  member: 3,
  amount: 10n * U,
  fromHoldback: left.h,
  fromBond: left.b,
  fromReserve: 0n,
  uncovered: 0n,
  covered,
  status: 'defaulted',
  sinceSeconds: 0,
});
const finalized: SampleCircleData = {
  ...getSampleCircle('demo'),
  state: 'completed',
  bond: 48n * U,
  bondRemaining: 0n,
  shortfalls: [
    sf(2, { holdback: 8n * U, bond: 2n * U, reserve: 0n, uncovered: 0n }, { h: 0n, b: 2n * U }),
    sf(3, { holdback: 0n, bond: 10n * U, reserve: 0n, uncovered: 0n }, { h: 0n, b: 10n * U }),
    sf(4, { holdback: 0n, bond: 10n * U, reserve: 0n, uncovered: 0n }, { h: 0n, b: 10n * U }),
    sf(5, { holdback: 0n, bond: 10n * U, reserve: 0n, uncovered: 0n }, { h: 0n, b: 10n * U }),
  ],
};

describe('history after finalize reads what was covered, not what is left to restore (B28)', () => {
  it('round 2 of M4 still shows 8 from his holdback and 2 from the bond', () => {
    expect(coverOf(finalized.shortfalls[0]!)).toEqual({ holdback: 8n * U, bond: 2n * U, reserve: 0n, uncovered: 0n });
  });
  it('bond left after each round: 48, 46, 36, 26, 16 (the 16 went back to the organizer)', () => {
    expect([1, 2, 3, 4, 5].map((r) => finalized.bond - bondUsedThrough(finalized, r))).toEqual([48n, 46n, 36n, 26n, 16n].map((x) => x * U));
  });
  it('a shortfall paid late gave its bond part back', () => {
    const paid = { ...finalized, shortfalls: [{ ...finalized.shortfalls[0]!, status: 'paid' as const }] };
    expect(bondUsedThrough(paid, 5)).toBe(0n);
  });
  it('without chain history (sample data) the from* fields are the cover', () => {
    const plain: SampleShortfall = { ...finalized.shortfalls[1]!, covered: undefined };
    expect(coverOf(plain).bond).toBe(10n * U);
  });
});
