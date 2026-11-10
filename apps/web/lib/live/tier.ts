/**
 * Badge tier for the SAMPLE screens, through the same SDK rules the chain uses (`memberTier` / `organizerTier`), so there is
 * one definition of the tiers. Chain data does not come through here: `RepBadge` reads `useReputation(address)` instead.
 */
import { memberTier, organizerTier, type TierResult } from 'sdk';
import type { Reputation } from '@/lib/hui-calc';

const MONTH_SEC = 30 * 86_400;

export function sampleTier(rep: Reputation, who: 'member' | 'organizer', nowSec: number): TierResult {
  const since = rep.monthsActive > 0 ? nowSec - rep.monthsActive * MONTH_SEC : undefined;
  const unpaid = rep.defaults > rep.repaid;
  if (who === 'organizer') {
    return organizerTier({
      finishedCircles: rep.completed,
      circlesBondUsedForDefault: rep.bondUsedCircles ?? 0,
      firstCircleAt: since,
      unpaidDefault: unpaid,
      nowSec,
    });
  }
  return memberTier({
    completed: rep.completed,
    onTime: rep.onTime,
    late: rep.late,
    defaults: rep.defaults,
    unpaidDebt: unpaid ? 1n : 0n,
    firstEventAt: since,
    nowSec,
  });
}
