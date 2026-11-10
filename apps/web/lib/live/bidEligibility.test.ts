import { describe, expect, it } from 'vitest';
import type { CircleView, MemberView } from 'sdk';
import { commitBlocker, eligibilityBlocker, REASON } from './bidEligibility';

const A = (n: number): `0x${string}` => `0x${n.toString(16).padStart(40, '0')}`;

const member = (n: number, over: Partial<MemberView> = {}): MemberView => ({
  address: A(n), joinIndex: n - 1, status: 'live', holdback: 0n, debt: 0n, lateCount: 0,
  reputation: { completed: 0, onTime: 0, late: 0, defaults: 0, repaid: 0 }, ...over,
});

const view = (members: MemberView[], state: CircleView['state'] = 'active'): CircleView => ({ state, members }) as CircleView;

describe('eligibilityBlocker (mirrors HuiCircle._requireEligible)', () => {
  const v = view([member(1), member(2), member(3)]);

  it('lets a live member without debt bid', () => {
    expect(eligibilityBlocker(v, A(1))).toBeUndefined();
    expect(commitBlocker(v, A(1))).toBeUndefined();
  });

  it('asks a logged-out visitor to log in, and a stranger to join', () => {
    expect(eligibilityBlocker(v, undefined)).toBe(REASON.login);
    expect(eligibilityBlocker(v, A(9))).toBe(REASON.notMember);
  });

  it('matches the address case-insensitively', () => {
    expect(eligibilityBlocker(v, A(1).toUpperCase().replace('0X', '0x') as `0x${string}`)).toBeUndefined();
  });

  it('blocks a member who already received, or is frozen', () => {
    for (const status of ['dead', 'frozen', 'defaultedDead'] as const) {
      expect(eligibilityBlocker(view([member(1, { status }), member(2), member(3)]), A(1))).toBe(REASON.notLive);
    }
  });

  it('blocks a live member who still owes a shortfall (docs/03 section 6.1)', () => {
    const owing = view([member(1, { debt: 1n }), member(2), member(3)]);
    expect(eligibilityBlocker(owing, A(1))).toBe(REASON.owes);
    expect(commitBlocker(owing, A(1))).toBe(REASON.owes);
    expect(eligibilityBlocker(owing, A(2))).toBeUndefined();
  });

  it('blocks everything on a paused circle', () => {
    expect(eligibilityBlocker(view([member(1), member(2)], 'paused'), A(1))).toBe(REASON.paused);
  });
});

describe('commitBlocker: the last live member hốt with bid 0', () => {
  const last = view([member(1), member(2, { status: 'dead' }), member(3, { status: 'dead' })]);

  it('blocks the commit of the only live member', () => {
    expect(commitBlocker(last, A(1))).toBe(REASON.soleLive);
  });

  it('does not block a reveal: only commitBid checks the live count', () => {
    expect(eligibilityBlocker(last, A(1))).toBeUndefined();
  });

  it('two live members can both bid', () => {
    const two = view([member(1), member(2), member(3, { status: 'dead' })]);
    expect(commitBlocker(two, A(1))).toBeUndefined();
    expect(commitBlocker(two, A(2))).toBeUndefined();
  });

  it('frozen members do not count as live', () => {
    const v = view([member(1), member(2, { status: 'frozen' }), member(3, { status: 'dead' })]);
    expect(commitBlocker(v, A(1))).toBe(REASON.soleLive);
  });
});
