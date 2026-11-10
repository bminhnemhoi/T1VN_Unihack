/**
 * Sample circles for the B8 screens (S04 to S12). Four circles, one per situation, all derived from `Terms` so every
 * amount on screen goes through `hui-calc` (and so through `huiMath`). Swap `getSampleCircle()` for the chain hooks later.
 *
 *  demo      Hụi tổ dân phố 7      Bỏ thăm, docs/03 section 8 branch B, after round 2 (viewer = Thành viên 2, has not received)
 *  co-dinh   Hụi cố định gia đình  Cố định (no bids), weekly, after round 2; the viewer owes a shortfall in its grace period
 *  dang-gom  Hụi bạn đại học       Bỏ thăm, still gathering people, viewer is the organizer and takes seat 1
 *  da-xong   Hụi chị em văn phòng  Bỏ thăm, finished all 8 rounds on time; viewer received in round 5
 */
import type { CircleView } from 'sdk';
import { roundSplit, sampleBids, type Reputation, type Terms } from '@/lib/hui-calc';

const U = 1_000_000n;
const usdc = (whole: number, cents = 0): bigint => BigInt(whole) * U + BigInt(cents) * 10_000n;

export type CircleId = 'demo' | 'co-dinh' | 'dang-gom' | 'da-xong';
export const CIRCLE_IDS: CircleId[] = ['demo', 'co-dinh', 'dang-gom', 'da-xong'];
export const isCircleId = (s: string): s is CircleId => (CIRCLE_IDS as string[]).includes(s);

export interface SampleSeat {
  name: string;
  /** Wallet of the seat when the data comes from the chain. */
  address?: `0x${string}`;
  rep: Reputation;
  joined: boolean;
  /** Holds this seat as well as organizing (docs/03 section 9). */
  organizer?: boolean;
}

export type ShortfallStatus = 'grace' | 'defaulted' | 'paid';

export interface SampleShortfall {
  round: number;
  /** Index into `seats`. */
  member: number;
  amount: bigint;
  fromHoldback: bigint;
  fromBond: bigint;
  fromReserve: bigint;
  uncovered: bigint;
  status: ShortfallStatus;
  /** Real seconds left before the grace period ends (only while `status === 'grace'`). */
  graceSecondsLeft?: number;
  /** Real seconds since the round settled: late interest runs on this. */
  sinceSeconds: number;
}

/** Present only when the data was read from the chain: the raw view plus the clock and wallet it was read with. */
export interface LiveInfo {
  view: CircleView;
  address: `0x${string}`;
  viewerAddress?: `0x${string}`;
  nowMs: number;
  /** `termsHash` written on the chain by the organizer (ADR-27); undefined until it is read. */
  termsHash?: `0x${string}`;
}

export interface SampleCircleData {
  /** Sample id (`demo`, ...) or, for chain data, the circle address. */
  id: string;
  live?: LiveInfo;
  label: string;
  terms: Terms;
  state: 'forming' | 'active' | 'completed';
  /**
   * Chain only: the circle is `Paused` (it stays `state: 'active'` so the room still draws). While paused only `claim()`
   * works on chain; every other button is locked and a banner says so (docs/03 section 5.4).
   */
  paused?: boolean;
  seats: SampleSeat[];
  /** Index into `seats` of the person looking at the screen. */
  viewer: number;
  viewerIsOrganizer: boolean;
  organizerAddr: string;
  organizerRep: Reputation;
  bond: bigint;
  bondRemaining: bigint;
  reserve: bigint;
  /** Rounds already settled. */
  settled: number;
  /** winnerByRound[r-1] = seat index. */
  winnerByRound: number[];
  bids: bigint[];
  shortfalls: SampleShortfall[];
  /** Times are shown in Vietnam time; `startMs` + `roundMs` x r = when round r settled. */
  startMs: number;
  roundMs: number;
  /** Real seconds of one round, the grace period, and the nominal period (for late interest). */
  roundSeconds: number;
  graceSeconds: number;
  /** Forming only. */
  joinSecondsLeft?: number;
  /** Seconds to the deadline of the round that runs now. */
  roundSecondsLeft?: number;
}

const rep = (r: Partial<Reputation>): Reputation => ({ completed: 0, onTime: 0, late: 0, defaults: 0, repaid: 0, monthsActive: 0, ...r });
const vnTime = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h - 7, mi);

/** The sample clock: "now" on every sample screen, so server and browser render the same text. */
export const SAMPLE_NOW_MS = vnTime(2026, 11, 9, 10, 10);

const DEMO_TERMS: Terms = { mode: 'bidding', n: 5n, c: usdc(100), periodDays: 30n, alphaBps: 2000n, feeBps: 100n, reserveBps: 100n, capBps: 2000n };
const FIXED_TERMS: Terms = { mode: 'fixed', n: 5n, c: usdc(20), periodDays: 7n, alphaBps: 2000n, feeBps: 100n, reserveBps: 100n, capBps: 0n };
const GATHER_TERMS: Terms = { mode: 'bidding', n: 5n, c: usdc(10), periodDays: 30n, alphaBps: 2000n, feeBps: 300n, shareBps: 5000n, reserveBps: 100n, capBps: 2000n };
const DONE_TERMS: Terms = { mode: 'bidding', n: 8n, c: usdc(50), periodDays: 30n, alphaBps: 2000n, feeBps: 300n, shareBps: 5000n, reserveBps: 100n, capBps: 2000n };

