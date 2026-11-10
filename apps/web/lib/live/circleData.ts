/**
 * Chain `CircleView` (packages/sdk) -> `SampleCircleData` (the shape every B8 screen already reads). Pure and read-only:
 * the screens keep their layout and only the data source changes. Amounts stay USDC base units; no VND anywhere.
 *
 * Two approximations the chain view cannot answer (flagged in REPORT-B9):
 *  - `bond` (the amount originally deposited) is rebuilt as `bondRemaining` plus the bond share of still-open shortfalls;
 *  - reputation of a seat is NOT filled here: seats carry their `address` and `RepBadge` reads the registry itself.
 */
import { owedSeconds, type CircleView, type MemberView, type ShortfallView } from 'sdk';
import type { Reputation, Terms } from '@/lib/hui-calc';
import type { SampleCircleData, SampleSeat, SampleShortfall, ShortfallStatus } from '@/lib/sample-circles';

type Address = `0x${string}`;

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const EMPTY_REP: Reputation = { completed: 0, onTime: 0, late: 0, defaults: 0, repaid: 0, monthsActive: 0 };
const withAddress = (a: Address): Reputation => ({ ...EMPTY_REP, address: a });

/** "0x1a2b…c3d4": enough to tell wallets apart, short enough for a sentence. */
export const shortAddress = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
export const isAddress = (s: string): s is Address => ADDRESS_RE.test(s);

export function termsOf(v: CircleView, shareBps = 0): Terms {
  const p = v.params;
  return {
    mode: v.mode,
    n: BigInt(p.N),
    c: p.C,
    periodDays: BigInt(Math.max(1, Math.round(p.periodSeconds / 86_400))),
    alphaBps: BigInt(p.alphaBps),
    feeBps: BigInt(p.commissionMode ? p.feeBps : 0),
    reserveBps: BigInt(p.reserveBps),
    capBps: BigInt(p.capBps),
    shareBps: BigInt(p.commissionMode ? shareBps : 0),
  };
}

function statusOf(v: CircleView, s: ShortfallView, member: MemberView | undefined, nowSec: number): ShortfallStatus {
  if (s.resolved) return 'paid';
  if (member && (member.status === 'frozen' || member.status === 'defaultedDead')) return 'defaulted';
  return nowSec <= s.graceEndsAt ? 'grace' : 'defaulted';
}

/** `viewer` = connected wallet, if any. `nowMs` is passed in so the result is a pure function of its inputs. */
export function viewToCircleData(v: CircleView, viewer: Address | undefined, nowMs: number, extras?: { commissionShareBps: number; termsHash: Address }): SampleCircleData {
  const nowSec = Math.floor(nowMs / 1000);
  const sorted = [...v.members].sort((a, b) => a.joinIndex - b.joinIndex);
  const viewerIdx = viewer ? sorted.findIndex((m) => same(m.address, viewer)) : -1;
  const viewerIsOrganizer = viewer !== undefined && same(v.organizer, viewer);

  const seats: SampleSeat[] = Array.from({ length: v.params.N }, (_, i) => {
    const m = sorted[i];
    if (!m) return { name: 'Chỗ trống', rep: EMPTY_REP, joined: false };
    const base = `Thành viên ${i + 1}`;
    return { name: i === viewerIdx ? `Bạn (${base})` : base, address: m.address, rep: withAddress(m.address), joined: true };
  });
  const seatOf = (a: Address): number => sorted.findIndex((m) => same(m.address, a));

  const done = v.rounds.filter((r) => r.phase === 'done' && r.winner !== undefined);
  const winnerByRound = done.map((r) => seatOf(r.winner!));
  const bids = done.map((r) => r.bid ?? 0n);

  const shortfalls: SampleShortfall[] = v.rounds.flatMap((r) =>
    r.shortfalls.map((s): SampleShortfall => {
      const member = sorted.find((m) => same(m.address, s.member));
      const status = statusOf(v, s, member, nowSec);
      return {
        round: s.round,
        member: seatOf(s.member),
        amount: s.amount,
        fromHoldback: s.fromHoldback,
        fromBond: s.fromBond,
        fromReserve: s.fromReserve,
        uncovered: s.uncovered,
        status,
        ...(status === 'grace' ? { graceSecondsLeft: Math.max(0, s.graceEndsAt - nowSec) } : {}),
        sinceSeconds: Math.max(0, owedSeconds(v, s, nowSec)),
      };
    }),
  );

  const openBondShare = shortfalls.filter((s) => s.status !== 'paid').reduce((a, s) => a + s.fromBond, 0n);
  const running = v.rounds.find((r) => r.k === v.currentRound);

  return {
    id: v.address,
    live: { view: v, address: v.address, viewerAddress: viewer, nowMs, ...(extras ? { termsHash: extras.termsHash } : {}) },
    label: v.label || 'Dây hụi',
    terms: termsOf(v, extras?.commissionShareBps ?? 0),
    state: v.state === 'forming' ? 'forming' : v.state === 'active' || v.state === 'paused' ? 'active' : 'completed',
    ...(v.state === 'paused' ? { paused: true } : {}),
    seats,
    viewer: viewerIdx,
    viewerIsOrganizer,
    organizerAddr: shortAddress(v.organizer),
    organizerRep: withAddress(v.organizer),
    bond: v.bondRemaining + openBondShare,
    bondRemaining: v.bondRemaining,
    reserve: v.reserve,
    settled: v.settledRounds,
    winnerByRound,
    bids,
    shortfalls,
    startMs: (v.startTime ?? 0) * 1000,
    roundMs: v.params.roundDuration * 1000,
    roundSeconds: v.params.roundDuration,
    graceSeconds: v.params.graceSeconds,
    ...(v.state === 'forming' ? { joinSecondsLeft: Math.max(0, v.params.joinDeadline - nowSec) } : {}),
    ...(v.state === 'active' && running ? { roundSecondsLeft: Math.max(0, running.deadline - nowSec) } : {}),
  };
}
