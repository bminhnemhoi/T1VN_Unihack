import { describe, expect, it } from 'vitest';
import type { CircleView } from 'sdk';
import { STATE_MAP, toLedger, toSampleCircle, toSampleMembers } from './adapter';

const U = 1_000_000n;
const A = (i: number) => `0x${i.toString(16).padStart(40, '0')}` as const;
const ORG = A(99);

const view = (): CircleView =>
  ({
    address: A(200),
    label: 'Hụi thử',
    state: 'active',
    organizer: ORG,
    currentRound: 3,
    settledRounds: 2,
    params: { N: 3, C: 10n * U, joinDeadline: 0 },
    members: [
      { address: A(1), joinIndex: 0, status: 'dead', receivedRound: 2, holdback: 2n * U, debt: 0n },
      { address: A(2), joinIndex: 1, status: 'live', holdback: 0n, debt: 0n },
      { address: A(3), joinIndex: 2, status: 'defaultedDead', receivedRound: 1, holdback: 0n, debt: 5n * U },
    ],
    rounds: [
      { k: 1, phase: 'done', winner: A(3), bid: 1n * U, payout: 17n * U, shortfalls: [] },
      {
        k: 2,
        phase: 'done',
        winner: A(1),
        bid: 0n,
        payout: 18n * U,
        shortfalls: [{ member: A(3), amount: 10n * U, fromHoldback: 8n * U, fromBond: 2n * U, fromReserve: 0n }],
      },
      { k: 3, phase: 'commit', commitEndsAt: 1090, revealEndsAt: 1150, deadline: 1180, shortfalls: [] },
    ],
  }) as unknown as CircleView;

describe('adapter', () => {
  it('members and the viewer index', () => {
    const { members, viewer } = toSampleMembers(view(), A(2));
    expect(viewer).toBe(1);
    expect(members.map((m) => m.status)).toEqual(['dead', 'live', 'defaultedDead']);
    expect(members[0]!.name).toBe('Thành viên 1');
    expect(members[2]!.note).toContain('USDC');
    expect(toSampleMembers(view(), A(50)).viewer).toBe(-1);
  });

  it('ledger: winner, short and paid cells; later rounds have no cells', () => {
    const l = toLedger(view());
    expect(l[0]).toMatchObject({ k: 1, state: 'settled', winner: 2, bid: 1n * U, payout: 17n * U });
    expect(l[0]!.cells!.map((c) => c.kind)).toEqual(['paid', 'paid', 'won']);
    expect(l[0]!.cells![0]).toEqual({ kind: 'paid', amount: 9n * U }); // C - bid
    expect(l[1]!.cells!.map((c) => c.kind)).toEqual(['won', 'paid', 'short']);
    expect(l[1]!.cells![1]).toEqual({ kind: 'paid', amount: 10n * U }); // bid 0
    expect(l[2]).toEqual({ k: 3, state: 'running' });
  });

  it('circle card: todo, countdown, role and winners', () => {
    const c = toSampleCircle(view(), A(2), 1000);
    expect(c).toMatchObject({ role: 'member', state: 'active', round: 2, n: 3, todo: 'Nộp thăm kín cho kỳ 3', secondsLeft: 90 });
    expect(c.winners).toEqual(['Thành viên 3', 'Thành viên 1']);
    expect(toSampleCircle(view(), ORG, 1000).role).toBe('organizer');
  });
  it('a cancelled or unwound circle is never "completed" (B24, bug 2)', () => {
    expect(STATE_MAP).toEqual({ forming: 'forming', active: 'active', paused: 'active', completed: 'completed', cancelled: 'cancelled', unwound: 'unwound' });
    const cancelled = { ...view(), state: 'cancelled', settledRounds: 0, currentRound: 1, rounds: [], bondRemaining: 480n * U } as unknown as CircleView;
    const mine = toSampleCircle(cancelled, ORG, 1000);
    expect(mine).toMatchObject({ state: 'cancelled', round: 0, role: 'organizer', bondLeft: true, action: 'Rút ký quỹ' });
    expect(mine.todo).toContain('không đủ người trước hạn');
    // a member sees the same fact but has nothing to withdraw
    const member = toSampleCircle(cancelled, A(2), 1000);
    expect(member).toMatchObject({ state: 'cancelled', action: 'Xem dây' });
    expect(member.todo).not.toContain('Rút ký quỹ');
    // bond already withdrawn: no "rút ký quỹ" any more
    const empty = toSampleCircle({ ...cancelled, bondRemaining: 0n } as unknown as CircleView, ORG, 1000);
    expect(empty.bondLeft).toBeUndefined();
    expect(toSampleCircle({ ...cancelled, state: 'unwound' } as unknown as CircleView, ORG, 1000).state).toBe('unwound');
    expect(toSampleCircle({ ...view(), state: 'completed' } as unknown as CircleView, ORG, 1000).state).toBe('completed');
  });
});
