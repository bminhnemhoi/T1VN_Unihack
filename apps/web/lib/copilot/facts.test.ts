import { describe, expect, it } from 'vitest';
import { buildFacts } from './facts';
import { circleDraftSchema, type CircleDraft } from './schemas';

const draft = (over: Partial<CircleDraft> = {}): CircleDraft =>
  circleDraftSchema.parse({
    mode: 'bidding', N: 5, C: '100', periodDays: 30, demoMode: false, alphaBps: 2000, bondUsdc: '480',
    commissionMode: true, feeBps: 300, reserveBps: 100, revealBondBps: 100, capBps: 2000, ...over,
  }); // fmt: skip

type Row = { k: number; maxBidUsdc: string; enforcedMaxBidUsdc?: string; commissionUsdc?: string };

describe('facts with phi (CircleDraft.commissionShareBps, docs/05 section 12.1)', () => {
  it('phi 50%: enforced ceiling and commission per round, total, docs/03 section 8.1', () => {
    const f = buildFacts(draft({ commissionShareBps: 5000 })) as { maxBidByRound: Row[]; commissionSharePercent: string; commissionTotalUsdc: string };
    expect(f.maxBidByRound[0]).toMatchObject({ maxBidUsdc: '6.575342', enforcedMaxBidUsdc: '3.287671', commissionUsdc: '12' });
    expect(f.maxBidByRound[1]).toMatchObject({ enforcedMaxBidUsdc: '2.465753', commissionUsdc: '7.397259' });
    expect(f.commissionSharePercent).toBe('50');
    expect(f.commissionTotalUsdc).toBe('23.506847');
  });
  it('phi missing or 0 leaves the facts as before', () => {
    for (const d of [draft(), draft({ commissionShareBps: 0 })]) {
      const f = buildFacts(d) as { maxBidByRound: Row[] };
      expect(f).not.toHaveProperty('commissionShareBps');
      expect(f.maxBidByRound[0]).toEqual({ k: 1, payers: 4, maxBidUsdc: '6.575342' });
    }
  });
  it('the draft schema refuses phi without a bidding commission circle (InvalidParams 15)', () => {
    const bad = (over: object) => circleDraftSchema.safeParse({ ...draft(), ...over }).success;
    expect(bad({ commissionShareBps: 5000, mode: 'fixed' })).toBe(false);
    expect(bad({ commissionShareBps: 5000, commissionMode: false, feeBps: 0 })).toBe(false);
    expect(bad({ commissionShareBps: 5000, feeBps: 0 })).toBe(false);
    expect(bad({ commissionShareBps: 5001 })).toBe(false);
    expect(bad({ commissionShareBps: 5000 })).toBe(true);
  });
});
