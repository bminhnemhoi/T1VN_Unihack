import { describe, expect, it } from 'vitest';
import { canDelete, hiddenKey, parseHidden, planDelete, withHidden, withoutHidden } from './hidden-circles';

const U = 1_000_000n;

describe('hidden list storage format', () => {
  it('is keyed per wallet, lower case, and per "sample" without a wallet', () => {
    expect(hiddenKey('0xAbC')).toBe('huisafe.hidden.0xabc');
    expect(hiddenKey()).toBe('huisafe.hidden.sample');
  });
  it('reads a stored list and ignores anything malformed (private mode, hand edits)', () => {
    expect(parseHidden(null)).toEqual([]);
    expect(parseHidden('not json')).toEqual([]);
    expect(parseHidden('{"id":"a"}')).toEqual([]);
    expect(parseHidden('[{"id":"a","label":"A"},{"id":3},"x",null]')).toEqual([{ id: 'a', label: 'A' }]);
  });
  it('hides once and unhides by id', () => {
    const a = { id: 'a', label: 'A' };
    expect(withHidden([], a)).toEqual([a]);
    expect(withHidden([a], { id: 'a', label: 'again' })).toEqual([a]);
    expect(withoutHidden([a, { id: 'b', label: 'B' }], 'a')).toEqual([{ id: 'b', label: 'B' }]);
    expect(withoutHidden([a], 'zzz')).toEqual([a]);
  });
});

describe('which rows get "Xóa"', () => {
  it('cancelled and stopped circles, and an expired gathering circle of the organizer', () => {
    expect(canDelete({ state: 'cancelled', role: 'member' })).toBe(true);
    expect(canDelete({ state: 'unwound', role: 'organizer' })).toBe(true);
    expect(canDelete({ state: 'forming', role: 'organizer', expired: true })).toBe(true);
    expect(canDelete({ state: 'forming', role: 'member', expired: true })).toBe(false);
    expect(canDelete({ state: 'forming', role: 'organizer' })).toBe(false);
    expect(canDelete({ state: 'active', role: 'organizer' })).toBe(false);
    expect(canDelete({ state: 'completed', role: 'organizer' })).toBe(false);
  });
});

describe('what deleting does (the four branches of B25)', () => {
  it('organizer of a cancelled circle with bond left: withdraw it (one signature), then hide', () => {
    expect(planDelete({ state: 'cancelled', role: 'organizer', bondUnits: 480n * U })).toEqual({ kind: 'withdraw', bond: 480n * U, signatures: 1 });
  });
  it('organizer of a gathering circle past its deadline, bond left: cancel then withdraw (two signatures)', () => {
    expect(planDelete({ state: 'forming', role: 'organizer', expired: true, bondUnits: 48n * U })).toEqual({ kind: 'cancel-withdraw', bond: 48n * U, signatures: 2 });
  });
  it('nothing to get back: hide only (bond already withdrawn, or never deposited)', () => {
    expect(planDelete({ state: 'cancelled', role: 'organizer', bondUnits: 0n })).toEqual({ kind: 'hide-only', bond: 0n, signatures: 0 });
    expect(planDelete({ state: 'cancelled', role: 'organizer' })).toEqual({ kind: 'hide-only', bond: 0n, signatures: 0 });
    expect(planDelete({ state: 'forming', role: 'organizer', expired: true, bondUnits: 0n }).kind).toBe('hide-only');
  });
  it('a stopped (unwound) circle is a plain hide: withdrawBond() only works on a Cancelled one', () => {
    expect(planDelete({ state: 'unwound', role: 'organizer', bondUnits: 5n * U }).kind).toBe('hide-only');
  });
  it('a member never holds anything in a cancelled circle: hide only, with the allowance tip', () => {
    expect(planDelete({ state: 'cancelled', role: 'member', bondUnits: 480n * U })).toEqual({ kind: 'member', bond: 0n, signatures: 0 });
  });
});
