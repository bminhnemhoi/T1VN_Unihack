/**
 * Pure calculations behind the B8 screens: round split, bid calculator, fairness meter, maximum-risk table, settlement,
 * reputation tiers. Everything is `bigint` USDC base units and goes through `huiMath` (docs/03 section 2), so a number
 * on screen is the same number the contract would compute. No I/O, no randomness (CLAUDE.md hard rule 3).
 */
import { huiMath } from 'sdk';

const { bpsOf, holdbackFor, releasePerRound, maxBid, bidCapAfterShare, commissionRoom, commission, reserveShare, onTimeWeight } = huiMath;
const BPS = 10_000n;
const DAY = 86_400n;

export interface Terms {
  mode: 'bidding' | 'fixed';
  n: bigint;
  /** Contribution C per round. */
  c: bigint;
  periodDays: bigint;
  alphaBps: bigint;
  /** 0 when the circle has no commission. With `shareBps > 0` it is the ceiling of each pot (docs/03 section 2.7). */
  feeBps: bigint;
  reserveBps: bigint;
  capBps: bigint;
  /** phi (docs/03 section 2.7): share of the interest room the organizer takes as commission, 0..5000. Missing = 0 (fixed fee). */
  shareBps?: bigint;
}

const shareOf = (t: Terms): bigint => (t.mode === 'bidding' && t.feeBps > 0n ? (t.shareBps ?? 0n) : 0n);

/** Bid ceiling set by the law (docs/03 section 2.4), nobody frozen. Fixed circles have no bids. */
export function statutoryCapOf(t: Terms, k: number): bigint {
  if (t.mode === 'fixed') return 0n;
  const kk = BigInt(k);
  return maxBid(t.capBps, t.n, kk, t.c, t.periodDays * DAY, t.n - kk);
}

/** Bid ceiling the contract enforces: the legal one minus the commission share (docs/03 section 2.7). */
export function capOf(t: Terms, k: number): bigint {
  return bidCapAfterShare(statutoryCapOf(t, k), shareOf(t));
}

/** room_k: the most interest the law lets the winner of round k pay, with nobody frozen (L_k = n - k). */
export function roomOf(t: Terms, k: number): bigint {
  return commissionRoom(statutoryCapOf(t, k), t.n - BigInt(k));
}

/** Organizer commission of round k for a pot (docs/03 sections 2.6, 2.7). Zero when the organizer himself takes the pot. */
export function feeOf(t: Terms, k: number, pot: bigint, organizerWins = false): bigint {
  if (organizerWins || t.feeBps === 0n) return 0n;
  return commission(pot, t.feeBps, shareOf(t), roomOf(t, k));
}

export interface RoundSplit {
  /** Live members other than the winner, each paying C - bid. */
  livePayers: number;
  /** Members who already received, each paying C. */
  deadPayers: number;
  pot: bigint;
  fee: bigint;
  premium: bigint;
  holdback: bigint;
  payout: bigint;
}

/**
 * Split of the pot of round k when every shortfall is covered (docs/03 section 6.5): pot = (n-k)(C-b) + (k-1)C,
 * then fee, reserve premium and holdback come off the top. `uncovered` shrinks the pot (docs/03 section 6.5 step 5).
 * `organizerWins`: the organizer's own seat takes this pot, so no commission (docs/03 section 6.5 step 6).
 */
export function roundSplit(t: Terms, k: number, bid: bigint, uncovered = 0n, organizerWins = false): RoundSplit {
  const kk = BigInt(k);
  const live = t.n - kk;
  const dead = kk - 1n;
  const pot = live * (t.c - bid) + dead * t.c - uncovered;
  const fee = feeOf(t, k, pot, organizerWins);
  const premium = bpsOf(pot, t.reserveBps);
  const free = pot - fee - premium;
  const want = holdbackFor(t.alphaBps, t.n, kk, t.c);
  const holdback = want < free ? want : free;
  return { livePayers: Number(live), deadPayers: Number(dead), pot, fee, premium, holdback, payout: free - holdback };
}

