/**
 * Repayment quote for `payLate(k)` and `repayDebt(principal)`, mirroring `HuiCircle._restoreRound/_restoreAll`
 * (docs/03 section 6.8, docs/05 section 7.2): open shortfalls oldest round first; inside one shortfall the refund order
 * is uncovered, reserve, bond, holdback; the late fee is charged per part, rounded down per part, on the time since
 * the shortfall appeared minus pause time after it. The UI checks allowance against `total` before sending.
 */
import { lateFee } from './huiMath';
import type { CircleView, ShortfallView } from './view';

type Address = `0x${string}`;

export type RepayPart = {
  round: number;
  source: 'uncovered' | 'reserve' | 'bond' | 'holdback';
  principal: bigint;
  lateFee: bigint;
};

export interface RepayQuote {
  principal: bigint;
  lateFee: bigint;
  /** principal + lateFee: the allowance the debtor needs. */
  total: bigint;
  parts: RepayPart[];
}

const ORDER = [
  ['uncovered', 'uncovered'],
  ['reserve', 'fromReserve'],
  ['bond', 'fromBond'],
  ['holdback', 'fromHoldback'],
] as const;

/** Seconds a shortfall has been owed, without paused time (same as the contract). */
export function owedSeconds(view: CircleView, sf: ShortfallView, nowSec: number): number {
  return Math.max(0, nowSec - sf.since - (view.pausedTotal - sf.pausedAtSettle));
}

function restore(view: CircleView, sf: ShortfallView, budget: bigint, nowSec: number): RepayPart[] {
  const parts: RepayPart[] = [];
  const elapsed = BigInt(owedSeconds(view, sf, nowSec));
  for (const [source, key] of ORDER) {
    if (budget <= 0n) break;
    const owed = sf[key];
    const p = owed < budget ? owed : budget;
    if (p === 0n) continue;
    budget -= p;
    parts.push({
      round: sf.round,
      source,
      principal: p,
      lateFee: lateFee(
        p,
        BigInt(view.lateRateBps),
        elapsed,
        BigInt(view.params.periodSeconds),
        BigInt(view.params.roundDuration),
      ),
    });
  }
  return parts;
}

const sum = (parts: RepayPart[]): RepayQuote => {
  const principal = parts.reduce((s, x) => s + x.principal, 0n);
  const fee = parts.reduce((s, x) => s + x.lateFee, 0n);
  return { principal, lateFee: fee, total: principal + fee, parts };
};

const openOf = (view: CircleView, member: Address): ShortfallView[] =>
  view.rounds
    .flatMap((r) => r.shortfalls)
    .filter((s) => s.member.toLowerCase() === member.toLowerCase() && !s.resolved)
    .sort((a, b) => a.round - b.round);

/**
 * `payLate(round)`: the whole open principal of that round's shortfall. `repayDebt(principal)`: pass `principal`
 * (capped at what is owed) and no `round`.
 */
export function quoteRepay(
  view: CircleView,
  member: Address,
  nowSec: number,
  opts: { round?: number; principal?: bigint } = {},
): RepayQuote {
  const open = openOf(view, member);
  if (opts.round !== undefined) {
    const sf = open.find((s) => s.round === opts.round);
    return sf ? sum(restore(view, sf, sf.uncovered + sf.fromReserve + sf.fromBond + sf.fromHoldback, nowSec)) : sum([]);
  }
  let budget = opts.principal ?? open.reduce((s, x) => s + x.uncovered + x.fromReserve + x.fromBond + x.fromHoldback, 0n);
  const parts: RepayPart[] = [];
  for (const sf of open) {
    if (budget <= 0n) break;
    const got = restore(view, sf, budget, nowSec);
    budget -= got.reduce((s, x) => s + x.principal, 0n);
    parts.push(...got);
  }
  return sum(parts);
}
