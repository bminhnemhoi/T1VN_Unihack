/**
 * Reputation badges decided 09/11 (docs/BAO-CAO-LEADER-09-11.md section 6 item 12). Display only: no tier changes any
 * money rule. Pure functions; callers gather the inputs from the registry, `memberInfo` and circle events.
 *
 * Choices where the decision text is silent (flagged in REPORT-A10):
 *  - "Mới" is the base tier for anyone who is not "Tin cậy" yet (so 1 or 2 finished circles are still "Mới").
 *  - "Lâu năm" also requires every "Tin cậy" condition (a stricter, hierarchical reading).
 */
import type { CircleEvent } from './read';

export type Tier = 'new' | 'trusted' | 'veteran';
export const TIER_LABEL_VI: Record<Tier, string> = { new: 'Mới', trusted: 'Tin cậy', veteran: 'Lâu năm' };

export interface TierResult {
  tier: Tier;
  next: { tier: Tier; missing: string[] } | null;
  /** Unpaid default on record. */
  redFlag: boolean;
}

const SIX_MONTHS_SEC = 183 * 86_400;
const MONTH_SEC = 30 * 86_400;

export interface MemberReputationInput {
  completed: number;
  onTime: number;
  late: number;
  defaults: number;
  /** Sum of `memberInfo.debt` over the member's circles. */
  unpaidDebt: bigint;
  /** Timestamp (s) of the member's first event (first `MemberJoined`); undefined when unknown. */
  firstEventAt?: number;
  nowSec: number;
}

const onTimeOk = (onTime: number, late: number): boolean => onTime + late > 0 && onTime * 100 >= 95 * (onTime + late);
const monthsMissing = (firstAt: number | undefined, nowSec: number): number =>
  firstAt === undefined ? 6 : Math.max(0, Math.ceil((firstAt + SIX_MONTHS_SEC - nowSec) / MONTH_SEC));

export function memberTier(i: MemberReputationInput): TierResult {
  const redFlag = i.unpaidDebt > 0n;
  const trustedMissing: string[] = [];
  if (i.completed < 3) trustedMissing.push(`Hoàn thành thêm ${3 - i.completed} dây`);
  if (i.defaults > 0) trustedMissing.push('Chưa từng vỡ nợ (hiện đã có ghi nhận vỡ nợ)');
  if (!onTimeOk(i.onTime, i.late)) trustedMissing.push('Đóng đúng hạn ít nhất 95% số lần');
  const trusted = trustedMissing.length === 0;

  const veteranMissing: string[] = [];
  if (i.completed < 10) veteranMissing.push(`Hoàn thành thêm ${10 - i.completed} dây nữa (đủ 10 dây)`);
  const active = i.firstEventAt !== undefined && i.nowSec - i.firstEventAt >= SIX_MONTHS_SEC;
  if (!active) veteranMissing.push(`Hoạt động đủ 6 tháng (còn ${monthsMissing(i.firstEventAt, i.nowSec)} tháng)`);
  if (i.unpaidDebt > 0n) veteranMissing.push('Trả hết khoản nợ còn lại');

  if (trusted && veteranMissing.length === 0) return { tier: 'veteran', next: null, redFlag };
  if (trusted) return { tier: 'trusted', next: { tier: 'veteran', missing: veteranMissing }, redFlag };
  return { tier: 'new', next: { tier: 'trusted', missing: trustedMissing }, redFlag };
}

export interface OrganizerReputationInput {
  /** Circles that reached `CircleFinalized`. */
  finishedCircles: number;
  /** Of all the organizer's circles, how many had the bond cover a member's default. */
  circlesBondUsedForDefault: number;
  /** Timestamp (s) of the first circle's creation. */
  firstCircleAt?: number;
  /** The organizer's own wallet has an unpaid default. */
  unpaidDefault: boolean;
  nowSec: number;
}

export function organizerTier(i: OrganizerReputationInput): TierResult {
  const redFlag = i.unpaidDefault;
  const trustedMissing: string[] = [];
  if (i.finishedCircles < 3) trustedMissing.push(`Làm xong thêm ${3 - i.finishedCircles} dây`);
  if (i.circlesBondUsedForDefault > 0) trustedMissing.push('Ký quỹ chưa từng phải bù cho người vỡ nợ (hiện đã có)');
  const trusted = trustedMissing.length === 0;

  const veteranMissing: string[] = [];
  if (i.finishedCircles < 10) veteranMissing.push(`Làm xong thêm ${10 - i.finishedCircles} dây nữa (đủ 10 dây)`);
  const active = i.firstCircleAt !== undefined && i.nowSec - i.firstCircleAt >= SIX_MONTHS_SEC;
  if (!active) veteranMissing.push(`Hoạt động đủ 6 tháng (còn ${monthsMissing(i.firstCircleAt, i.nowSec)} tháng)`);

  if (trusted && veteranMissing.length === 0) return { tier: 'veteran', next: null, redFlag };
  if (trusted) return { tier: 'trusted', next: { tier: 'veteran', missing: veteranMissing }, redFlag };
  return { tier: 'new', next: { tier: 'trusted', missing: trustedMissing }, redFlag };
}

/**
 * What one circle contributes to its organizer's standing, from the circle's events: finished when `CircleFinalized`
 * is present; bond used for a default when `ShortfallCovered(source = Bond)` hit a member who also has
 * `MemberDefaulted`. Conservative: a later full repayment does not clear it.
 */
export function summarizeOrganizerCircle(events: CircleEvent[]): { finished: boolean; bondUsedForDefault: boolean } {
  const defaulted = new Set(events.filter((e) => e.eventName === 'MemberDefaulted').map((e) => String(e.args.member).toLowerCase()));
  const BOND = 1; // CoverSource.Bond
  return {
    finished: events.some((e) => e.eventName === 'CircleFinalized'),
    bondUsedForDefault: events.some(
      (e) => e.eventName === 'ShortfallCovered' && Number(e.args.source) === BOND && defaulted.has(String(e.args.member).toLowerCase()),
    ),
  };
}