const named = (names: string[], reps: Reputation[], joined = names.length): SampleSeat[] =>
  names.map((name, i) => ({ name, rep: reps[i] ?? rep({}), joined: i < joined }));

const DEMO: SampleCircleData = {
  id: 'demo',
  label: 'Hụi tổ dân phố 7',
  terms: DEMO_TERMS,
  state: 'active',
  seats: named(
    ['Thành viên 1', 'Thành viên 2', 'Thành viên 3', 'Thành viên 4', 'Thành viên 5'],
    [
      rep({ completed: 4, onTime: 22, monthsActive: 9 }),
      rep({ completed: 1, onTime: 8, monthsActive: 3 }),
      rep({}),
      rep({ completed: 2, onTime: 11, late: 2, defaults: 1, monthsActive: 7 }),
      rep({ completed: 12, onTime: 70, late: 1, monthsActive: 14 }),
    ],
  ),
  viewer: 1,
  viewerIsOrganizer: false,
  organizerAddr: '0x9a…41',
  organizerRep: rep({ completed: 5, onTime: 0, monthsActive: 10, bondUsedCircles: 0 }),
  bond: usdc(480),
  bondRemaining: usdc(460),
  reserve: usdc(7, 67), // 3,76 + 3,91
  settled: 2,
  winnerByRound: [3, 0], // docs/03 section 8: M4 hốt kỳ 1, M1 hốt kỳ 2
  bids: [usdc(6), usdc(3)],
  shortfalls: [
    {
      round: 2,
      member: 3,
      amount: usdc(100),
      fromHoldback: usdc(80),
      fromBond: usdc(20),
      fromReserve: 0n,
      uncovered: 0n,
      status: 'defaulted',
      sinceSeconds: 240, // real seconds: past the 120 s grace of the demo clock (1 nominal day = 6 s)
    },
  ],
  startMs: vnTime(2026, 11, 9, 10, 0),
  roundMs: 180_000,
  roundSeconds: 180,
  graceSeconds: 120,
  roundSecondsLeft: 4 * 3600 + 12 * 60 + 9,
};

const FIXED: SampleCircleData = {
  id: 'co-dinh',
  label: 'Hụi cố định gia đình',
  terms: FIXED_TERMS,
  state: 'active',
  seats: named(
    ['Thành viên 1', 'Thành viên 2', 'Bạn (Thành viên 3)', 'Thành viên 4', 'Thành viên 5'],
    [
      rep({ completed: 3, onTime: 18, late: 0, monthsActive: 8 }),
      rep({ completed: 1, onTime: 6, monthsActive: 2 }),
      rep({ completed: 1, onTime: 5, late: 1, monthsActive: 2 }),
      rep({}),
      rep({ completed: 2, onTime: 12, monthsActive: 5 }),
    ],
  ),
  viewer: 2,
  viewerIsOrganizer: false,
  organizerAddr: '0x4c…d8',
  organizerRep: rep({ completed: 3, monthsActive: 8, bondUsedCircles: 0 }),
  bond: usdc(96),
  bondRemaining: usdc(76), // the viewer's 20 USDC shortfall of round 2 was covered by the bond
  reserve: usdc(1, 60),
  settled: 2,
  winnerByRound: [0, 1],
  bids: [0n, 0n],
  shortfalls: [
    {
      round: 2,
      member: 2,
      amount: usdc(20),
      fromHoldback: 0n,
      fromBond: usdc(20),
      fromReserve: 0n,
      uncovered: 0n,
      status: 'grace',
      graceSecondsLeft: 36 * 3600,
      sinceSeconds: 12 * 3600,
    },
  ],
  startMs: vnTime(2026, 10, 26, 8, 0),
  roundMs: 7 * 86_400_000,
  roundSeconds: 7 * 86_400,
  graceSeconds: 172_800,
  roundSecondsLeft: 6 * 86_400 + 21 * 3600,
};

const GATHER: SampleCircleData = {
  id: 'dang-gom',
  label: 'Hụi bạn đại học',
  terms: GATHER_TERMS,
  state: 'forming',
  seats: [
    { name: 'Bạn (chủ hụi)', rep: rep({ completed: 3, onTime: 0, monthsActive: 8, bondUsedCircles: 0 }), joined: true, organizer: true },
    { name: 'Thành viên 2', rep: rep({ completed: 3, onTime: 20, late: 0, monthsActive: 8 }), joined: true },
    { name: 'Thành viên 3', rep: rep({}), joined: true },
    { name: 'Chỗ trống', rep: rep({}), joined: false },
    { name: 'Chỗ trống', rep: rep({}), joined: false },
  ],
  viewer: 0,
  viewerIsOrganizer: true,
  organizerAddr: '0x7e…2b',
  organizerRep: rep({ completed: 3, monthsActive: 8, bondUsedCircles: 0 }),
  bond: usdc(48),
  bondRemaining: usdc(48),
  reserve: 0n,
  settled: 0,
  winnerByRound: [],
  bids: [],
  shortfalls: [],
  startMs: vnTime(2026, 11, 9, 9, 0),
  roundMs: 30 * 86_400_000,
  roundSeconds: 30 * 86_400,
  graceSeconds: 172_800,
  joinSecondsLeft: 6 * 86_400 + 3 * 3600,
};

