/**
 * HuiMath in bigint (docs/03 section 2, docs/05 section 3.5).
 *
 * Mirrors `contracts/src/libraries/HuiMath.sol` and `sim/huisim/math.py` unit for
 * unit: same names (camelCase), same parameter order, multiply first and divide
 * last, floor division. USDC has 6 decimals, rates are basis points (10_000 = 100%).
 *
 * Inputs must be non-negative and every value must fit in uint256; otherwise a
 * RangeError is thrown (Solidity would revert with a panic).
 */

export const BPS = 10_000n;
export const DAY = 86_400n;
export const YEAR = 365n * DAY;
export const UINT256_MAX = 2n ** 256n - 1n;

function u(value: bigint): bigint {
  if (value < 0n) throw new RangeError(`negative value ${value}`);
  if (value > UINT256_MAX) throw new RangeError(`value ${value} exceeds uint256`);
  return value;
}

function assertU(...values: bigint[]): void {
  for (const value of values) u(value);
}

/** O(k) = k * (n - k) * c: unpaid obligations after round k (exact). */
export function exposure(n: bigint, k: bigint, c: bigint): bigint {
  assertU(n, k, c);
  if (k > n) throw new RangeError('k > n');
  return u(k * (n - k) * c);
}

/** O_max = floor(n/2) * ceil(n/2) * c (exact; peak at k = floor(n/2)). */
export function maxExposure(n: bigint, c: bigint): bigint {
  assertU(n, c);
  const half = n / 2n;
  return u(half * (n - half) * c);
}

/** Holdback of the round-k winner: alpha * (n - k) * c / 10_000, rounded down. */
export function holdbackFor(alphaBps: bigint, n: bigint, k: bigint, c: bigint): bigint {
  assertU(alphaBps, n, k, c);
  if (k > n) throw new RangeError('k > n');
  return u(alphaBps * (n - k) * c) / BPS;
}

/** Holdback released per on-time round: alpha * c / 10_000, rounded down. */
export function releasePerRound(alphaBps: bigint, c: bigint): bigint {
  assertU(alphaBps, c);
  return u(alphaBps * c) / BPS;
}

/**
 * min(10_000, alpha + (bond + reserve) * 10_000 / O_max), division rounded down.
 * Throws when O_max == 0.
 */
export function coverageIndexBps(
  alphaBps: bigint,
  bond: bigint,
  reserve: bigint,
  n: bigint,
  c: bigint,
): bigint {
  assertU(alphaBps, bond, reserve);
  const oMax = maxExposure(n, c);
  if (oMax === 0n) throw new RangeError('max exposure is zero');
  const value = alphaBps + u((bond + reserve) * BPS) / oMax;
  return value < BPS ? value : BPS;
}

/**
 * Bid ceiling of round k (ND 19 Article 21, proposed reading, docs/03 section 2.4):
 * capBps * (n-k) * c * (n-k) * periodSec / (10_000 * 365 days * payers), one
 * division rounded down, then capped at c - 1. `payers == 0` gives 0.
 */
export function maxBid(
  capBps: bigint,
  n: bigint,
  k: bigint,
  c: bigint,
  periodSec: bigint,
  payers: bigint,
): bigint {
  assertU(capBps, n, k, c, periodSec, payers);
  if (k > n) throw new RangeError('k > n');
  if (payers === 0n) return 0n;
  const remaining = n - k;
  const raw = u(capBps * remaining * c * remaining * periodSec) / (BPS * YEAR * payers);
  const cap = c > 0n ? c - 1n : 0n;
  return raw < cap ? raw : cap;
}

/**
 * Late-payment interest (ND 19 Article 22 clause 1, docs/03 section 2.5):
 * amount * lateRateBps * elapsedSec * (periodSec / roundDuration) / (10_000 * 365 days).
 * The timeScale ratio is folded into the single final division. Rounded down.
 */
export function lateFee(
  amount: bigint,
  lateRateBps: bigint,
  elapsedSec: bigint,
  periodSec: bigint,
  roundDuration: bigint,
): bigint {
  assertU(amount, lateRateBps, elapsedSec, periodSec, roundDuration);
  if (roundDuration === 0n) throw new RangeError('roundDuration is zero');
  return u(amount * lateRateBps * elapsedSec * periodSec) / (BPS * YEAR * roundDuration);
}

/** amount * bps / 10_000, rounded down. */
export function bpsOf(amount: bigint, bps: bigint): bigint {
  assertU(amount, bps);
  return u(amount * bps) / BPS;
}
