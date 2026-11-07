// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";

/// @notice Property tests for HuiMath over the documented domain of docs/03 section 3.1:
/// N in [3, 30], C in [1, 10_000] USDC, P in [1, 31] days, bps in [0, 10_000].
contract HuiMathFuzzTest is Test {
    uint256 internal constant USDC = 1e6;
    uint256 internal constant MAX_C = 10_000 * USDC;

    function _n(uint256 n) internal pure returns (uint256) {
        return bound(n, 3, 30);
    }

    function _c(uint256 c) internal pure returns (uint256) {
        return bound(c, 1 * USDC, MAX_C);
    }

    // ------------------------------------------------------------ exposure

    function testFuzz_Exposure_NeverAboveMax(uint256 n, uint256 k, uint256 c) public pure {
        n = _n(n);
        c = _c(c);
        k = bound(k, 0, n);
        assertLe(HuiMath.exposure(n, k, c), HuiMath.maxExposure(n, c));
    }

    function testFuzz_Exposure_PeakAtHalf(uint256 n, uint256 c) public pure {
        n = _n(n);
        c = _c(c);
        assertEq(HuiMath.exposure(n, n / 2, c), HuiMath.maxExposure(n, c));
    }

    function testFuzz_Exposure_ZeroAtEnds(uint256 n, uint256 c) public pure {
        n = _n(n);
        c = _c(c);
        assertEq(HuiMath.exposure(n, 0, c), 0);
        assertEq(HuiMath.exposure(n, n, c), 0);
    }

    function testFuzz_MaxExposure_ScalesWithC(uint256 n, uint256 c) public pure {
        n = _n(n);
        c = _c(c);
        assertEq(HuiMath.maxExposure(n, 2 * c), 2 * HuiMath.maxExposure(n, c));
    }

    // ------------------------------------------------------------ holdback

    function testFuzz_Holdback_BoundedAndMonotone(uint256 alpha, uint256 n, uint256 k, uint256 c) public pure {
        alpha = bound(alpha, 0, 10_000);
        n = _n(n);
        c = _c(c);
        k = bound(k, 1, n);
        uint256 h = HuiMath.holdbackFor(alpha, n, k, c);
        assertLe(h, (n - k) * c); // never more than the remaining obligation
        if (k < n) assertGe(h, HuiMath.holdbackFor(alpha, n, k + 1, c)); // shrinks as k grows
    }

    function testFuzz_Holdback_MonotoneInAlpha(uint256 a1, uint256 a2, uint256 n, uint256 k, uint256 c) public pure {
        a1 = bound(a1, 0, 10_000);
        a2 = bound(a2, a1, 10_000);
        n = _n(n);
        c = _c(c);
        k = bound(k, 1, n);
        assertLe(HuiMath.holdbackFor(a1, n, k, c), HuiMath.holdbackFor(a2, n, k, c));
    }

    function testFuzz_Holdback_RollingReleaseIsWithinRoundingOfTarget(
        uint256 alpha,
        uint256 n,
        uint256 r,
        uint256 m,
        uint256 c
    ) public pure {
        // A member who took round r holds holdbackFor(r) - (m - r) * release after round m (m >= r).
        // INV-06 target is alpha*(n-m)*c/10_000; flooring each term may leave it off by at most (m - r) units.
        alpha = bound(alpha, 0, 10_000);
        n = _n(n);
        c = _c(c);
        r = bound(r, 1, n);
        m = bound(m, r, n);
        uint256 held = HuiMath.holdbackFor(alpha, n, r, c) - (m - r) * HuiMath.releasePerRound(alpha, c);
        uint256 target = HuiMath.holdbackFor(alpha, n, m, c);
        assertGe(held, target); // flooring the release only ever keeps slightly more
        assertLe(held - target, n);
    }

    // ------------------------------------------------------------ coverage index

    function testFuzz_Coverage_CappedAndFloored(uint256 alpha, uint256 bond, uint256 reserve, uint256 n, uint256 c)
        public
        pure
    {
        alpha = bound(alpha, 0, 10_000);
        bond = bound(bond, 0, 1e15);
        reserve = bound(reserve, 0, 1e15);
        n = _n(n);
        c = _c(c);
        uint256 ci = HuiMath.coverageIndexBps(alpha, bond, reserve, n, c);
        assertLe(ci, 10_000);
        assertGe(ci, alpha);
    }

    function testFuzz_Coverage_MonotoneInBondAndReserve(
        uint256 alpha,
        uint256 bond,
        uint256 extra,
        uint256 reserve,
        uint256 n,
        uint256 c
    ) public pure {
        alpha = bound(alpha, 0, 10_000);
        bond = bound(bond, 0, 1e15);
        extra = bound(extra, 0, 1e15);
        reserve = bound(reserve, 0, 1e15);
        n = _n(n);
        c = _c(c);
        uint256 base = HuiMath.coverageIndexBps(alpha, bond, reserve, n, c);
        assertGe(HuiMath.coverageIndexBps(alpha, bond + extra, reserve, n, c), base);
        assertGe(HuiMath.coverageIndexBps(alpha, bond, reserve + extra, n, c), base);
    }

    function testFuzz_Coverage_FullBondGives100Percent(uint256 alpha, uint256 n, uint256 c) public pure {
        // B = (1 - alpha) * O_max, rounded UP, must reach 100% (docs/03 section 2.3).
        alpha = bound(alpha, 0, 10_000);
        n = _n(n);
        c = _c(c);
        uint256 oMax = HuiMath.maxExposure(n, c);
        uint256 bond = (oMax * (10_000 - alpha) + 9_999) / 10_000; // ceil
        // bond * 10_000 >= oMax * (10_000 - alpha), so the floored quotient is at least 10_000 - alpha.
        assertGe(HuiMath.coverageIndexBps(alpha, bond, 0, n, c), 10_000);
    }

    // ------------------------------------------------------------ maxBid

    function testFuzz_MaxBid_BelowC(uint256 cap, uint256 n, uint256 k, uint256 c, uint256 period, uint256 payers)
        public
        pure
    {
        cap = bound(cap, 0, 10_000);
        n = _n(n);
        k = bound(k, 0, n);
        c = _c(c);
        period = bound(period, 1 days, 31 days);
        payers = bound(payers, 0, n);
        assertLt(HuiMath.maxBid(cap, n, k, c, period, payers), c);
    }

    function testFuzz_MaxBid_NonIncreasingInPayers(
        uint256 cap,
        uint256 n,
        uint256 k,
        uint256 c,
        uint256 period,
        uint256 p1,
        uint256 p2
    ) public pure {
        cap = bound(cap, 0, 2000);
        n = _n(n);
        k = bound(k, 0, n);
        c = _c(c);
        period = bound(period, 1 days, 31 days);
        p1 = bound(p1, 1, n);
        p2 = bound(p2, p1, n);
        assertGe(HuiMath.maxBid(cap, n, k, c, period, p1), HuiMath.maxBid(cap, n, k, c, period, p2));
    }

    function testFuzz_MaxBid_MonotoneInCapAndPeriod(
        uint256 cap1,
        uint256 cap2,
        uint256 n,
        uint256 k,
        uint256 c,
        uint256 period1,
        uint256 period2,
        uint256 payers
    ) public pure {
        cap1 = bound(cap1, 0, 2000);
        cap2 = bound(cap2, cap1, 2000);
        n = _n(n);
        k = bound(k, 0, n);
        c = _c(c);
        period1 = bound(period1, 1 days, 31 days);
        period2 = bound(period2, period1, 31 days);
        payers = bound(payers, 1, n);
        assertLe(HuiMath.maxBid(cap1, n, k, c, period1, payers), HuiMath.maxBid(cap2, n, k, c, period1, payers));
        assertLe(HuiMath.maxBid(cap1, n, k, c, period1, payers), HuiMath.maxBid(cap1, n, k, c, period2, payers));
    }

    function testFuzz_MaxBid_ScalesRoughlyLinearlyInC(uint256 n, uint256 k, uint256 c) public pure {
        // No payer shortfall: doubling C at most doubles the ceiling (floor can only lose a unit), until the c-1 clamp.
        n = _n(n);
        k = bound(k, 1, n - 1);
        c = bound(c, 1 * USDC, MAX_C / 2);
        uint256 a = HuiMath.maxBid(2000, n, k, c, 30 days, n - k);
        uint256 b = HuiMath.maxBid(2000, n, k, 2 * c, 30 days, n - k);
        assertLe(a * 2, b + 2);
    }

    function testFuzz_MaxBid_ZeroInLastRound(uint256 cap, uint256 n, uint256 c, uint256 period, uint256 payers)
        public
        pure
    {
        cap = bound(cap, 0, 10_000);
        n = _n(n);
        c = _c(c);
        period = bound(period, 1 days, 31 days);
        payers = bound(payers, 0, n);
        assertEq(HuiMath.maxBid(cap, n, n, c, period, payers), 0);
    }

    // ------------------------------------------------------------ lateFee

    function testFuzz_LateFee_MonotoneInElapsedAndAmount(
        uint256 amount,
        uint256 rate,
        uint256 e1,
        uint256 e2,
        uint256 period,
        uint256 round
    ) public pure {
        amount = bound(amount, 0, MAX_C * 30);
        rate = bound(rate, 0, 2000);
        e1 = bound(e1, 0, 365 days);
        e2 = bound(e2, e1, 365 days);
        period = bound(period, 1 days, 31 days);
        round = bound(round, 120, period);
        assertLe(HuiMath.lateFee(amount, rate, e1, period, round), HuiMath.lateFee(amount, rate, e2, period, round));
        assertLe(HuiMath.lateFee(amount, rate, e1, period, round), HuiMath.lateFee(amount + 1, rate, e1, period, round));
    }

    function testFuzz_LateFee_RealCircleOneYearEqualsRate(uint256 amount, uint256 rate) public pure {
        // roundDuration == periodSeconds (timeScale 1): one full year of delay costs amount * rate / 10_000.
        amount = bound(amount, 0, MAX_C * 30);
        rate = bound(rate, 0, 2000);
        assertEq(HuiMath.lateFee(amount, rate, 365 days, 30 days, 30 days), HuiMath.bpsOf(amount, rate));
    }

    function testFuzz_LateFee_DemoScaleMatchesNominalTime(uint256 amount, uint256 secs) public pure {
        // Demo: timeScale = 30 days / 180 s = 14_400. `secs` real seconds == secs * 14_400 nominal seconds.
        amount = bound(amount, 0, MAX_C * 30);
        secs = bound(secs, 0, 100_000);
        assertEq(
            HuiMath.lateFee(amount, 1000, secs, 30 days, 180),
            HuiMath.lateFee(amount, 1000, secs * 14_400, 30 days, 30 days)
        );
    }

    // ------------------------------------------------------------ bpsOf

    function testFuzz_BpsOf_NeverExceedsAmount(uint256 amount, uint256 bps) public pure {
        amount = bound(amount, 0, type(uint128).max);
        bps = bound(bps, 0, 10_000);
        assertLe(HuiMath.bpsOf(amount, bps), amount);
    }

    function testFuzz_BpsOf_Additive_FloorLosesAtMostOne(uint256 amount, uint256 a, uint256 b) public pure {
        amount = bound(amount, 0, type(uint128).max);
        a = bound(a, 0, 5000);
        b = bound(b, 0, 5000);
        uint256 split = HuiMath.bpsOf(amount, a) + HuiMath.bpsOf(amount, b);
        uint256 whole = HuiMath.bpsOf(amount, a + b);
        assertLe(split, whole);
        assertLe(whole - split, 1);
    }

    // ------------------------------------------------------------ INV-05 shape

    function testFuzz_PotSplit_SumsToPot(uint256 pot, uint256 feeBps, uint256 reserveBps, uint256 holdback)
        public
        pure
    {
        // payout = pot - fee - premium - H always reconstructs the pot, given fee + premium + H <= pot.
        pot = bound(pot, 0, MAX_C * 30);
        feeBps = bound(feeBps, 0, 300);
        reserveBps = bound(reserveBps, 0, 300);
        uint256 fee = HuiMath.bpsOf(pot, feeBps);
        uint256 premium = HuiMath.bpsOf(pot, reserveBps);
        holdback = bound(holdback, 0, pot - fee - premium);
        uint256 payout = pot - fee - premium - holdback;
        assertEq(payout + fee + premium + holdback, pot);
    }
}
