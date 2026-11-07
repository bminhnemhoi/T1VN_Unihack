"""HuiMath in Python: numbers of docs/03 section 8 plus seeded property tests."""

import numpy as np
import pytest

from huisim import math as hm
from huisim.math import (
    BPS,
    DAY,
    USDC,
    bps_of,
    coverage_index_bps,
    exposure,
    holdback_for,
    late_fee,
    max_bid,
    max_exposure,
    release_per_round,
)

P30 = 30 * DAY
N, C = 5, 100 * USDC
ALPHA, CAP = 2000, 2000


# --- docs/03 section 8: worked example (C = 100 USDC) and the scaled C = 10 variant -----


def test_max_bid_table_k1_to_k5() -> None:
    got = [max_bid(CAP, N, k, C, P30, N - k) for k in range(1, 6)]
    assert got == [6_575_342, 4_931_506, 3_287_671, 1_643_835, 0]


def test_max_bid_case_where_last_round_has_no_payers() -> None:
    assert max_bid(CAP, N, 5, C, P30, 0) == 0
    assert max_bid(CAP, N, 1, C, P30, 0) == 0


def test_max_bid_judgment_48_2024_tay_ninh() -> None:
    # 25 shares x 2,000,000 VND, round 5, 20 live payers, monthly: ceiling ~657,534 > 450,000
    ceiling = max_bid(CAP, 25, 5, 2_000_000, P30, 20)
    assert ceiling == 657_534
    assert ceiling > 450_000


def test_coverage_index_100_percent_with_bond_480() -> None:
    assert max_exposure(N, C) == 600 * USDC
    assert coverage_index_bps(ALPHA, 480 * USDC, 0, N, C) == 10_000
    assert coverage_index_bps(ALPHA, 0, 0, N, C) == ALPHA  # bond 0 gives exactly alpha
    assert coverage_index_bps(ALPHA, 479 * USDC, 0, N, C) < 10_000


def test_round_1_m4_receives_288_48() -> None:
    bid = 6 * USDC
    pot = (N - 1) * (C - bid)
    assert pot == 376 * USDC
    fee = bps_of(pot, 100)
    premium = bps_of(pot, 100)
    holdback = holdback_for(ALPHA, N, 1, C)
    assert (fee, premium, holdback) == (3_760_000, 3_760_000, 80 * USDC)
    assert pot - fee - premium - holdback == 288_480_000
    assert bid <= max_bid(CAP, N, 1, C, P30, N - 1)


def test_round_2_m1_receives_323_18_and_bond_covers_m4() -> None:
    bid = 3 * USDC
    shortfall = C  # M4 fails to pay 100
    from_holdback = holdback_for(ALPHA, N, 1, C)  # 80 held back from M4 in round 1
    from_bond = shortfall - from_holdback
    assert (from_holdback, from_bond) == (80 * USDC, 20 * USDC)
    assert 480 * USDC - from_bond == 460 * USDC
    pot = 3 * (C - bid) + shortfall
    assert pot == 391 * USDC
    fee, premium = bps_of(pot, 100), bps_of(pot, 100)
    assert (fee, premium) == (3_910_000, 3_910_000)
    # reserve accumulates 3.76 + 3.91
    assert bps_of(376 * USDC, 100) + premium == 7_670_000
    holdback = holdback_for(ALPHA, N, 2, C)
    assert holdback == 60 * USDC
    assert pot - fee - premium - holdback == 323_180_000
    assert bid <= max_bid(CAP, N, 2, C, P30, N - 2)


def test_branch_a_total_holdback_equals_alpha_times_exposure() -> None:
    # After M4 pays late in round 2: M4 holds 60, M1 holds 60 = alpha * O(2).
    total = 2 * holdback_for(ALPHA, N, 2, C)
    assert total == 120 * USDC == bps_of(exposure(N, 2, C), ALPHA)


def test_branch_a_late_fee_one_nominal_day() -> None:
    assert late_fee(C, 1000, DAY, P30, P30) == 27_397
    assert late_fee(C, 1000, 6, P30, 180) == 27_397  # demo: 6 real seconds, 180 s rounds


def test_branch_b_bond_runs_down_to_160_and_m4_shortfall_is_400() -> None:
    bond = 480 * USDC - 20 * USDC  # after round 2
    for _ in range(3):  # rounds 3, 4, 5: M4's 100 is covered by the bond
        bond -= C
    assert bond == 160 * USDC
    assert 4 * C == 400 * USDC
    assert 80 * USDC + 320 * USDC == 4 * C  # holdback + bond


