import { huiMath, parseUsdc } from 'sdk';

/**
 * Numbers behind the three playable cards of the landing page. Everything is the worked example of docs/03 section 8
 * (N = 5, C = 100 USDC, P = 30 days, alpha 20%, fee 1% fixed, reserve 1%, bond 480) computed with the same `huiMath`
 * the contract is differentially tested against, so the landing can never drift from the protocol.
 */
const C = 100_000_000n;
const N = 5n;
const PERIOD = 30n * huiMath.DAY;
const CAP_BPS = 2000n;
const ALPHA_BPS = 2000n;
const FEE_BPS = 100n;
const RESERVE_BPS = 100n;
/** Fuji refuses to start a circle under 100% coverage (ADR-22). */
export const MIN_COVERAGE_BPS = 10_000n;
export const WORKED_BOND = 480_000_000n;

/** Round 1: 4 payers, statutory bid ceiling 6,575342 USDC. */
export const ROUND1_BID_CAP = huiMath.maxBid(CAP_BPS, N, 1n, C, PERIOD, N - 1n);

export type Round1Quote =
  | { ok: true; bid: bigint; pot: bigint; cut: bigint; holdback: bigint; payout: bigint }
  | { ok: false; reason: 'format' | 'cap' };

/** What the round-1 winner receives at once for a given bid (docs/03 section 8, round 1 table). */
export function quoteRound1(input: string): Round1Quote {
  const bid = parseUsdc(input);
  if (bid === undefined) return { ok: false, reason: 'format' };
  if (bid > ROUND1_BID_CAP) return { ok: false, reason: 'cap' };
  const pot = (N - 1n) * (C - bid);
  const cut = huiMath.bpsOf(pot, FEE_BPS) + huiMath.bpsOf(pot, RESERVE_BPS);
  const holdback = huiMath.holdbackFor(ALPHA_BPS, N, 1n, C);
  return { ok: true, bid, pot, cut, holdback, payout: pot - cut - holdback };
}

/**
 * Round 2: M1 wins with a bid of 3 USDC. When M4 (who took round 1) does not pay, the cascade covers the 100 USDC from
 * M4's own holdback first, then from the organiser's bond (docs/03 section 6.5 step 4). The winner is paid the same.
 */
export function cascadeRound2(m4Defaults: boolean) {
  const bid = 3_000_000n;
  const m4Due = C;
  const m4Holdback = huiMath.holdbackFor(ALPHA_BPS, N, 1n, C);
  const fromHoldback = m4Defaults ? (m4Holdback < m4Due ? m4Holdback : m4Due) : 0n;
  const fromBond = m4Defaults ? m4Due - fromHoldback : 0n;
  const pot = 3n * (C - bid) + m4Due;
  const cut = huiMath.bpsOf(pot, FEE_BPS) + huiMath.bpsOf(pot, RESERVE_BPS);
  const holdback = huiMath.holdbackFor(ALPHA_BPS, N, 2n, C);
  return { livePays: C - bid, m4Due, fromHoldback, fromBond, bondLeft: WORKED_BOND - fromBond, pot, payout: pot - cut - holdback };
}

/** Coverage index of an N-member circle at C = 100 USDC, alpha 20%, no reserve yet (the number shown before joining). */
export function coverage(members: number, bondUsdc: number) {
  const n = BigInt(members);
  const bond = BigInt(bondUsdc) * 1_000_000n;
  const bps = huiMath.coverageIndexBps(ALPHA_BPS, bond, 0n, n, C);
  return { bps, canStart: bps >= MIN_COVERAGE_BPS };
}
