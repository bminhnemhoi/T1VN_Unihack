import { describe, expect, it } from 'vitest';
import { cascadeRound2, coverage, quoteRound1, ROUND1_BID_CAP } from './landing-demo';

// Expected values are the worked example of docs/03 section 8.
describe('landing demo numbers', () => {
  it('round 1 ceiling is 6,575342 USDC', () => {
    expect(ROUND1_BID_CAP).toBe(6_575_342n);
  });

  it('a bid of 6 pays the winner 288,48 USDC at once', () => {
    const q = quoteRound1('6');
    expect(q).toMatchObject({ ok: true, pot: 376_000_000n, cut: 7_520_000n, holdback: 80_000_000n, payout: 288_480_000n });
  });

  it('accepts a Vietnamese decimal comma and the exact ceiling', () => {
    expect(quoteRound1('6,575342').ok).toBe(true);
  });

  it('refuses a bid above the ceiling and malformed input', () => {
    expect(quoteRound1('6,575343')).toEqual({ ok: false, reason: 'cap' });
    expect(quoteRound1('7')).toEqual({ ok: false, reason: 'cap' });
    expect(quoteRound1('abc')).toEqual({ ok: false, reason: 'format' });
    expect(quoteRound1('1,1234567')).toEqual({ ok: false, reason: 'format' });
  });

  it('round 2: M4 defaults, 80 from holdback + 20 from bond, M1 still gets 323,18', () => {
    const paid = cascadeRound2(false);
    const bad = cascadeRound2(true);
    expect(paid.payout).toBe(323_180_000n);
    expect(bad.payout).toBe(323_180_000n);
    expect(bad.fromHoldback).toBe(80_000_000n);
    expect(bad.fromBond).toBe(20_000_000n);
    expect(bad.bondLeft).toBe(460_000_000n);
    expect(paid.fromBond).toBe(0n);
    expect(bad.pot).toBe(391_000_000n);
  });

  it('coverage: bond 480 on 5 members reaches 100%, 479 does not start on Fuji', () => {
    expect(coverage(5, 480)).toEqual({ bps: 10_000n, canStart: true });
    expect(coverage(5, 479).canStart).toBe(false);
    expect(coverage(5, 0).bps).toBe(2000n);
  });
});