def test_scaled_c_10_usdc_variant() -> None:
    c = 10 * USDC
    assert max_exposure(N, c) == 60 * USDC
    assert coverage_index_bps(ALPHA, 48 * USDC, 0, N, c) == 10_000
    bid1 = 600_000  # 0.6 USDC
    assert bid1 <= max_bid(CAP, N, 1, c, P30, N - 1)
    pot1 = (N - 1) * (c - bid1)
    payout1 = pot1 - bps_of(pot1, 100) * 2 - holdback_for(ALPHA, N, 1, c)
    assert payout1 == 28_848_000
    bid2 = 300_000
    pot2 = 3 * (c - bid2) + c
    payout2 = pot2 - bps_of(pot2, 100) * 2 - holdback_for(ALPHA, N, 2, c)
    assert payout2 == 32_318_000
    assert 48 * USDC - 2 * USDC - 3 * c == 16 * USDC  # branch B: bond left 16 USDC


# --- docs/09 section 4.1 unit cases ------------------------------------------------------


def test_exposure_cases() -> None:
    assert exposure(N, 0, C) == 0
    assert exposure(N, N, C) == 0
    assert max_exposure(N, C) == 600 * USDC
    assert max_exposure(10, C) == 25 * C
    assert max_exposure(3, C) == 2 * C  # floor(3/2) * ceil(3/2) = 1 * 2
    for k in range(N + 1):
        assert exposure(N, k, C) == exposure(N, N - k, C)


def test_holdback_and_release() -> None:
    assert holdback_for(ALPHA, N, 1, C) == 80 * USDC
    assert holdback_for(ALPHA, N, N, C) == 0
    assert release_per_round(ALPHA, C) == 20 * USDC


def test_coverage_is_clamped_to_10000() -> None:
    assert coverage_index_bps(ALPHA, 10_000 * USDC, 10_000 * USDC, N, C) == 10_000
    assert coverage_index_bps(10_000, 0, 0, N, C) == 10_000


def test_bps_of_rounds_down() -> None:
    assert bps_of(376 * USDC, 100) == 3_760_000
    assert bps_of(1, 9_999) == 0
    assert bps_of(9_999, 1) == 0
    assert bps_of(10_000, 1) == 1


def test_rounding_is_floor_everywhere() -> None:
    assert holdback_for(1, 3, 1, 1) == 0  # 1*2*1/10000
    assert max_bid(1, 3, 1, 10**6, DAY, 2) == (1 * 2 * 10**6 * 2 * DAY) // (BPS * 365 * DAY * 2)
    assert late_fee(1, 1, 1, DAY, 31 * DAY) == 0


def test_max_bid_never_reaches_c() -> None:
    assert max_bid(10_000, 30, 1, USDC, 31 * DAY, 1) == USDC - 1


def test_inputs_are_validated() -> None:
    with pytest.raises(ValueError):
        exposure(5, 6, C)
    with pytest.raises(ValueError):
        holdback_for(ALPHA, 5, 6, C)
    with pytest.raises(ValueError):
        max_bid(CAP, 5, 6, C, P30, 1)
    with pytest.raises(ValueError):
        exposure(5, -1, C)
    with pytest.raises(ValueError):
        late_fee(C, 1000, 1, P30, 0)
    with pytest.raises(ValueError):
        coverage_index_bps(ALPHA, 1, 1, 5, 0)
    with pytest.raises(OverflowError):
        bps_of(2**256, 1)
    with pytest.raises(OverflowError):
        exposure(2**128, 2**64, 2**128)


# --- property tests (fixed seed) ---------------------------------------------------------

SEED = 20260507
TRIALS = 400


def _rng() -> np.random.Generator:
    return np.random.default_rng(SEED)


def _c(rng: np.random.Generator) -> int:
    return int(rng.integers(USDC, 10_000 * USDC, endpoint=True))


