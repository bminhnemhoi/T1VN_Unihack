import { describe, expect, it } from 'vitest';
import { getSampleCircle } from '@/lib/sample-circles';
import { lateImpact } from './lateImpact';

describe('lateImpact (ADR-24)', () => {
  it('sample circle: one late round costs a positive slice of the expected reserve; a clean record has lost nothing', () => {
    const c = getSampleCircle('demo');
    const i = lateImpact(c);
    expect(i.lateCount).toBe(0);
    expect(i.reserveEnd).toBeGreaterThan(0n);
    expect(i.nextLoss).toBeGreaterThan(0n);
    expect(i.thisLoss).toBe(i.nextLoss); // 0 recorded late rounds counts as one for the banner
    expect(i.lostSoFar).toBe(0n);
    expect(i.nextLoss).toBeLessThan(i.reserveEnd / c.terms.n); // never more than an even share
  });
});