export interface BidQuote extends RoundSplit {
  k: number;
  bid: bigint;
  /** Ceiling the contract enforces (already minus the commission share). */
  cap: bigint;
  /** Ceiling set by the law, before the commission share. Equal to `cap` when phi = 0. */
  statutoryCap: bigint;
  /** Why the bid is not allowed, or undefined when it is. */
  problem?: 'over-cap' | 'at-least-c';
  /** Interest the winner pays through the discount the others get: bid x live payers. */
  interest: bigint;
  /** The holdback comes back in this many equal-ish instalments (one per later on-time round), last one may be smaller. */
  releaseEach: bigint;
  /** What the winner still pays in later rounds: (n-k) x C. */
  laterPayments: bigint;
  /** Interest as a monthly rate by the cap's own yardstick (docs/03 section 2.4): cost / (D x T), D = (n-k)C, T in months. */
  interestRateBpsPerMonth?: bigint;
  /** Same, adding the commission and the reserve premium. Undefined when there are no live payers (last round). */
  allInRateBpsPerMonth?: bigint;
}

const monthlyBps = (cost: bigint, t: Terms, k: number): bigint | undefined => {
  const left = t.n - BigInt(k);
  if (left <= 0n) return undefined;
  // cost / (D x T), D = left x C, T (months) = left x P / 30  ->  cost x 30 x 10_000 / (left^2 x C x P)
  return (cost * 30n * BPS) / (left * left * t.c * t.periodDays);
};

