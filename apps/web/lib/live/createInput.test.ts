import { describe, expect, it } from 'vitest';
import { hexToString } from 'viem';
import { DEFAULTS, validateForm } from '@/lib/circleForm';
import { buildCreateInput, circleLabel } from './createInput';

const valid = (over: Partial<typeof DEFAULTS> = {}) => {
  const f = { ...DEFAULTS, bond: '480', ...over };
  const r = validateForm(f);
  if (!r.value) throw new Error(JSON.stringify(r.errors));
  return { f, v: r.value };
};

describe('buildCreateInput', () => {
  it('bidding, real timing: round = period, windows fit, grace under the round', () => {
    const { f, v } = valid();
    const p = buildCreateInput(f, v, { nowSec: 1_000, demo: false });
    expect(p).toMatchObject({ mode: 1, memberCount: 5, contribution: 100_000_000n, periodSeconds: 30 * 86_400, roundDuration: 30 * 86_400, graceSeconds: 172_800, capBps: 2000, alphaBps: 2000, feeBps: Number(DEFAULTS.fee) * 100, commissionShareBps: Number(DEFAULTS.share) * 100, reserveBps: 100, revealBondBps: 100 });
    expect(p.commitWindow).toBeGreaterThanOrEqual(30);
    expect(p.revealWindow).toBeGreaterThanOrEqual(30);
    expect(p.commitWindow + p.revealWindow).toBeLessThanOrEqual(p.roundDuration);
    expect(p.graceSeconds).toBeLessThan(p.roundDuration);
    expect(p.joinDeadline).toBe(BigInt(1_000 + 7 * 86_400));
  });
  it('demo timing is docs/03 section 3.3', () => {
    const { f, v } = valid();
    const p = buildCreateInput(f, v, { nowSec: 0, demo: true });
    expect([p.roundDuration, p.commitWindow, p.revealWindow, p.graceSeconds, p.periodSeconds]).toEqual([120, 75, 45, 60, 30 * 86_400]);
  });
  it('fixed circle has no windows, no cap, no reveal bond', () => {
    const { f, v } = valid({ mode: 'fixed', periodDays: '7' });
    const p = buildCreateInput(f, v, { nowSec: 0, demo: false });
    expect([p.mode, p.commitWindow, p.revealWindow, p.capBps, p.revealBondBps, p.periodSeconds]).toEqual([0, 0, 0, 0, 0, 7 * 86_400]);
  });
  it('no commission means no fee', () => {
    const { f, v } = valid({ commission: false });
    expect(buildCreateInput(f, v, { nowSec: 0, demo: false })).toMatchObject({ commissionMode: false, feeBps: 0 });
  });
  it('phi: the form share goes to the contract and into the agreement hash; 0 where it cannot apply (docs/03 section 2.7)', () => {
    const base = (over = {}) => {
      const { f, v } = valid(over);
      return buildCreateInput(f, v, { nowSec: 0, demo: false });
    };
    expect(base({ share: '30' }).commissionShareBps).toBe(3000);
    expect(base({ share: '0' }).commissionShareBps).toBe(0);
    expect(base({ mode: 'fixed', share: '50' }).commissionShareBps).toBe(0);
    expect(base({ commission: false }).commissionShareBps).toBe(0);
    expect(base({ fee: '0' }).commissionShareBps).toBe(0); // InvalidParams(15): phi needs a fee ceiling above 0
    const a = base({ share: '50' }).termsHash;
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).not.toBe(base({ share: '40' }).termsHash);
    expect(a).toBe(base({ share: '50' }).termsHash); // deterministic
  });
  it('the form rejects a share above 50% or a typo', () => {
    expect(validateForm({ ...DEFAULTS, bond: '480', share: '51' }).errors.share).toMatch(/0% đến 50%/);
    expect(validateForm({ ...DEFAULTS, bond: '480', share: 'abc' }).errors.share).toBeDefined();
    expect(validateForm({ ...DEFAULTS, bond: '480', mode: 'fixed', share: 'abc' }).errors.share).toBeUndefined(); // not used
  });
  it('label is a short public name that fits bytes32', () => {
    const { f, v } = valid({ n: '30', c: '10000' });
    const p = buildCreateInput(f, v, { nowSec: 0, demo: false });
    expect(hexToString(p.label, { size: 32 })).toBe('Dây 30 người, 10000 USDC');
    expect(new TextEncoder().encode(circleLabel(30n, 10_000_000_000n)).length).toBeLessThanOrEqual(31);
  });
});
