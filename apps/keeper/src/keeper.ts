/**
 * Keeper logic (docs/05 section 9, docs/04 section 7.1). The keeper is only a convenience: every action it takes is a
 * public function anyone can call. Rules:
 *   - idempotent: every action is simulated by eth_call first; a revert such as "already done" is skipped, not sent;
 *   - order per circle: markDefault for EVERY overdue shortfall first, then settleRound, then finalize, so finalize
 *     never has to mark many members itself (A7 rule: that path can exceed the 5M gas cap at N = 30);
 *   - cancel a Forming circle after its join deadline;
 *   - ignore circles that never received a bond (`bondDeposited == 0`, audit A16 M-01/L-01): they cannot reach the
 *     100% coverage floor unless alpha = 100%, so they are spam; track at most MAX_TRACKED_CIRCLES, newest first.
 * The chain is reached through a small port so the ordering can be unit tested without a node.
 */
import { organizerSettleWaitSec } from 'config';

type Address = `0x${string}`;
type Hex = `0x${string}`;

export type KeeperFn = 'settleRound' | 'markDefault' | 'finalize' | 'cancel';

/** Mirrors `CircleState` in HuiTypes.sol. */
export const STATE = { Forming: 0, Active: 1, Paused: 2, Completed: 3, Cancelled: 4, Unwound: 5 } as const;

export interface CircleSnapshot {
  state: number;
  memberCount: number;
  joinDeadline: bigint;
  settledRounds: number;
  members: readonly Address[];
  /** Bond held by the circle; a Forming circle past its deadline is only worth cancelling when this is above zero. */
  bondRemaining: bigint;
  /** Total bond ever deposited. Zero means nobody backs the circle: the keeper does not spend gas on it. */
  bondDeposited: bigint;
  /** Real seconds between two rounds; picks how long the organizer has to settle first (B28). Absent: settle at the deadline. */
  roundDuration?: number;
  /** Organizer of the circle; when they also hold a seat they get no settling turn (audit B28 L-01). */
  organizer?: Address;
}

export type AttemptResult =
  | { sent: true; txHash: Hex; gasUsed: bigint; ok: boolean }
  | { sent: false; code: string; message: string };

export interface KeeperPort {
  /** Latest block timestamp in seconds: the contract's own clock, not the wall clock. */
  nowSec(): Promise<number>;
  circles(): Promise<readonly Address[]>;
  snapshot(circle: Address): Promise<CircleSnapshot>;
  /** Optional: stop reading this circle for the rest of the process (it can never need the keeper again). */
  retire?(circle: Address): void;
  deadline(circle: Address, round: number): Promise<bigint>;
  /** Optional: Unix timestamp when `finalize()` becomes callable after the last round (`settledAt(N) + grace + pausedTotal + 1`). */
  finalizeDueAt?(circle: Address, lastRound: number): Promise<bigint | undefined>;
  /** True when the member is not marked defaulted but still owes a shortfall (`debt > 0`). */
  owes(circle: Address, member: Address): Promise<boolean>;
  /** Simulate, estimate gas (x1.2, capped), send and wait. Never throws for a revert or a network error. */
  attempt(circle: Address, fn: KeeperFn, args: readonly unknown[]): Promise<AttemptResult>;
}

export type Log = (
  level: 'info' | 'warn' | 'error',
  message: string,
  fields?: Record<string, string | number | boolean>,
) => void;

/** Codes that only mean "not due yet" or "already done": logged at info. */
const EXPECTED = new Set([
  'TooEarly',
  'GraceNotOver',
  'NoShortfall',
  'AlreadyDefaulted',
  'RoundAlreadySettled',
  'PreviousRoundNotSettled',
  'WrongState',
  'CircleIsPaused',
  'JoinClosed',
  'BackingOff',
]);

/** Circles read per scan, newest first (audit A16 L-01: a flood of spam circles must not slow the scan down). */
export const MAX_TRACKED_CIRCLES = 200;
/**
 * How many circles in a row may fail (RPC read or send step threw) before the scan gives up and rethrows: one unreadable
 * circle must not stop the others from being served (a flaky or throttled RPC fails a share of the reads, and the oldest
 * circles sit at the end of the order), but when every read fails the RPC is down and 200 more attempts are noise.
 */
export const MAX_CONSECUTIVE_FAILURES = 5;