/** The bid calculator (decided 09/11): what you hold now, what you pay for it, and the rate it equals. Numbers only, no advice. */
export function bidQuote(t: Terms, k: number, bid: bigint, organizerWins = false): BidQuote {
  const cap = capOf(t, k);
  const split = roundSplit(t, k, bid, 0n, organizerWins);
  const interest = bid * BigInt(split.livePayers);
  const problem = bid >= t.c ? 'at-least-c' : bid > cap ? 'over-cap' : undefined;
  return {
    ...split,
    k,
    bid,
    cap,
    statutoryCap: statutoryCapOf(t, k),
    ...(problem ? { problem } : {}),
    interest,
    releaseEach: releasePerRound(t.alphaBps, t.c),
    laterPayments: (t.n - BigInt(k)) * t.c,
    ...(monthlyBps(interest, t, k) !== undefined ? { interestRateBpsPerMonth: monthlyBps(interest, t, k)! } : {}),
    ...(monthlyBps(interest + split.fee + split.premium, t, k) !== undefined
      ? { allInRateBpsPerMonth: monthlyBps(interest + split.fee + split.premium, t, k)! }
      : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Commission inside the interest cap (docs/03 section 2.7) and the on-time reserve split (ADR-24)
// ---------------------------------------------------------------------------------------------------------------------

export interface CommissionRow {
  k: number;
  /** L_k with nobody frozen. */
  payers: number;
  /** Ceiling set by the law. */
  statutoryCap: bigint;
  /** Ceiling the contract enforces on bids (legal ceiling minus the share). */
  cap: bigint;
  /** room_k: the most interest the law lets the winner pay. */
  room: bigint;
  /** Commission of this round at most (pot at its largest, i.e. a bid of 0); 0 in the last round. */
  fee: bigint;
}

/** One row per round, in money, for the create form: phi turned into "how many USDC does the organizer take in round k". */
export function commissionSchedule(t: Terms): CommissionRow[] {
  const biggestPot = (t.n - 1n) * t.c;
  return Array.from({ length: Number(t.n) }, (_, i) => {
    const k = i + 1;
    return { k, payers: Number(t.n) - k, statutoryCap: statutoryCapOf(t, k), cap: capOf(t, k), room: roomOf(t, k), fee: feeOf(t, k, biggestPot) };
  });
}

/** Reserve at the end of the circle: what is in it now plus the premium of each round still to come (bids of 0). A rough estimate. */
export function reserveEstimate(t: Terms, settledRounds: number, reserveNow: bigint): bigint {
  let r = reserveNow;
  for (let k = settledRounds + 1; k <= Number(t.n); k++) r += bpsOf((t.n - 1n) * t.c, t.reserveBps);
  return r;
}

export interface LateRewardLoss {
  /** Share of the end-of-circle reserve with the late rounds the member has now. */
  now: bigint;
  /** Same, after one more late round. */
  after: bigint;
  loss: bigint;
}

/** What one more late round (or an unrevealed bid) costs in the reserve split, others all on time (ADR-24, docs/03 section 5.3). */
export function lateRewardLoss(n: bigint, lateBefore: bigint, reserveEnd: bigint): LateRewardLoss {
  const others = (n - 1n) * (n - 1n);
  const share = (late: bigint): bigint => {
    const w = onTimeWeight(n, late, false);
    return w === 0n ? 0n : reserveShare(reserveEnd, w, w + others);
  };
  const now = share(lateBefore);
  const after = share(lateBefore + 1n);
  return { now, after, loss: now - after };
}

// ---------------------------------------------------------------------------------------------------------------------
// Fairness meter (S03)
// ---------------------------------------------------------------------------------------------------------------------

export interface SeatFairness {
  k: number;
  bid: bigint;
  /** Money in hand when this seat takes the pot, after fee, premium and holdback (the holdback comes back later). */
  received: bigint;
  /** Everything this seat pays over the whole circle. */
  paid: bigint;
  /** received + holdback + reserve share - paid. Negative = this seat pays for the circle. */
  net: bigint;
}

export interface Fairness {
  seats: SeatFairness[];
  /** Best net minus worst net: how unequal the seats are. 0 = identical. */
  spread: bigint;
  totalFee: bigint;
  reserveShare: bigint;
  /** Organizer: commission over the whole circle, per year of bond locked, in bps. Undefined when the bond is 0. */
  organizerReturnBpsPerYear?: bigint;
  warnings: string[];
}

/**
 * Net gain or loss of every seat if everybody pays on time and bids `bidPctOfCapBps` of the ceiling (0 = nobody bids,
 * 10_000 = everybody bids the ceiling). Reserve premiums come back evenly (all on time), so only fee, premium timing
 * and interest move money between seats.
 */
export function fairness(t: Terms, bond: bigint, bidPctOfCapBps: bigint): Fairness {
  const n = Number(t.n);
  const bids = Array.from({ length: n }, (_, i) => (capOf(t, i + 1) * bidPctOfCapBps) / BPS);
  const splits = bids.map((b, i) => roundSplit(t, i + 1, b));
  const totalPremium = splits.reduce((a, s) => a + s.premium, 0n);
  const totalFee = splits.reduce((a, s) => a + s.fee, 0n);
  const reserveShare = totalPremium / t.n;
  const seats: SeatFairness[] = splits.map((s, i) => {
    const k = i + 1;
    let paid = BigInt(n - k) * t.c;
    for (let j = 0; j < i; j++) paid += t.c - bids[j]!;
    const received = s.payout;
    return { k, bid: bids[i]!, received, paid, net: received + s.holdback + reserveShare - paid };
  });
  const nets = seats.map((s) => s.net);
  const spread = nets.reduce((a, b) => (b > a ? b : a)) - nets.reduce((a, b) => (b < a ? b : a));

  const warnings: string[] = [];
  if (t.mode === 'bidding') {
    const cap1 = capOf(t, 1);
    if (cap1 * 50n < t.c) {
      const pct = Number((cap1 * 10_000n) / t.c) / 100;
      warnings.push(
        `Trần thăm kỳ 1 chỉ bằng ${pct.toLocaleString('vi-VN')}% mức góp. Thăm gần như không phân biệt được ai cần tiền gấp, nhiều người sẽ cùng đặt mức trần. Cân nhắc kiểu Cố định hoặc kỳ dài hơn.`,
      );
    }
    if (bond > 0n && t.feeBps > 0n && totalFee * 50n < bond) {
      warnings.push('Hoa hồng cả dây chưa tới 2% ký quỹ: chủ hụi gần như không có lời, và chỉ cần một người bỏ đóng là lỗ. Hụi tuần ít người hay rơi vào trường hợp này; kỳ tháng hoặc nhiều người hơn thì hoa hồng lớn hơn.');
    }
    if (n < 5) warnings.push('Dây dưới 5 người: có ít người bỏ thăm nên khó chia thắng thua. Dây từ 5 người trở lên chạy ổn hơn.');
  }
  const years = t.n * t.periodDays;
  return {
    seats,
    spread,
    totalFee,
    reserveShare,
    ...(bond > 0n && years > 0n ? { organizerReturnBpsPerYear: (totalFee * BPS * 365n) / (bond * years) } : {}),
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Maximum-risk table (S03, S05)
// ---------------------------------------------------------------------------------------------------------------------

export interface DefaultRun {
  /** Index r-1: amount nobody covered in round r (the winner of round r receives that much less). */
  uncovered: bigint[];
  bondAfter: bigint[];
  reserveAfter: bigint[];
  /** Shortfall created in round r (before covering). */
  shortfall: bigint[];
}

/**
 * Plays the whole circle with some receivers who stop paying. `stopRound(j)` = first round receiver j (seat j) fails to
 * pay, or undefined if j pays to the end. Bids are 0 (largest shortfall), the winner of every round is honest, and each
 * shortfall is covered holdback -> bond -> reserve -> uncovered (docs/03 section 6.5 step 4).
 */
export function simulateDefaults(t: Terms, bond: bigint, stopRound: (seat: number) => number | undefined): DefaultRun {
  const n = Number(t.n);
  const rel = releasePerRound(t.alphaBps, t.c);
  const hold = new Map<number, bigint>();
  let bondLeft = bond;
  let reserve = 0n;
  const run: DefaultRun = { uncovered: [], bondAfter: [], reserveAfter: [], shortfall: [] };
  for (let r = 1; r <= n; r++) {
    let short = 0n;
    let unc = 0n;
    for (let j = 1; j < r; j++) {
      const s = stopRound(j);
      if (s === undefined || s > r) continue;
      if (!hold.has(j)) {
        const left = holdbackFor(t.alphaBps, t.n, BigInt(j), t.c) - BigInt(s - 1 - j) * rel;
        hold.set(j, left > 0n ? left : 0n);
      }
      short += t.c;
      let need = t.c;
      const fromH = hold.get(j)! < need ? hold.get(j)! : need;
      hold.set(j, hold.get(j)! - fromH);
      need -= fromH;
      const fromB = bondLeft < need ? bondLeft : need;
      bondLeft -= fromB;
      need -= fromB;
      const fromR = reserve < need ? reserve : need;
      reserve -= fromR;
      need -= fromR;
      unc += need;
    }
    const pot = (t.n - 1n) * t.c - unc;
    reserve += bpsOf(pot, t.reserveBps);
    run.shortfall.push(short);
    run.uncovered.push(unc);
    run.bondAfter.push(bondLeft);
    run.reserveAfter.push(reserve);
  }
  return run;
}

export interface RiskRow {
  k: number;
  /** Receivers before this seat. */
  before: number;
  /** Most this seat can lose if earlier receivers all stop together, in the worst round. */
  together: bigint;
  /** Most this seat can lose if every earlier receiver stops right after receiving, one after another. */
  sequential: bigint;
  worst: bigint;
}

export interface RiskTable {
  rows: RiskRow[];
  /** Most receivers who can stop together, at any moment, while every honest member still gets the full pot. */
  tolerated: number;
  /** True when sequential stops can leave someone short even though the simultaneous shock is fully covered. */
  sequentialExceedsBond: boolean;
}

/** "The circle survives X receivers stopping; the worst case for your seat is Y" (decided 09/11, docs/03 section 7.3). */
export function riskTable(t: Terms, bond: bigint): RiskTable {
  const n = Number(t.n);
  const seq = simulateDefaults(t, bond, (j) => (j < n ? j + 1 : undefined));
  const together = new Array<bigint>(n).fill(0n);
  let tolerated = 0;
  for (let x = 1; x <= n - 1; x++) {
    let ok = true;
    for (let m = x; m <= n - 1; m++) {
      const run = simulateDefaults(t, bond, (j) => (j > m - x && j <= m ? m + 1 : undefined));
      for (let r = m + 1; r <= n; r++) {
        if (run.uncovered[r - 1]! > together[r - 1]!) together[r - 1] = run.uncovered[r - 1]!;
      }
      if (run.uncovered.some((u) => u > 0n)) ok = false;
    }
    if (ok && tolerated === x - 1) tolerated = x;
  }
  const rows: RiskRow[] = Array.from({ length: n }, (_, i) => {
    const sequential = seq.uncovered[i]!;
    const tg = together[i]!;
    return { k: i + 1, before: i, together: tg, sequential, worst: sequential > tg ? sequential : tg };
  });
  return { rows, tolerated, sequentialExceedsBond: rows.some((r) => r.sequential > r.together) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Settlement (S12)
// ---------------------------------------------------------------------------------------------------------------------

export interface SettlementInput {
  terms: Terms;
  /** winnerByRound[r-1] = member index who received round r. */
  winnerByRound: number[];
  /** bids[r-1] = winning bid of round r. */
  bids: bigint[];
  bond: bigint;
}

export interface MemberSettlement {
  member: number;
  round: number;
  paid: bigint;
  received: bigint;
  holdbackBack: bigint;
  /** Discounts this member got as a live payer before their own round. */
  interestReceived: bigint;
  /** Discounts the others got when this member took the pot: bid x live payers. */
  interestPaid: bigint;
  /** Share of the reserve for paying on time (all on time in a clean circle, so equal; dust goes to the lowest seat). */
  reward: bigint;
  net: bigint;
}

export interface Settlement {
  members: MemberSettlement[];
  reserveTotal: bigint;
  feesToOrganizer: bigint;
  /** Commission paid to the organizer the moment each clean round settled (`FeePaid`). In a clean circle that is all of it. */
  feesPaidNow: bigint;
  /** Commission that waited in escrow until `finalize` (rounds with a shortfall). Zero in a clean circle. */
  feesAtFinalize: bigint;
  bondReturned: bigint;
}

/** A clean circle where everybody paid on time (the sample finished circle). Conservation: sum(net) = -fees. */
export function settleCleanCircle(s: SettlementInput): Settlement {
  const { terms: t } = s;
  const n = Number(t.n);
  const splits = s.winnerByRound.map((_, i) => roundSplit(t, i + 1, s.bids[i]!));
  const reserveTotal = splits.reduce((a, x) => a + x.premium, 0n);
  const feesToOrganizer = splits.reduce((a, x) => a + x.fee, 0n);
  const even = reserveTotal / t.n;
  const dust = reserveTotal - even * t.n;
  const roundOf = new Map(s.winnerByRound.map((m, i) => [m, i + 1]));
  const members: MemberSettlement[] = Array.from({ length: n }, (_, m) => {
    const k = roundOf.get(m)!;
    let paid = 0n;
    let interestReceived = 0n;
    for (let r = 1; r <= n; r++) {
      if (r === k) continue;
      const b = s.bids[r - 1]!;
      paid += r < k ? t.c - b : t.c;
      if (r < k) interestReceived += b;
    }
    const sp = splits[k - 1]!;
    const reward = even + (m === 0 ? dust : 0n);
    return {
      member: m,
      round: k,
      paid,
      received: sp.payout,
      holdbackBack: sp.holdback,
      interestReceived,
      interestPaid: s.bids[k - 1]! * BigInt(sp.livePayers),
      reward,
      net: sp.payout + sp.holdback + reward - paid,
    };
  });
  return { members, reserveTotal, feesToOrganizer, feesPaidNow: feesToOrganizer, feesAtFinalize: 0n, bondReturned: s.bond };
}

/** Deterministic sample bids: `pct`% of each round's ceiling, rounded down to a cent. */
export function sampleBids(t: Terms, pct: bigint): bigint[] {
  return Array.from({ length: Number(t.n) }, (_, i) => {
    const raw = (capOf(t, i + 1) * pct) / 100n;
    return raw - (raw % 10_000n);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Reputation badges (decided 09/11, report section 6 item 12). Display only: no tier unlocks any right over money.
// ---------------------------------------------------------------------------------------------------------------------

export interface Reputation {
  /** Circles finished without a default. */
  completed: number;
  onTime: number;
  late: number;
  defaults: number;
  repaid: number;
  /** Months since the first circle. */
  monthsActive: number;
  /** Organizers only: circles where the bond had to cover someone. */
  bondUsedCircles?: number;
  /** Chain data only: the wallet, so the badge can read its real record from the registry. */
  address?: `0x${string}`;
}

export const REP_DISCLAIMER = 'Huy hiệu là lịch sử, không phải bảo đảm. Bảo đảm của bạn là cọc của chủ hụi.';
