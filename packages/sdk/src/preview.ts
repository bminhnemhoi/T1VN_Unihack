/**
 * Live numbers for the create-circle form (docs/02 US-01, AC-01.1 to AC-01.4).
 * Pure functions over `huiMath`; the browser and tests use the same code.
 */
import { BPS, coverageIndexBps, maxBid, maxExposure } from './huiMath';

export const DAY_SECONDS = 86_400n;
/**
 * Activation floor of the Fuji deployment (ADR-22, `minCoverageBps = 10000`). Only a fallback for sample data and for
 * the moment before the chain answers: the real floor is read from the circle (`minCoverageBps()`) or from
 * `factory.config()` and passed to `previewCircle`.
 */
export const DEFAULT_MIN_COVERAGE_BPS = 10_000n;

export interface PreviewInput {
  n: bigint;
  /** Contribution C in USDC base units. */
  c: bigint;
  periodDays: bigint;
  alphaBps: bigint;
  /** Bond in USDC base units. */
  bond: bigint;
  capBps: bigint;
  /** Activation floor in bps, read from the chain (circle or factory config). */
  minCoverageBps: bigint;
}

export interface BidRow {
  k: number;
  payers: number;
  maxBid: bigint;
}

export interface Preview {
  /** The floor this preview was computed against, so screens print the same number the contract enforces. */
  minCoverageBps: bigint;
  maxExposure: bigint;
  /** Coverage index with reserve = 0 (guaranteed minimum). */
  coverageBps: bigint;
  /** Bond giving 100% coverage: (1 - alpha) * O_max, rounded up. */
  bondFor100: bigint;
  /** Bond giving the activation floor (`minCoverageBps`), rounded up (0 if alpha alone suffices). */
  bondForMin: bigint;
  /** Extra bond still needed to activate (0 when coverage >= the floor). */
  bondMissing: bigint;
  canActivate: boolean;
  /** Round ceilings k = 1..N, nobody frozen (payers = N - k). */
  bidRows: BidRow[];
}

const ceilDiv = (a: bigint, b: bigint): bigint => (a + b - 1n) / b;
const nonNeg = (a: bigint): bigint => (a < 0n ? 0n : a);

/** Throws RangeError for inputs `huiMath` rejects (n < 2 gives zero exposure). Validate before calling. */
export function previewCircle(i: PreviewInput): Preview {
  const oMax = maxExposure(i.n, i.c);
  const coverageBps = coverageIndexBps(i.alphaBps, i.bond, 0n, i.n, i.c);
  const bondFor100 = nonNeg(ceilDiv((BPS - i.alphaBps) * oMax, BPS));
  const bondForMin = nonNeg(ceilDiv((i.minCoverageBps - i.alphaBps) * oMax, BPS));
  const bondMissing = nonNeg(bondForMin - i.bond);
  const periodSec = i.periodDays * DAY_SECONDS;
  const bidRows: BidRow[] = [];
  for (let k = 1n; k <= i.n; k++) {
    const payers = i.n - k;
    bidRows.push({
      k: Number(k),
      payers: Number(payers),
      maxBid: maxBid(i.capBps, i.n, k, i.c, periodSec, payers),
    });
  }
  return {
    minCoverageBps: i.minCoverageBps,
    maxExposure: oMax,
    coverageBps,
    bondFor100,
    bondForMin,
    bondMissing,
    canActivate: coverageBps >= i.minCoverageBps,
    bidRows,
  };
}