/** Cleanup `cancel` of unbonded Forming circles sent per scan; each such circle is cancelled once, then retired. */
export const MAX_CLEANUP_CANCELS = 5;
/** Circle snapshots read ahead of the processing loop (read-only, so safe to overlap). */
export const SNAPSHOT_AHEAD = 10;

export interface TickSummary {
  circles: number;
  /** Circles skipped because they never received a bond. */
  ignored: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Earliest positive seconds until a tracked circle's next round settlement, cancel, or finalize becomes due. */
  nextDueInSec?: number;
}

/**
 * What the keeper remembers between scans (issue #1): when each circle was last read and which circles were seen
 * with a bond. Create one with `newKeeperMemory()` per process and pass it to every `tick`.
 */
export interface KeeperMemory {
  scans: number;
  /** Scan number at which each circle was last read. */
  lastRead: Map<Address, number>;
  /** Circles seen with `bondDeposited > 0` that are not terminal: read on every scan. */
  funded: Set<Address>;
}

export function newKeeperMemory(): KeeperMemory {
  return { scans: 0, lastRead: new Map(), funded: new Set() };
}

/**
 * The circles to read this scan. Funded circles always (a bond costs real USDC, so they cannot be spammed); of the
 * others at most MAX_TRACKED_CIRCLES, least recently read first and newest first on ties. The first scan is therefore
 * the newest 200 as before, and every circle is read within ceil(n / 200) scans however many newer circles appear,
 * so a flood of unbonded circles can slow discovery down but never starve a funded circle (issue #1).
 */
function pickCircles(all: readonly Address[], mem: KeeperMemory): { circles: Address[]; truncated: boolean } {
  const newestFirst = [...all].reverse();
  const known = new Set(all);
  for (const c of mem.funded) if (!known.has(c)) mem.funded.delete(c); // retired or terminal since
  const funded = newestFirst.filter((c) => mem.funded.has(c));
  const rest = newestFirst
    .map((c, i) => ({ c, i, last: mem.lastRead.get(c) ?? -1 }))
    .filter((x) => !mem.funded.has(x.c))
    .sort((a, b) => a.last - b.last || a.i - b.i)
    .map((x) => x.c);
  return { circles: [...funded, ...rest.slice(0, MAX_TRACKED_CIRCLES)], truncated: rest.length > MAX_TRACKED_CIRCLES };
}

