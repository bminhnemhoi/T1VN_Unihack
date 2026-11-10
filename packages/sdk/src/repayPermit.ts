/**
 * Permit for `payLate` / `repayDebt` (docs/05 section 8.2b, M-02 option (a)). `payLate` and `repayDebt` pull with
 * `transferFrom`, so the allowance must cover what they pull AND the contributions still to come. A permit SETS the
 * allowance (it does not add), hence the value is the total need, not just the debt:
 *
 *   value = principal still owed + late fee (worst case, at the quote time)
 *         + (rounds not settled yet) x (C + reveal bond when the circle bids)
 *
 * The result is capped at 2 x requiredAllowance, the ceiling `/api/relay/permit` accepts.
 */
import { quoteRepay, type RepayQuote } from './repay';
import { signPermit, type PermitArg, type SignContext } from './sign';
import type { CircleView } from './view';

type Address = `0x${string}`;

export interface RepayPermitQuote {
  quote: RepayQuote;
  /** Contributions (and reveal bonds) still to be pulled after this payment, worst case. */
  futureContributions: bigint;
  /** The allowance to sign, USDC base units: what the UI shows as "số USDC sẽ được cấp". */
  value: bigint;
}

/** Allowance needed to repay and still afford the rest of the circle. `nowSec` should include the request lifetime. */
export function repayPermitQuote(
  view: CircleView,
  member: Address,
  nowSec: number,
  opts: { round?: number; principal?: bigint } = {},
): RepayPermitQuote {
  const quote = quoteRepay(view, member, nowSec, opts);
  const remaining = BigInt(Math.max(0, view.params.N - view.settledRounds));
  const perRound = view.params.C + (view.mode === 'bidding' ? (view.revealBond ?? 0n) : 0n);
  const futureContributions = remaining * perRound;
  const cap = 2n * view.requiredAllowance;
  const need = quote.total + futureContributions;
  return { quote, futureContributions, value: need > cap ? cap : need };
}

/** Quote and sign the permit in one step; the caller sends it to `/api/relay/permit` (`relayPermit`). */
export async function signRepayPermit(
  ctx: SignContext,
  usdc: Address,
  view: CircleView,
  nowSec: number,
  opts: { round?: number; principal?: bigint } = {},
  /** Permit deadline, Unix seconds; the server accepts at most one hour ahead of chain time. */
  deadlineSec: bigint,
): Promise<RepayPermitQuote & { permit: PermitArg; owner: Address }> {
  const owner = ctx.signer?.address ?? ctx.account?.address;
  if (!owner) throw new Error('SignContext needs a signer or an account');
  const q = repayPermitQuote(view, owner, nowSec, opts);
  const permit = await signPermit(ctx, usdc, view.address, q.value, deadlineSec);
  return { ...q, permit, owner };
}
