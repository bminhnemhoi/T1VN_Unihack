import { describe, expect, it } from 'vitest';
import type { CircleView, RoundView } from 'sdk';
import { viewToCircleData } from './circleData';

const A = (n: number): `0x${string}` => `0x${n.toString(16).padStart(40, '0')}`;
const U = 1_000_000n;
const NOW = 1_800_000_000;

const round = (k: number, over: Partial<RoundView> = {}): RoundView => ({
  k, phase: 'not-started', roundStart: 0, commitEndsAt: 0, revealEndsAt: 0, deadline: NOW + 100, maxBid: 0n, shortfalls: [], ...over,
});

function view(over: Partial<CircleView> = {}): CircleView {
  const members = [1, 2, 3].map((n) => ({
    address: A(n), joinIndex: n - 1, status: 'live' as const, holdback: 0n, debt: 0n, lateCount: 0,
    reputation: { completed: 0, onTime: 0, late: 0, defaults: 0, repaid: 0 },
  }));
  return {
    address: A(99), label: 'Hụi thử', mode: 'bidding', state: 'active', organizer: A(50),
    params: { N: 5, C: 10n * U, periodSeconds: 30 * 86_400, roundDuration: 180, commitWindow: 90, revealWindow: 60, graceSeconds: 120, alphaBps: 2000, commissionMode: true, feeBps: 100, reserveBps: 100, revealBondBps: 100, capBps: 2000, joinDeadline: NOW + 600 },
    startTime: NOW - 400, currentRound: 2, settledRounds: 1, bondRemaining: 48n * U, reserve: 0n, totalHoldback: 0n, pausedTotal: 0, lateRateBps: 1000,
    coverageBps: 10_000, guaranteedCoverageBps: 10_000, requiredAllowance: 0n, ndc19: { perRoundVnd: 0, organizerActiveCircles: 0, mustNotifyCommune: false },
    members,
    rounds: [round(1, { phase: 'done', winner: A(2), bid: 0n, pot: 40n * U, payout: 38n * U, settledAt: NOW - 200 }), round(2, { phase: 'commit', commitEndsAt: NOW + 30, deadline: NOW + 100 })],
    ...over,
  };
}

describe('viewToCircleData', () => {
  it('maps terms, seats (padded to N), winners and the running round', () => {
    const d = viewToCircleData(view(), A(1), NOW * 1000);
    expect(d.terms).toMatchObject({ mode: 'bidding', n: 5n, c: 10n * U, periodDays: 30n, alphaBps: 2000n, feeBps: 100n, capBps: 2000n });
    expect(d.seats.map((s) => s.joined)).toEqual([true, true, true, false, false]);
    expect(d.seats[0]!.name).toBe('Bạn (Thành viên 1)');
    expect(d.seats[3]!.name).toBe('Chỗ trống');
    expect(d.viewer).toBe(0);
    expect(d.winnerByRound).toEqual([1]);
    expect(d.settled).toBe(1);
    expect(d.roundSecondsLeft).toBe(100);
    expect(d.live?.address).toBe(A(99));
  });
  it('a visitor who is not in the circle is viewer -1; the organizer flag follows the wallet', () => {
    expect(viewToCircleData(view(), A(77), NOW * 1000).viewer).toBe(-1);
    expect(viewToCircleData(view(), A(50), NOW * 1000).viewerIsOrganizer).toBe(true);
    expect(viewToCircleData(view(), undefined, NOW * 1000).viewerIsOrganizer).toBe(false);
  });
  it('commission off means feeBps 0; weekly periods stay in whole days', () => {
    const v = view();
    v.params = { ...v.params, commissionMode: false, periodSeconds: 7 * 86_400 };
    expect(viewToCircleData(v, undefined, NOW * 1000).terms).toMatchObject({ feeBps: 0n, periodDays: 7n });
  });
  it('shortfall status: grace while the grace period runs, defaulted after, paid when resolved', () => {
    const sf = (resolved: boolean, graceEndsAt: number) => ({
      round: 1, member: A(3), amount: 10n * U, fromHoldback: 0n, fromBond: 10n * U, fromReserve: 0n, uncovered: 0n,
      since: NOW - 200, resolved, pausedAtSettle: 0, graceEndsAt,
    });
    const at = (s: ReturnType<typeof sf>) => {
      const v = view();
      v.rounds = [round(1, { ...v.rounds[0]!, shortfalls: [s] }), v.rounds[1]!];
      return viewToCircleData(v, A(3), NOW * 1000).shortfalls[0]!;
    };
    expect(at(sf(false, NOW + 60))).toMatchObject({ status: 'grace', graceSecondsLeft: 60, member: 2 });
    expect(at(sf(false, NOW - 1)).status).toBe('defaulted');
    expect(at(sf(true, NOW - 1)).status).toBe('paid');
  });
  it('bond is rebuilt from what remains plus the open bond cover', () => {
    const v = view({ bondRemaining: 38n * U });
    v.rounds = [round(1, { ...v.rounds[0]!, shortfalls: [{ round: 1, member: A(3), amount: 10n * U, fromHoldback: 0n, fromBond: 10n * U, fromReserve: 0n, uncovered: 0n, since: NOW - 200, resolved: false, pausedAtSettle: 0, graceEndsAt: NOW + 5 }] }), v.rounds[1]!];
    expect(viewToCircleData(v, undefined, NOW * 1000).bond).toBe(48n * U);
  });

  it('keeps a paused circle in the active room but flags it paused', () => {
    const d = viewToCircleData(view({ state: 'paused' }), A(1), NOW * 1000);
    expect(d.state).toBe('active');
    expect(d.paused).toBe(true);
  });

  it('does not flag an active circle as paused', () => {
    expect(viewToCircleData(view(), A(1), NOW * 1000).paused).toBeUndefined();
  });
});
