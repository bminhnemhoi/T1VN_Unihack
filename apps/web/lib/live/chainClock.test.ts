import { describe, expect, it } from 'vitest';
import { advanceChainSec, deriveLivePhase, windowLeftSec } from './chainClock';

describe('chainClock', () => {
  it('tracks chain offset accurately and never double-subtracts elapsed time', () => {
    const offsetMs = 12_000;
    const t0 = 1_800_000_000_000;
    const s0 = advanceChainSec(t0, offsetMs, 0);
    expect(s0).toBe(1_800_000_012);
    const s5 = advanceChainSec(t0 + 5_000, offsetMs, s0);
    expect(s5).toBe(1_800_000_017);
    expect(windowLeftSec(1_800_000_075, s5)).toBe(58);
  });

  it('stays monotonic across minor RPC jitter (<= 5s) so countdowns never jump backwards', () => {
    const prev = 1_800_000_100;
    expect(advanceChainSec(1_800_000_098_000, 0, prev)).toBe(prev);
    expect(advanceChainSec(1_800_000_101_000, 0, prev)).toBe(1_800_000_101);
  });

  it('transitions phases immediately at exact commitEndsAt and revealEndsAt boundaries without waiting for poll', () => {
    const r = { phase: 'commit', commitEndsAt: 1075, revealEndsAt: 1120, deadline: 1120 };
    expect(deriveLivePhase(r, 1074)).toBe('commit');
    expect(deriveLivePhase(r, 1075)).toBe('reveal'); // exact boundary locks commit immediately
    expect(deriveLivePhase(r, 1119)).toBe('reveal');
    expect(deriveLivePhase(r, 1120)).toBe('settle'); // exact boundary locks reveal immediately (prevents NotInRevealWindow)
    expect(deriveLivePhase({ ...r, phase: 'done' }, 1050)).toBe('done');
  });
});
