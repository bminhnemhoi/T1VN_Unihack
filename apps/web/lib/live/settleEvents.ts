/**
 * Closing the books (S12, ADR-28 vector V6) rebuilt from the circle's own events: for every member the interest on bids
 * they received and paid, the on-time reward (`ReserveShared`) and the holdback paid back; for the organizer the commission
 * paid at once (`FeePaid`) and the part that waited for `finalize`. Pure. Only money that moved to or from the wallet through
 * these events is counted, so a circle with defaults gets an honest summary of what moved, not a model of what should have.
 */
import type { CircleEvent } from 'sdk';

const big = (v: unknown): bigint => (typeof v === 'bigint' ? v : BigInt(String(v ?? 0)));
const key = (v: unknown): string => String(v ?? '').toLowerCase();

export interface MemberSettle {
  address: string;
  /** Round this member took the pot, 0 if none. */
  round: number;
  /** Everything paid in: contributions, late payments with their late fee, debt repayments. */
  paid: bigint;
  /** Pot received (`RoundSettled.payout`). */
  received: bigint;
  /** Holdback paid back, per round and at `finalize` (`HoldbackReleased`). */
  holdbackBack: bigint;
  /** Discounts on contributions while this member was still waiting: sum of (C - pulled). */
  interestReceived: bigint;
  /** Discounts the others got when this member took the pot. */
  interestPaid: bigint;
  /** On-time reward from the reserve (`ReserveShared`); 0 before `finalize`. */
  reward: bigint;
  /** Weight the reward was split by (ADR-24); undefined before `finalize`. */
  weight?: number;
  net: bigint;
}

export interface OrganizerSettle {
  /** Commission paid the moment each clean round settled (`FeePaid`). */
  feePaidNow: bigint;
  /** Commission that waited in escrow until `finalize` (`CircleFinalized.feesPaid`). */
  feeAtFinalize: bigint;
  /** Commission lost to the reserve because a member defaulted (`FeeForfeited`). */
  feeForfeited: bigint;
  bondReturned: bigint;
}

export interface LiveSettle {
  members: MemberSettle[];
  organizer: OrganizerSettle;
  /** Reserve split at the end (`CircleFinalized.reserveDistributed`). */
  reserveTotal: bigint;
  finalized: boolean;
}

export function settleFromEvents(events: CircleEvent[], contribution: bigint, memberAddresses: string[]): LiveSettle {
  const rows = new Map<string, MemberSettle>(
    memberAddresses.map((a) => [key(a), { address: a, round: 0, paid: 0n, received: 0n, holdbackBack: 0n, interestReceived: 0n, interestPaid: 0n, reward: 0n, net: 0n }]),
  );
  const winnerOf = new Map<number, string>();
  const discountOfRound = new Map<number, bigint>();
  const org: OrganizerSettle = { feePaidNow: 0n, feeAtFinalize: 0n, feeForfeited: 0n, bondReturned: 0n };
  let reserveTotal = 0n;
  let finalized = false;

  for (const e of events) {
    const a = e.args;
    const row = rows.get(key(a.member));
    switch (e.eventName) {
      case 'ContributionPulled': {
        const amount = big(a.amount);
        if (row) row.paid += amount;
        if (amount < contribution) {
          const d = contribution - amount;
          if (row) row.interestReceived += d;
          const r = Number(a.round ?? 0);
          discountOfRound.set(r, (discountOfRound.get(r) ?? 0n) + d);
        }
        break;
      }
      case 'LatePaid':
        if (row) row.paid += big(a.amount) + big(a.lateFee);
        break;
      case 'DebtRepaid':
        if (row) row.paid += big(a.principal) + big(a.lateFee);
        break;
      case 'RoundSettled': {
        const w = rows.get(key(a.winner));
        const r = Number(a.round ?? 0);
        winnerOf.set(r, key(a.winner));
        if (w) {
          w.received += big(a.payout);
          w.round = r;
        }
        break;
      }
      case 'HoldbackReleased':
        if (row) row.holdbackBack += big(a.amount);
        break;
      case 'ReserveShared':
        if (row) {
          row.reward += big(a.amount);
          row.weight = Number(a.weight ?? 0);
        }
        break;
      case 'FeePaid':
        org.feePaidNow += big(a.amount);
        break;
      case 'FeeForfeited':
        org.feeForfeited += big(a.amount);
        break;
      case 'CircleFinalized':
        org.feeAtFinalize = big(a.feesPaid);
        org.bondReturned = big(a.bondReturned);
        reserveTotal = big(a.reserveDistributed);
        finalized = true;
        break;
      default:
        break;
    }
  }
  for (const [r, w] of winnerOf) {
    const row = rows.get(w);
    if (row) row.interestPaid += discountOfRound.get(r) ?? 0n;
  }
  const members = [...rows.values()];
  for (const m of members) m.net = m.received + m.holdbackBack + m.reward - m.paid;
  return { members, organizer: org, reserveTotal, finalized };
}
