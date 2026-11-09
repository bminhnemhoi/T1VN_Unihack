import { describe, expect, it } from 'vitest';
import type { CircleEvent } from 'sdk';
import { eventsToLines } from './bookLines';

const ev = (eventName: string, args: Record<string, unknown>, timestamp = 100): CircleEvent => ({
  eventName,
  args,
  blockNumber: 1n,
  logIndex: 0,
  txHash: '0xabc',
  timestamp,
});
const name = (a: string) => (a === '0x1' ? 'Thành viên 1' : 'Thành viên 2');

describe('eventsToLines', () => {
  it('maps money events to book lines with the real transaction hash and time', () => {
    const lines = eventsToLines(
      [
        ev('ContributionPulled', { round: 1, member: '0x1', amount: 94_000_000n }),
        ev('ContributionShortfall', { round: 2, member: '0x2', amount: 100_000_000n }),
        ev('ShortfallCovered', { round: 2, member: '0x2', source: 1, amount: 20_000_000n }),
        ev('RoundSettled', { round: 2, winner: '0x1', bid: 3n, pot: 1n, payout: 323_180_000n }),
        ev('MemberDefaulted', { member: '0x2', round: 2, frozen: false }),
        ev('CircleActivated', { startTime: 1n }),
      ],
      name,
    );
    expect(lines.map((l) => l.kind)).toEqual(['Góp', 'Thiếu', 'Bù', 'Hốt', 'Vỡ nợ']);
    expect(lines[2]).toMatchObject({ detail: 'ký quỹ', amount: 20_000_000n, member: 'Thành viên 2', tx: '0xabc', ms: 100_000 });
    expect(lines[3]).toMatchObject({ member: 'Thành viên 1', amount: 323_180_000n });
  });
});