const DONE_WINNERS = [5, 2, 7, 0, 3, 6, 1, 4]; // viewer (index 3) received in round 5
const DONE: SampleCircleData = {
  id: 'da-xong',
  label: 'Hụi chị em văn phòng',
  terms: DONE_TERMS,
  state: 'completed',
  seats: named(
    Array.from({ length: 8 }, (_, i) => (i === 3 ? 'Bạn (Thành viên 4)' : `Thành viên ${i + 1}`)),
    [
      rep({ completed: 5, onTime: 40, monthsActive: 12 }),
      rep({ completed: 1, onTime: 7, monthsActive: 8 }),
      rep({ completed: 3, onTime: 21, late: 1, monthsActive: 8 }),
      rep({ completed: 2, onTime: 14, monthsActive: 8 }),
      rep({}),
      rep({ completed: 2, onTime: 14, monthsActive: 8 }),
      rep({ completed: 10, onTime: 66, late: 2, monthsActive: 20 }),
      rep({ completed: 1, onTime: 7, monthsActive: 8 }),
    ],
  ),
  viewer: 3,
  viewerIsOrganizer: false,
  organizerAddr: '0xb1…07',
  organizerRep: rep({ completed: 6, monthsActive: 14, bondUsedCircles: 0 }),
  bond: usdc(640),
  bondRemaining: usdc(640),
  reserve: 0n, // paid out at the end
  settled: 8,
  winnerByRound: DONE_WINNERS,
  bids: sampleBids(DONE_TERMS, 70n),
  shortfalls: [],
  startMs: vnTime(2026, 2, 1, 9, 0),
  roundMs: 30 * 86_400_000,
  roundSeconds: 30 * 86_400,
  graceSeconds: 172_800,
};

const ALL: Record<CircleId, SampleCircleData> = { demo: DEMO, 'co-dinh': FIXED, 'dang-gom': GATHER, 'da-xong': DONE };
export const getSampleCircle = (id: CircleId): SampleCircleData => ALL[id];
export const SAMPLE_CIRCLES_LIST: SampleCircleData[] = CIRCLE_IDS.map((id) => ALL[id]);

/** "Now" of a screen: the real clock for chain data, the fixed sample clock otherwise. */
export const nowMsOf = (c: SampleCircleData): number => c.live?.nowMs ?? SAMPLE_NOW_MS;

/** Time round r settled, in ms since epoch (the real block time for chain data). */
export const settledAtMs = (c: SampleCircleData, r: number): number => {
  const at = c.live?.view.rounds[r - 1]?.settledAt;
  return at !== undefined ? at * 1000 : c.startMs + c.roundMs * r;
};

const TIME = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
/** "09/11/2026 10:06", Vietnam time, 24 hours. The same on server and client. */
export const formatVnTime = (ms: number): string => TIME.format(new Date(ms)).replace(',', '');

/** Pot, fee, premium, holdback and payout of a settled round, including what nobody covered. */
export function settledRound(c: SampleCircleData, r: number) {
  const real = c.live?.view.rounds[r - 1];
  if (real && real.phase === 'done' && real.winner !== undefined) {
    return {
      livePayers: 0,
      deadPayers: 0,
      pot: real.pot ?? 0n,
      fee: real.fee ?? 0n,
      premium: real.premium ?? 0n,
      holdback: real.holdback ?? 0n,
      payout: real.payout ?? 0n,
      winner: c.winnerByRound[r - 1]!,
      bid: real.bid ?? 0n,
      uncovered: real.uncovered ?? 0n,
    };
  }
  const uncovered = c.shortfalls.filter((s) => s.round === r).reduce((a, s) => a + s.uncovered, 0n);
  return { ...roundSplit(c.terms, r, c.bids[r - 1] ?? 0n, uncovered), winner: c.winnerByRound[r - 1]!, bid: c.bids[r - 1] ?? 0n, uncovered };
}

/** Which seats are the next ones allowed to bid or take the pot (live = not received, not frozen). */
export function liveSeats(c: SampleCircleData): number[] {
  const got = new Set(c.winnerByRound);
  const frozen = new Set(c.shortfalls.filter((s) => s.status === 'defaulted' && !got.has(s.member)).map((s) => s.member));
  return c.seats.flatMap((_, i) => (c.seats[i]!.joined && !got.has(i) && !frozen.has(i) ? [i] : []));
}