export async function tick(port: KeeperPort, log: Log, mem: KeeperMemory = newKeeperMemory()): Promise<TickSummary> {
  const summary: TickSummary = { circles: 0, ignored: 0, sent: 0, skipped: 0, failed: 0 };
  const noteDueAt = (dueSec: bigint, nowSec: number): void => {
    const wait = dueSec > BigInt(nowSec) ? Number(dueSec - BigInt(nowSec)) : 1;
    if (wait > 0 && (summary.nextDueInSec === undefined || wait < summary.nextDueInSec)) {
      summary.nextDueInSec = wait;
    }
  };
  const now = await port.nowSec();
  const all = await port.circles();
  const scan = mem.scans++;
  const { circles, truncated } = pickCircles(all, mem);
  if (truncated) {
    log('warn', 'circle list truncated', { total: all.length, tracked: circles.length, funded: mem.funded.size });
  }
  let cleanupCancels = 0;

  const run = async (
    circle: Address,
    fn: KeeperFn,
    args: readonly unknown[],
    extra: Record<string, string | number>,
  ): Promise<boolean> => {
    const r = await port.attempt(circle, fn, args);
    if (r.sent) {
      summary.sent++;
      if (!r.ok) summary.failed++;
      log(r.ok ? 'info' : 'error', `${fn} sent`, {
        circle,
        ...extra,
        txHash: r.txHash,
        gasUsed: Number(r.gasUsed),
        reverted: !r.ok,
      });
      return r.ok;
    }
    if (EXPECTED.has(r.code)) {
      summary.skipped++;
      log('info', `${fn} skipped`, { circle, ...extra, code: r.code });
    } else {
      summary.failed++;
      log('warn', `${fn} not sent`, { circle, ...extra, code: r.code, reason: r.message });
    }
    return false;
  };

  const markOverdue = async (circle: Address, members: readonly Address[]): Promise<void> => {
    // markDefault picks the oldest overdue shortfall itself and reverts with GraceNotOver / NoShortfall otherwise,
    // so the simulation inside `attempt` decides who is due.
    // The reads are independent and cheap: ask for all members at once (one batch), then send one by one.
    const owing = await Promise.all(members.map((member) => port.owes(circle, member)));
    for (const [i, member] of members.entries()) {
      if (owing[i]) await run(circle, 'markDefault', [member], { member });
    }
  };

  // Snapshots are read-only: fetch them a few circles ahead of the loop below, which stays strictly sequential for
  // everything that sends a transaction (one keeper wallet, one nonce sequence).
  const pending = new Map<Address, Promise<CircleSnapshot>>();
  const prefetch = (from: number): void => {
    for (let j = from; j < Math.min(circles.length, from + SNAPSHOT_AHEAD); j++) {
      const c = circles[j]!;
      if (pending.has(c)) continue;
      const p = port.snapshot(c);
      p.catch(() => undefined); // an unread failure (the loop stopped earlier) must not become an unhandled rejection
      pending.set(c, p);
    }
  };

  let consecutiveFailures = 0;
  for (const [index, circle] of circles.entries()) {
    prefetch(index);
    try {
      let snap = await pending.get(circle)!;
      pending.delete(circle);
      consecutiveFailures = 0; // the RPC answered: only reads that fail back to back mean it is down
      mem.lastRead.set(circle, scan);
      if (snap.bondDeposited > 0n && snap.state <= STATE.Paused) mem.funded.add(circle);
      else mem.funded.delete(circle);
      if (snap.bondDeposited === 0n && snap.state <= STATE.Paused) {
        summary.ignored++;
        if (snap.state === STATE.Forming && BigInt(now) > snap.joinDeadline) {
          // Nobody can still deposit: clean it up with one cancel (bounded per scan), then never read it again. Retire
          // only after the cancel went through (issue #2): a failed attempt stays eligible for the next scan (the port
          // backs off after an on-chain revert), and if someone else cancelled it the next read sees a terminal state.
          if (cleanupCancels < MAX_CLEANUP_CANCELS) {
            cleanupCancels++;
            if (await run(circle, 'cancel', [], { reason: 'unbonded' })) port.retire?.(circle);
          }
        } else if (snap.state !== STATE.Forming) {
          port.retire?.(circle); // Active or Paused without a bond can never get one
        }
        continue;
      }
      if (snap.state === STATE.Forming) {
        summary.circles++;
        if (BigInt(now) > snap.joinDeadline && snap.bondRemaining > 0n) await run(circle, 'cancel', [], {});
        else if (snap.bondRemaining > 0n) noteDueAt(snap.joinDeadline + 1n, now);
        continue;
      }
      if (snap.state !== STATE.Active) continue; // Paused or terminal: nothing to do
      summary.circles++;

      // 1. Mark every overdue defaulter.
      await markOverdue(circle, snap.members);

      // 2. Settle the current round once its deadline has passed.
      if (snap.settledRounds < snap.memberCount) {
        const round = snap.settledRounds + 1;
        const deadline = await port.deadline(circle, round);
        // Organizer-led rounds (B28): the organizer settles first; the keeper steps in only after the organizer's turn.
        // An organizer who also holds a seat could pick the moment a rival is short: no turn for them (audit B28 L-01).
        const orgSeated = snap.organizer !== undefined && snap.members.some((m) => m.toLowerCase() === snap.organizer!.toLowerCase());
        const due = snap.roundDuration === undefined || orgSeated ? deadline : deadline + BigInt(organizerSettleWaitSec(snap.roundDuration));
        if (BigInt(now) >= due) {
          if (await run(circle, 'settleRound', [], { round, organizerLate: due > deadline ? 1 : 0 })) snap = await port.snapshot(circle);
        } else {
          noteDueAt(due + 1n, now);
        }
      }

      // 3. Finalize after the last round; the simulation says whether the grace period is over.
      if (snap.state === STATE.Active && snap.settledRounds >= snap.memberCount) {
        await markOverdue(circle, snap.members);
        const finalized = await run(circle, 'finalize', [], {});
        if (!finalized && port.finalizeDueAt) {
          const due = await port.finalizeDueAt(circle, snap.memberCount).catch(() => undefined);
          if (due !== undefined) noteDueAt(due, now);
        }
      }
    } catch (e) {
      // A read or a step of this one circle failed (typically a throttled RPC). Count it, move the circle to the back of
      // the queue like a circle that was read, and go on with the others. The reason is the error NAME only: a viem error
      // text carries the RPC URL, and with it any API key.
      summary.failed++;
      mem.lastRead.set(circle, scan);
      log('warn', 'circle skipped', { circle, reason: e instanceof Error ? e.name : 'unknown' });
      if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) throw e;
    }
  }
  return summary;
}