def test_property_exposure() -> None:
    rng = _rng()
    for _ in range(TRIALS):
        n = int(rng.integers(3, 30, endpoint=True))
        k = int(rng.integers(0, n, endpoint=True))
        c = _c(rng)
        assert exposure(n, k, c) == exposure(n, n - k, c)
        assert exposure(n, k, c) <= max_exposure(n, c)
        assert max_exposure(n, c) == exposure(n, n // 2, c)
        assert max_exposure(n, c) == max(exposure(n, j, c) for j in range(n + 1))


def test_property_holdback_matches_alpha_times_exposure() -> None:
    """INV-06 consequence: m * holdbackFor == alpha * O(m) up to rounding (<= m units)."""
    rng = _rng()
    for _ in range(TRIALS):
        n = int(rng.integers(3, 30, endpoint=True))
        m = int(rng.integers(0, n, endpoint=True))
        alpha = int(rng.integers(0, BPS, endpoint=True))
        c = _c(rng)
        total = m * holdback_for(alpha, n, m, c)
        exact = bps_of(exposure(n, m, c), alpha)
        assert 0 <= exact - total <= n
        assert holdback_for(alpha, n, m, c) >= holdback_for(alpha, n, min(m + 1, n), c)
        assert release_per_round(alpha, c) <= c


def test_property_coverage_bounds_and_monotonicity() -> None:
    rng = _rng()
    for _ in range(TRIALS):
        n = int(rng.integers(3, 30, endpoint=True))
        c = _c(rng)
        alpha = int(rng.integers(0, BPS, endpoint=True))
        o_max = max_exposure(n, c)
        bond = int(rng.integers(0, 2 * o_max, endpoint=True))
        extra = int(rng.integers(0, o_max, endpoint=True))
        reserve = int(rng.integers(0, o_max, endpoint=True))
        base = coverage_index_bps(alpha, bond, reserve, n, c)
        assert alpha <= base <= BPS or alpha > BPS
        assert coverage_index_bps(alpha, bond + extra, reserve, n, c) >= base
        assert coverage_index_bps(alpha, bond, reserve + extra, n, c) >= base
        # full guarantee: B = (1 - alpha) * O_max reaches 10_000 (docs/03 section 2.3)
        full_bond = o_max - bps_of(o_max, alpha) + 1
        assert coverage_index_bps(alpha, full_bond, 0, n, c) == BPS


def test_property_max_bid() -> None:
    rng = _rng()
    for _ in range(TRIALS):
        n = int(rng.integers(3, 30, endpoint=True))
        k = int(rng.integers(1, n, endpoint=True))
        c = _c(rng)
        period = int(rng.integers(DAY, 31 * DAY, endpoint=True))
        payers = int(rng.integers(1, n, endpoint=True))
        cap = int(rng.integers(0, 2000, endpoint=True))
        bid = max_bid(cap, n, k, c, period, payers)
        assert 0 <= bid <= c - 1
        assert max_bid(cap + 1, n, k, c, period, payers) >= bid  # monotone in cap
        assert max_bid(cap, n, k, c, period + DAY, payers) >= bid  # monotone in period
        assert max_bid(cap, n, k, c, period, payers + 1) <= bid  # more payers, lower ceiling
        assert max_bid(cap, n, k, c, period, 0) == 0
        assert max_bid(cap, n, n, c, period, payers) == 0  # nothing left to repay


def test_property_late_fee() -> None:
    rng = _rng()
    for _ in range(TRIALS):
        amount = int(rng.integers(0, 30 * 10_000 * USDC, endpoint=True))
        rate = int(rng.integers(0, 2000, endpoint=True))
        elapsed = int(rng.integers(0, 400 * DAY, endpoint=True))
        period = int(rng.integers(DAY, 31 * DAY, endpoint=True))
        duration = int(rng.integers(120, period, endpoint=True))
        fee = late_fee(amount, rate, elapsed, period, duration)
        assert fee >= 0
        assert late_fee(amount, rate, elapsed + 1, period, duration) >= fee
        assert late_fee(amount + 1, rate, elapsed, period, duration) >= fee
        assert late_fee(amount, rate, elapsed, period, period) == (
            amount * rate * elapsed // (BPS * 365 * DAY)
        )


def test_property_bps_of() -> None:
    rng = _rng()
    for _ in range(TRIALS):
        amount = int(rng.integers(0, 30 * 10_000 * USDC, endpoint=True))
        bps = int(rng.integers(0, BPS, endpoint=True))
        assert bps_of(amount, BPS) == amount
        assert bps_of(amount, 0) == 0
        assert bps_of(amount, bps) <= amount
        assert amount * bps - BPS < bps_of(amount, bps) * BPS <= amount * bps


def test_module_constants() -> None:
    assert hm.YEAR == 365 * 86_400 == 31_536_000
    assert hm.USDC == 1_000_000
