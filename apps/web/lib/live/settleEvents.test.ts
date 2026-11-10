import { describe, expect, it } from 'vitest';
import type { CircleEvent } from 'sdk';
import { eventsToLines } from './bookLines';
import { settleFromEvents } from './settleEvents';

const U = 1_000_000n;
const M = ['0xa1', '0xa2', '0xa3', '0xa4', '0xa5'];
let n = 0;
const ev = (eventName: string, args: Record<string, unknown>): CircleEvent => ({ eventName, args, blockNumber: BigInt(++n), logIndex: 0, txHash: `0x${n}` });

/** docs/03 section 8 branch A start: round 1 M4 wins with bid 6, round 2 M1 wins with bid 3 (vector V6: 6, 9, 9, 0, 9). */
const events: CircleEvent[] = [
  ...[0, 1, 2, 4].map((i) => ev('ContributionPulled', { round: 1, member: M[i], amount: 94n * U })),
  ev('FeePaid', { round: 1, organizer: '0xorg', amount: 3_760_000n }),
  ev('RoundSettled', { round: 1, winner: M[3], bid: 6n * U, pot: 376n * U, payout: 288_480_000n, holdback: 80n * U, fee: 3_760_000n, premium: 3_760_000n, uncovered: 0n }),
  ...[1, 2, 4].map((i) => ev('ContributionPulled', { round: 2, member: M[i], amount: 97n * U })),
  ev('ContributionPulled', { round: 2, member: M[3], amount: 100n * U }),
  ev('RoundSettled', { round: 2, winner: M[0], bid: 3n * U, pot: 391n * U, payout: 323_180_000n, holdback: 60n * U, fee: 0n, premium: 3_910_000n, uncovered: 0n }),
  ev('HoldbackReleased', { member: M[3], round: 2, amount: 20n * U }),
  ev('ReserveShared', { member: M[0], amount: 4_146_821n, weight: 4 }),
  ev('ReserveShared', { member: M[3], amount: 3_110_115n, weight: 3 }),
  ev('CircleFinalized', { bondReturned: 480n * U, feesPaid: 3_910_000n, reserveDistributed: 19_697_396n }),
];

describe('settleFromEvents (vector V6)', () => {
  const s = settleFromEvents(events, 100n * U, M);
  it('interest received per member is 6, 9, 9, 0, 9', () => {
    expect(s.members.map((m) => m.interestReceived / U)).toEqual([6n, 9n, 9n, 0n, 9n]);
    expect(s.members.reduce((a, m) => a + m.interestReceived, 0n)).toBe(33n * U);
  });
  it('interest paid is the discount the others got in the round the member won: 24 (M4), 9 (M1)', () => {
    expect(s.members[3]!.interestPaid).toBe(24n * U);
    expect(s.members[0]!.interestPaid).toBe(9n * U);
    expect(s.members[1]!.interestPaid).toBe(0n);
  });
  it('on-time reward and its weight come from ReserveShared', () => {
    expect(s.members[0]!.reward).toBe(4_146_821n);
    expect(s.members[3]!).toMatchObject({ reward: 3_110_115n, weight: 3 });
  });
  it('organizer: commission paid at once and the part that waited for finalize', () => {
    expect(s.organizer).toMatchObject({ feePaidNow: 3_760_000n, feeAtFinalize: 3_910_000n, bondReturned: 480n * U });
    expect(s.finalized).toBe(true);
    expect(s.reserveTotal).toBe(19_697_396n);
  });
  it('net = received + holdback back + reward - paid', () => {
    const m4 = s.members[3]!;
    expect(m4.net).toBe(288_480_000n + 20n * U + 3_110_115n - 100n * U);
  });
});

describe('book lines for v1.2 events', () => {
  const lines = eventsToLines(events, (a) => a, { organizer: '0xorg', commission: true });
  it('FeePaid and ReserveShared have their own lines', () => {
    expect(lines.find((l) => l.kind === 'Hoa hồng')).toMatchObject({ round: 1, amount: 3_760_000n, detail: 'trả ngay lúc chi kỳ' });
    expect(lines.filter((l) => l.kind === 'Thưởng đúng hạn')).toHaveLength(2);
  });
  it('the round the organizer took the pot says no commission', () => {
    const own = eventsToLines([ev('RoundSettled', { round: 2, winner: '0xORG', bid: 0n, pot: 1n, payout: 1n, holdback: 0n, fee: 0n, premium: 0n, uncovered: 0n })], (a) => a, { organizer: '0xorg', commission: true });
    expect(own[0]!.detail).toContain('không thu hoa hồng');
    const other = eventsToLines([ev('RoundSettled', { round: 2, winner: '0xa1', bid: 0n, pot: 1n, payout: 1n, holdback: 0n, fee: 0n, premium: 0n, uncovered: 0n })], (a) => a, { organizer: '0xorg', commission: true });
    expect(other[0]!.detail).toBe('thực nhận');
  });
});
