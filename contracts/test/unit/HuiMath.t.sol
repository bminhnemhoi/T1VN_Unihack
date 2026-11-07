// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";

/// @dev External wrapper so `vm.expectRevert` can observe reverts of internal library calls.
contract HuiMathHarness {
    function exposure(uint256 n, uint256 k, uint256 c) external pure returns (uint256) {
        return HuiMath.exposure(n, k, c);
    }

    function maxBid(uint256 capBps, uint256 n, uint256 k, uint256 c, uint256 periodSec, uint256 payers)
        external
        pure
        returns (uint256)
    {
        return HuiMath.maxBid(capBps, n, k, c, periodSec, payers);
    }

    function lateFee(uint256 amount, uint256 lateRateBps, uint256 elapsedSec, uint256 periodSec, uint256 roundDuration)
        external
        pure
        returns (uint256)
    {
        return HuiMath.lateFee(amount, lateRateBps, elapsedSec, periodSec, roundDuration);
    }
}

/// @notice Reproduces every number of docs/03 section 8 plus the Judgment 48/2024 check of section 2.4.
contract HuiMathTest is Test {
    uint256 internal constant USDC = 1e6;

    // Worked-example circle: N = 5, C = 100 USDC, alpha = 20%, P = 30 days, bond = 480 USDC.
    uint256 internal constant N = 5;
    uint256 internal constant C = 100 * USDC;
    uint256 internal constant ALPHA = 2000;
    uint256 internal constant CAP = 2000;
    uint256 internal constant P = 30 days;
    uint256 internal constant FEE_BPS = 100;
    uint256 internal constant RESERVE_BPS = 100;

    HuiMathHarness internal h = new HuiMathHarness();

    // ------------------------------------------------------------ exposure

    function test_Exposure_WorkedExample() public pure {
        assertEq(HuiMath.exposure(N, 0, C), 0);
        assertEq(HuiMath.exposure(N, 1, C), 400 * USDC);
        assertEq(HuiMath.exposure(N, 2, C), 600 * USDC);
        assertEq(HuiMath.exposure(N, 3, C), 600 * USDC);
        assertEq(HuiMath.exposure(N, 4, C), 400 * USDC);
        assertEq(HuiMath.exposure(N, 5, C), 0);
    }

    function test_Exposure_RevertsWhenKAboveN() public {
        vm.expectRevert();
        h.exposure(N, N + 1, C);
    }

    function test_MaxExposure_Examples() public pure {
        assertEq(HuiMath.maxExposure(5, 100 * USDC), 600 * USDC); // 2 * 3 * 100
        assertEq(HuiMath.maxExposure(10, 2_000_000), 50_000_000); // docs/03 2.1: 5 * 5 * 2 million
        assertEq(HuiMath.maxExposure(4, C), 400 * USDC); // even N: 2 * 2
        assertEq(HuiMath.maxExposure(3, C), 200 * USDC); // 1 * 2
        assertEq(HuiMath.maxExposure(30, C), 15 * 15 * C);
    }

    // ------------------------------------------------------------ holdback

    function test_HoldbackFor_WorkedExample() public pure {
        assertEq(HuiMath.holdbackFor(ALPHA, N, 1, C), 80 * USDC); // M4 in round 1: 20% * 4 * 100
        assertEq(HuiMath.holdbackFor(ALPHA, N, 2, C), 60 * USDC); // M1 in round 2: 20% * 3 * 100
        assertEq(HuiMath.holdbackFor(ALPHA, N, 5, C), 0);
    }

    function test_ReleasePerRound_WorkedExample() public pure {
        assertEq(HuiMath.releasePerRound(ALPHA, C), 20 * USDC);
    }

    function test_Holdback_TotalEqualsAlphaTimesExposure_WhenAllPayOnTime() public pure {
        // After round m, member received in round r (1..m) holds alpha*(N-r)*C minus (m-r) releases of alpha*C,
        // which is alpha*(N-m)*C. Sum over m members = m * alpha*(N-m)*C = alpha * O(m).
        for (uint256 m = 1; m <= N; m++) {
            uint256 total = 0;
            for (uint256 r = 1; r <= m; r++) {
                total += HuiMath.holdbackFor(ALPHA, N, r, C) - (m - r) * HuiMath.releasePerRound(ALPHA, C);
            }
            assertEq(total, HuiMath.bpsOf(HuiMath.exposure(N, m, C), ALPHA));
        }
    }

    // ------------------------------------------------------------ coverage index

    function test_CoverageIndex_WorkedExampleIs100Percent() public pure {
        // CI = 20% + 480 / 600 = 100%
        assertEq(HuiMath.coverageIndexBps(ALPHA, 480 * USDC, 0, N, C), 10_000);
    }

    function test_CoverageIndex_BelowFull() public pure {
        // 2000 + 240/600 -> 2000 + 4000 = 6000
        assertEq(HuiMath.coverageIndexBps(ALPHA, 240 * USDC, 0, N, C), 6000);
        // Reserve counts the same as bond
        assertEq(HuiMath.coverageIndexBps(ALPHA, 200 * USDC, 40 * USDC, N, C), 6000);
        // No bond: only the holdback
        assertEq(HuiMath.coverageIndexBps(ALPHA, 0, 0, N, C), ALPHA);
    }

    function test_CoverageIndex_CappedAt10000() public pure {
        assertEq(HuiMath.coverageIndexBps(ALPHA, 10_000 * USDC, 5000 * USDC, N, C), 10_000);
        assertEq(HuiMath.coverageIndexBps(10_000, 0, 0, N, C), 10_000);
    }

    function test_CoverageIndex_RoundsDown() public pure {
        // bond 1 base unit over O_max = 600e6: 1 * 10_000 / 600e6 = 0 (floor)
        assertEq(HuiMath.coverageIndexBps(ALPHA, 1, 0, N, C), ALPHA);
        // bond 59_999 -> 59_999 * 10_000 / 600e6 = 0.99998 -> 0; 60_000 -> 1
        assertEq(HuiMath.coverageIndexBps(ALPHA, 59_999, 0, N, C), ALPHA);
        assertEq(HuiMath.coverageIndexBps(ALPHA, 60_000, 0, N, C), ALPHA + 1);
    }

    function test_CoverageIndex_ZeroExposureIsFull() public pure {
        assertEq(HuiMath.coverageIndexBps(0, 0, 0, 1, C), 10_000);
        assertEq(HuiMath.coverageIndexBps(0, 0, 0, N, 0), 10_000);
    }

    // ------------------------------------------------------------ maxBid

    function test_MaxBid_WorkedExampleTable() public pure {
        // payers = N - k (nobody frozen). Values from docs/03 section 8.
        assertEq(HuiMath.maxBid(CAP, N, 1, C, P, 4), 6_575_342); // 6.575342
        assertEq(HuiMath.maxBid(CAP, N, 2, C, P, 3), 4_931_506); // 4.931506
        assertEq(HuiMath.maxBid(CAP, N, 3, C, P, 2), 3_287_671); // 3.287671
        assertEq(HuiMath.maxBid(CAP, N, 4, C, P, 1), 1_643_835); // 1.643835
        assertEq(HuiMath.maxBid(CAP, N, 5, C, P, 0), 0); // last round: one member left, no bid
    }

    function test_MaxBid_LastRoundIsZeroEvenWithPayers() public pure {
        assertEq(HuiMath.maxBid(CAP, N, 5, C, P, 3), 0); // N - k = 0
    }

    function test_MaxBid_DemoScaleC10() public pure {
        // Live demo uses C = 10 USDC: every amount is exactly one tenth (rounded down).
        uint256 c10 = 10 * USDC;
        assertEq(HuiMath.maxBid(CAP, N, 1, c10, P, 4), 657_534);
        assertEq(HuiMath.maxBid(CAP, N, 4, c10, P, 1), 164_383);
    }

    function test_MaxBid_Judgment48of2024() public pure {
        // docs/03 2.4: 25 shares x 2,000,000 VND, round with 20 live members and 4 dead, monthly circle.
        uint256 cap = HuiMath.maxBid(CAP, 25, 5, 2_000_000, 30 days, 20);
        assertEq(cap, 657_534); // floor(0.2 * 2,000,000 * 20 * 30 / 365)
        assertGt(cap, 450_000); // the 450,000 bid in the judgment is within the ceiling
    }

    function test_MaxBid_FrozenMembersRaiseCeiling() public pure {
        // Fewer payers than N - k (someone frozen): the same interest is spread over fewer payers.
        uint256 normal = HuiMath.maxBid(CAP, N, 1, C, P, 4);
        uint256 fewer = HuiMath.maxBid(CAP, N, 1, C, P, 3);
        assertGt(fewer, normal);
    }

    function test_MaxBid_NeverReachesC() public pure {
        // Absurd cap forces the hard limit c - 1.
        assertEq(HuiMath.maxBid(10_000, N, 1, C, 31 days, 1), C - 1);
    }

    function test_MaxBid_ZeroPayersOrZeroC() public pure {
        assertEq(HuiMath.maxBid(CAP, N, 1, C, P, 0), 0);
        assertEq(HuiMath.maxBid(CAP, N, 1, 0, P, 4), 0);
    }

    function test_MaxBid_RevertsWhenKAboveN() public {
        vm.expectRevert();
        h.maxBid(CAP, N, N + 1, C, P, 1);
    }

    // ------------------------------------------------------------ lateFee

    function test_LateFee_WorkedExampleBranchA() public pure {
        // 100 USDC, 10%/yr, one nominal day late: 100 * 1000 * 86400 / (10_000 * 365 days) = 0.027397 USDC
        assertEq(HuiMath.lateFee(C, 1000, 1 days, P, P), 27_397);
    }

    function test_LateFee_DemoTimeScale() public pure {
        // Demo: roundDuration = 180 s, periodSeconds = 30 days -> timeScale = 14_400.
        // 100 USDC late by 6 real seconds counts as 6 * 14_400 = 86_400 nominal seconds = one nominal day.
        assertEq(HuiMath.lateFee(C, 1000, 6, 30 days, 180), 27_397);
    }

    function test_LateFee_ZeroElapsedOrAmount() public pure {
        assertEq(HuiMath.lateFee(C, 1000, 0, P, P), 0);
        assertEq(HuiMath.lateFee(0, 1000, 1 days, P, P), 0);
    }

    function test_LateFee_RevertsOnZeroRoundDuration() public {
        vm.expectRevert();
        h.lateFee(C, 1000, 1 days, P, 0);
    }

    // ------------------------------------------------------------ bpsOf

    function test_BpsOf() public pure {
        assertEq(HuiMath.bpsOf(376 * USDC, FEE_BPS), 3_760_000); // 3.76 USDC
        assertEq(HuiMath.bpsOf(1, 9999), 0); // rounds down
        assertEq(HuiMath.bpsOf(10_000, 9999), 9999);
        assertEq(HuiMath.bpsOf(123, 0), 0);
    }

    // ------------------------------------------------------------ worked example amounts (docs/03 section 8)

    function test_WorkedExample_Round1() public pure {
        uint256 bid = 6 * USDC;
        uint256 pot = 4 * (C - bid);
        assertEq(pot, 376 * USDC);

        uint256 fee = HuiMath.bpsOf(pot, FEE_BPS);
        uint256 premium = HuiMath.bpsOf(pot, RESERVE_BPS);
        uint256 holdback = HuiMath.holdbackFor(ALPHA, N, 1, C);
        assertEq(fee, 3_760_000);
        assertEq(premium, 3_760_000);
        assertEq(holdback, 80 * USDC);

        uint256 payout = pot - fee - premium - holdback;
        assertEq(payout, 288_480_000); // M4 receives 288.48
        assertEq(payout + fee + premium + holdback, pot); // INV-05
    }

    function test_WorkedExample_Round2() public pure {
        uint256 bid = 3 * USDC;
        // 3 live payers at 97 each + 100 covered for M4 (80 from holdback + 20 from bond)
        uint256 pot = 3 * (C - bid) + C;
        assertEq(pot, 391 * USDC);

        uint256 fee = HuiMath.bpsOf(pot, FEE_BPS);
        uint256 premium = HuiMath.bpsOf(pot, RESERVE_BPS);
        uint256 holdback = HuiMath.holdbackFor(ALPHA, N, 2, C);
        assertEq(fee, 3_910_000);
        assertEq(premium, 3_910_000);
        assertEq(holdback, 60 * USDC);

        uint256 payout = pot - fee - premium - holdback;
        assertEq(payout, 323_180_000); // M1 receives 323.18
        assertEq(payout + fee + premium + holdback, pot);

        // Reserve accumulates both premiums: 3.76 + 3.91 = 7.67
        assertEq(HuiMath.bpsOf(376 * USDC, RESERVE_BPS) + premium, 7_670_000);
    }

    function test_WorkedExample_Round2_ShortfallCover() public pure {
        // M4 missed 100: holdback 80 first, then 20 from the bond (480 -> 460).
        uint256 shortfall = C;
        uint256 fromHoldback = HuiMath.holdbackFor(ALPHA, N, 1, C);
        uint256 fromBond = shortfall - fromHoldback;
        assertEq(fromHoldback, 80 * USDC);
        assertEq(fromBond, 20 * USDC);
        assertEq(480 * USDC - fromBond, 460 * USDC);
    }

    function test_WorkedExample_BranchA_HoldbackBackToINV06() public pure {
        // After M4 pays late, 20 is released from the holdback of round 2 that was skipped: M4 holds 60,
        // the same as an on-time payer; total holdback 60 (M4) + 60 (M1) = 120 = alpha * O(2).
        uint256 m4 = HuiMath.holdbackFor(ALPHA, N, 1, C) - HuiMath.releasePerRound(ALPHA, C);
        uint256 m1 = HuiMath.holdbackFor(ALPHA, N, 2, C);
        assertEq(m4, 60 * USDC);
        assertEq(m4 + m1, HuiMath.bpsOf(HuiMath.exposure(N, 2, C), ALPHA));
        assertEq(m4 + m1, 120 * USDC);
    }

    function test_WorkedExample_BranchB_BondEndsAt160() public pure {
        // M4 owes 4 rounds x 100 = 400: 80 from his holdback, 320 from the bond. 480 - 320 = 160.
        uint256 totalShortfall = 4 * C;
        uint256 fromHoldback = HuiMath.holdbackFor(ALPHA, N, 1, C);
        uint256 fromBond = totalShortfall - fromHoldback;
        assertEq(fromHoldback, 80 * USDC);
        assertEq(fromBond, 320 * USDC);

        uint256 bond = 480 * USDC;
        bond -= 20 * USDC; // round 2
        assertEq(bond, 460 * USDC);
        bond -= C; // round 3
        assertEq(bond, 360 * USDC);
        bond -= C; // round 4
        assertEq(bond, 260 * USDC);
        bond -= C; // round 5
        assertEq(bond, 160 * USDC);
        assertEq(480 * USDC - fromBond, bond);
    }

    function test_WorkedExample_DemoScaleC10() public pure {
        // Everything divides by 10 for the live Fuji demo (C = 10 USDC).
        uint256 c10 = 10 * USDC;
        assertEq(HuiMath.maxExposure(N, c10), 60 * USDC);
        assertEq(HuiMath.coverageIndexBps(ALPHA, 48 * USDC, 0, N, c10), 10_000);

        uint256 pot1 = 4 * (c10 - 600_000); // winning bid 0.6
        assertEq(pot1, 37_600_000);
        uint256 payout1 = pot1 - HuiMath.bpsOf(pot1, FEE_BPS) - HuiMath.bpsOf(pot1, RESERVE_BPS)
            - HuiMath.holdbackFor(ALPHA, N, 1, c10);
        assertEq(payout1, 28_848_000); // M4 receives 28.848

        uint256 pot2 = 3 * (c10 - 300_000) + c10;
        uint256 payout2 = pot2 - HuiMath.bpsOf(pot2, FEE_BPS) - HuiMath.bpsOf(pot2, RESERVE_BPS)
            - HuiMath.holdbackFor(ALPHA, N, 2, c10);
        assertEq(payout2, 32_318_000); // M1 receives 32.318

        assertEq(48 * USDC - (2 * USDC + 3 * c10), 16 * USDC); // bond left in branch B
    }
}
