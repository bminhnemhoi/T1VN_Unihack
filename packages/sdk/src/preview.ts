/**
 * Live numbers for the create-circle form (docs/02 US-01, AC-01.1 to AC-01.4).
 * Pure functions over `huiMath`; the browser and tests use the same code.
 */
import { BPS, coverageIndexBps, maxBid, maxExposure } from './huiMath';

export const DAY_SECONDS = 86_400n;
export const MIN_COVERAGE_BPS = 5_000n;

export interface PreviewInput {
  n: bigint;
  /** Contribution C in USDC base units. */
  c: bigint;
  periodDays: bigint;
  alphaBps: bigint;
  /** Bond in USDC base units. */
  bond: bigint;
  capBps: bigint;
}

export interface BidRow {
  k: number;
  payers: number;
  maxBid: bigint;
}

export interface Preview {
  maxExposure: bigint;
  /** Coverage index with reserve = 0 (guaranteed minimum). */
  coverageBps: bigint;
  /** Bond giving 100% coverage: (1 - alpha) * O_max, rounded up. */
  bondFor100: bigint;
  /** Bond giving the 50% minimum to activate, rounded up (0 if alpha alone suffices). */
  bondForMin: bigint;
  /** Extra bond still needed to activate (0 when coverage >= 50%). */
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
  const bondForMin = nonNeg(ceilDiv((MIN_COVERAGE_BPS - i.alphaBps) * oMax, BPS));
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
    maxExposure: oMax,
    coverageBps,
    bondFor100,
    bondForMin,
    bondMissing,
    canActivate: coverageBps >= MIN_COVERAGE_BPS,
    bidRows,
  };
}
