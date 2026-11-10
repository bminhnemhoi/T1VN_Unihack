/**
 * What being late costs in the end-of-circle reserve split (ADR-24, docs/03 section 5.3 step 5). A rough estimate for the
 * banners: the reserve at the end is guessed from today's reserve plus the premium of the rounds still to come, and everybody
 * else is assumed on time. Pure.
 */
import { lateRewardLoss, reserveEstimate } from '@/lib/hui-calc';
import type { SampleCircleData } from '@/lib/sample-circles';

export interface LateImpact {
  /** Reserve expected at the end of the circle. */
  reserveEnd: bigint;
  /** Late rounds the viewer already has in this circle (the live count; 0 on sample data). */
  lateCount: number;
  /** Extra reward lost by ONE more late round or one unrevealed bid, from the viewer's current standing. */
  nextLoss: bigint;
  /** Reward the most recent late round cost (the one the banner is about; counts one late round on sample data). */
  thisLoss: bigint;
  /** Reward lost by the late rounds the viewer already has, against a clean record. */
  lostSoFar: bigint;
}

export function lateImpact(c: SampleCircleData): LateImpact {
  const view = c.live?.view;
  const me = view && c.viewer >= 0 ? [...view.members].sort((a, b) => a.joinIndex - b.joinIndex)[c.viewer] : undefined;
  const lateCount = me?.lateCount ?? 0;
  const reserveEnd = reserveEstimate(c.terms, c.settled, c.reserve);
  const next = lateRewardLoss(c.terms.n, BigInt(lateCount), reserveEnd);
  const clean = lateRewardLoss(c.terms.n, 0n, reserveEnd).now;
  const latest = lateRewardLoss(c.terms.n, BigInt(Math.max(lateCount, 1) - 1), reserveEnd);
  return { reserveEnd, lateCount, nextLoss: next.loss, thisLoss: latest.loss, lostSoFar: clean - next.now };
}
