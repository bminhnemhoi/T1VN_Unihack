"""HuiMath in pure integer arithmetic (docs/03 section 2, docs/05 section 3.5).

Every function mirrors ``contracts/src/libraries/HuiMath.sol`` and
``packages/sdk/src/huiMath.ts`` unit for unit: same name (snake_case here),
same parameter order, multiply first and divide last, floor division. USDC has
6 decimals, rates are basis points (10_000 = 100%).

Python ints are unbounded while Solidity uses uint256. Inputs must be
non-negative and every intermediate must fit in uint256; otherwise
``OverflowError`` is raised (Solidity would revert with a panic).
"""

from __future__ import annotations

BPS: int = 10_000
DAY: int = 86_400
YEAR: int = 365 * DAY
USDC: int = 1_000_000
UINT256_MAX: int = 2**256 - 1


def _u(value: int) -> int:
    """Return ``value`` if it is a valid uint256, else raise."""
    if value < 0:
        raise ValueError(f"negative value {value}")
    if value > UINT256_MAX:
        raise OverflowError(f"value {value} exceeds uint256")
    return value


def exposure(n: int, k: int, c: int) -> int:
    """O(k) = k * (n - k) * c: unpaid obligations after round k (exact)."""
    _u(n), _u(k), _u(c)
    if k > n:
        raise ValueError("k > n")
    return _u(k * (n - k) * c)


def max_exposure(n: int, c: int) -> int:
    """O_max = floor(n/2) * ceil(n/2) * c (exact; peak at k = floor(n/2))."""
    _u(n), _u(c)
    half = n // 2
    return _u(half * (n - half) * c)


def holdback_for(alpha_bps: int, n: int, k: int, c: int) -> int:
    """Holdback of the round-k winner: alpha * (n - k) * c / 10_000, rounded down."""
    _u(alpha_bps), _u(n), _u(k), _u(c)
    if k > n:
        raise ValueError("k > n")
    return _u(alpha_bps * (n - k) * c) // BPS


def release_per_round(alpha_bps: int, c: int) -> int:
    """Holdback released per on-time round: alpha * c / 10_000, rounded down."""
    _u(alpha_bps), _u(c)
    return _u(alpha_bps * c) // BPS


def coverage_index_bps(alpha_bps: int, bond: int, reserve_: int, n: int, c: int) -> int:
    """min(10_000, alpha + (bond + reserve_) * 10_000 / O_max).

    The division is rounded down. Reverts (ValueError) when O_max == 0.
    """
    _u(alpha_bps), _u(bond), _u(reserve_)
    o_max = max_exposure(n, c)
    if o_max == 0:
        raise ValueError("max exposure is zero")
    return min(BPS, alpha_bps + _u((bond + reserve_) * BPS) // o_max)


def max_bid(cap_bps: int, n: int, k: int, c: int, period_sec: int, payers: int) -> int:
    """Bid ceiling of round k (ND 19 Article 21, proposed reading, docs/03 section 2.4).

    capBps * (n-k) * c * (n-k) * periodSec / (10_000 * 365 days * payers), one
    division rounded down, then capped at c - 1. ``payers == 0`` gives 0.
    """
    _u(cap_bps), _u(n), _u(k), _u(c), _u(period_sec), _u(payers)
    if k > n:
        raise ValueError("k > n")
    if payers == 0:
        return 0
    remaining = n - k
    raw = _u(cap_bps * remaining * c * remaining * period_sec) // (BPS * YEAR * payers)
    return min(raw, c - 1 if c > 0 else 0)


def late_fee(
    amount: int,
    late_rate_bps: int,
    elapsed_sec: int,
    period_sec: int,
    round_duration: int,
) -> int:
    """Late-payment interest (ND 19 Article 22 clause 1, docs/03 section 2.5).

    amount * lateRateBps * elapsedSec * (periodSec / roundDuration) /
    (10_000 * 365 days): the timeScale ratio is folded into the single final
    division so nothing is lost to early rounding. Rounded down.
    """
    _u(amount), _u(late_rate_bps), _u(elapsed_sec), _u(period_sec), _u(round_duration)
    if round_duration == 0:
        raise ValueError("round_duration is zero")
    return _u(amount * late_rate_bps * elapsed_sec * period_sec) // (BPS * YEAR * round_duration)


def bps_of(amount: int, bps: int) -> int:
    """amount * bps / 10_000, rounded down."""
    _u(amount), _u(bps)
    return _u(amount * bps) // BPS
