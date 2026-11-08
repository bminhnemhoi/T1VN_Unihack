/**
 * Keeper logic (docs/05 section 9, docs/04 section 7.1). The keeper is only a convenience: every action it takes is a
 * public function anyone can call. Rules:
 *   - idempotent: every action is simulated by eth_call first; a revert such as "already done" is skipped, not sent;
 *   - order per circle: markDefault for EVERY overdue shortfall first, then settleRound, then finalize, so finalize
 *     never has to mark many members itself (A7 rule: that path can exceed the 5M gas cap at N = 30);
 *   - cancel a Forming circle after its join deadline.
 * The chain is reached through a small port so the ordering can be unit tested without a node.
 */
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
}

export type AttemptResult =
  | { sent: true; txHash: Hex; gasUsed: bigint; ok: boolean }
  | { sent: false; code: string; message: string };

export interface KeeperPort {
  /** Latest block timestamp in seconds: the contract's own clock, not the wall clock. */
  nowSec(): Promise<number>;
  circles(): Promise<readonly Address[]>;
  snapshot(circle: Address): Promise<CircleSnapshot>;
  deadline(circle: Address, round: number): Promise<bigint>;
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
]);

export interface TickSummary {
  circles: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function tick(port: KeeperPort, log: Log): Promise<TickSummary> {
  const summary: TickSummary = { circles: 0, sent: 0, skipped: 0, failed: 0 };
  const now = await port.nowSec();
  const circles = await port.circles();

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
    for (const member of members) {
      if (await port.owes(circle, member)) await run(circle, 'markDefault', [member], { member });
    }
  };

  for (const circle of circles) {
    let snap = await port.snapshot(circle);
    if (snap.state === STATE.Forming) {
      summary.circles++;
      if (BigInt(now) > snap.joinDeadline) await run(circle, 'cancel', [], {});
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
      if (BigInt(now) >= deadline) {
        if (await run(circle, 'settleRound', [], { round })) snap = await port.snapshot(circle);
      }
    }

    // 3. Finalize after the last round; the simulation says whether the grace period is over.
    if (snap.state === STATE.Active && snap.settledRounds >= snap.memberCount) {
      await markOverdue(circle, snap.members);
      await run(circle, 'finalize', [], {});
    }
  }
  return summary;
}
