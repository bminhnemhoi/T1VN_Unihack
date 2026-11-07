// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {
    CircleMode,
    CircleParams,
    CoverSource,
    MemberInfo,
    RoundInfo,
    Shortfall
} from "../../src/libraries/HuiTypes.sol";

/// @notice Regression tests for the A4 audit decisions (docs/03 sections 2.5, 5.3, 6.3 and 6.8): H-01 (finalize forgives
/// the member's own holdback part first), M-01 (paused time does not accrue late fees), M-02 (the bid cap L_k is fixed by
/// the first commit of a round) and the strict L-03 boundary of `finalize` (also in HuiCircleFinalize.t.sol).
contract HuiCircleAuditFixesTest is CircleScenario {
    function _pause() internal {
        vm.prank(admin);
        factory.pauseCircle(address(c));
    }

    function _unpause() internal {
        vm.prank(admin);
        factory.unpauseCircle(address(c));
    }

    // ================================================================== H-01

    /// @dev Audit scenario: Fixed N = 5. D (= M1) receives round 1 and holds back 80. Round 2: D cannot pay, 100 is
    /// covered 80 holdback + 20 bond. Round 3: D cannot pay, 100 covered by the bond. markDefault(D). D repays 30
    /// (bond 20 first, then 10 into its holdback). D pays rounds 4 and 5. finalize: the 70 still owed to its own
    /// holdback is forgiven (no transfer, no fee); the 10 of holdback it holds pays the newer bond part of round 3.
    function test_H01_FinalizeForgivesTheOwnHoldbackPartFirst_ThenPaysTheNewerParts() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        _newCircle(p, 480 * U);
        address d = _M(1);

        _settle(); // r1: D wins, H = 80
        assertEq(c.memberInfo(d).holdback, 80 * U);
        _block(d);
        _settle(); // r2: D fails: 80 holdback + 20 bond
        Shortfall memory s2 = c.shortfallOf(2, d);
        assertEq(s2.fromHoldback, 80 * U);
        assertEq(s2.fromBond, 20 * U);
        _settle(); // r3: D fails again: 100 bond
        Shortfall memory s3 = c.shortfallOf(3, d);
        assertEq(s3.fromHoldback, 0);
        assertEq(s3.fromBond, 100 * U);
        assertEq(c.bondRemaining(), 360 * U);

        vm.warp(_now() + 1);
        c.markDefault(d); // names round 2
        assertTrue(c.roundInfo(2).feeForfeited);
        _unblock(d);

        // repayDebt(30): oldest round first, refund order bond (20) then holdback (10)
        vm.warp(_now() + 40);
        uint256 e2 = _now() - s2.since;
        uint256 repayFee = _lateFee(20 * U, e2) + _lateFee(10 * U, e2);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, d, CoverSource.Bond, 20 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, d, CoverSource.Holdback, 10 * U);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(d, 30 * U, repayFee);
        vm.prank(d);
        c.repayDebt(30 * U);
        assertEq(c.memberInfo(d).holdback, 10 * U);
        assertEq(c.memberInfo(d).debt, 170 * U);
        assertEq(c.bondRemaining(), 380 * U);
        _assertLedger();

        _settleRounds(4, 5); // D (defaulted dead) pays C each time and gets no release
        assertEq(c.memberInfo(d).holdback, 10 * U);
        assertEq(c.memberInfo(d).debt, 170 * U);

        vm.warp(_graceEnd(5) + 1);
        s3 = c.shortfallOf(3, d);
        uint256 e3 = _now() - s3.since;
        uint256 reserveBefore = c.reserve();
        uint256 bondBefore = c.bondRemaining();
        uint256 dBefore = usdc.balanceOf(d);
        assertEq(c.shortfallOf(2, d).fromHoldback, 70 * U);
        vm.recordLogs();
        // the 70 is forgiven first: no transfer, no fee
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, d, CoverSource.Holdback, 70 * U);
        // then the 10 left pays the oldest remaining part, the bond of round 3; nothing is left for the fee
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(3, d, CoverSource.Bond, 10 * U);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.LateFeeUnpaid(d, _lateFee(10 * U, e3));
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(d, 10 * U, 0);
        c.finalize();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_count(logs, IHuiCircle.HoldbackReleased.selector), 0, "D gets no holdback back: all of it paid debt");

        assertEq(usdc.balanceOf(d), dBefore, "no transfer to or from D at finalize");
        assertTrue(c.shortfallOf(2, d).resolved);
        assertEq(c.shortfallOf(2, d).fromHoldback, 0);
        assertFalse(c.shortfallOf(3, d).resolved);
        assertEq(c.shortfallOf(3, d).fromBond, 90 * U, "the unpaid rest of round 3 is a public claim");
        assertEq(c.memberInfo(d).debt, 90 * U, "170 - 70 forgiven - 10 repaid");
        assertEq(c.reserve(), 0);
        assertEq(c.bondRemaining(), 0, "bond (incl. the 10 restored) went back to the organizer");
        assertEq(bondBefore + 10 * U, 390 * U);
        assertGe(reserveBefore, 0);
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(c.totalClaimable(), 0);
        _assertConserved();
    }

    /// @dev Same story, but D repaid enough that the holdback it holds exceeds what it still owes: the surplus comes back.
    function test_H01_SurplusHoldbackAfterTheOwedPartsGoesBackToTheMember() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        _newCircle(p, 480 * U);
        address d = _M(1);
        _settle(); // r1
        _block(d);
        _settle(); // r2: 80 holdback + 20 bond
        vm.warp(_now() + 121);
        c.markDefault(d);
        _unblock(d);
        vm.prank(d);
        c.repayDebt(100 * U); // bond 20, holdback 80 restored; debt 0 (fee paid on top)
        assertEq(c.memberInfo(d).holdback, 80 * U);
        assertEq(c.memberInfo(d).debt, 0);
        _settleRounds(3, 5);
        vm.warp(_graceEnd(5) + 1);
        uint256 before = usdc.balanceOf(d);
        c.finalize();
        assertEq(usdc.balanceOf(d) - before, 80 * U, "no debt left: the whole holdback is returned");
        _assertConserved();
    }

    // ================================================================== M-01

    /// @dev Demo clock (1 real second = 14,400 nominal): a 48 h pause must not turn into 345 million nominal days of
    /// late fee. payLate pulls principal + the fee for the time outside the pause.
    function test_M01_PayLate_FeeExcludesAnExtraordinaryPause() public {
        _m4FailsRound2();
        address m4 = _M(4);
        _unblock(m4);
        uint256 t2 = c.roundInfo(2).settledAt;
        vm.warp(t2 + 10);
        _pause();
        vm.warp(t2 + 10 + 48 hours);
        _unpause();
        vm.warp(_now() + 6); // 16 s of real time since the settlement, outside the pause
        Shortfall memory sf = c.shortfallOf(2, m4);
        uint256 fee = _feeOfParts(sf, 16);
        assertGt(fee, 0);
        assertLt(fee, _feeOfParts(sf, 48 hours), "the paused span is not charged");
        assertEq(c.lateFeeOf(m4, 2), fee, "view agrees");

        uint256 bal = usdc.balanceOf(m4);
        uint256 reserveBefore = c.reserve();
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.LatePaid(2, m4, 100 * U, fee);
        vm.prank(m4);
        c.payLate(2);
        assertEq(bal - usdc.balanceOf(m4), 100 * U + fee - 20 * U, "principal + fee, minus the 20 released");
        assertEq(c.reserve() - reserveBefore, fee);
        _assertLedger();
    }

    function test_M01_RepayDebtAndLateFeeOf_ExcludeThePause() public {
        _m4FailsRound2();
        address m4 = _M(4);
        uint256 t2 = c.roundInfo(2).settledAt;
        vm.warp(t2 + 10);
        _pause();
        vm.warp(t2 + 10 + 48 hours);
        _unpause();
        vm.warp(t2 + 120 + 48 hours + 1); // grace was extended by the pause
        c.markDefault(m4);
        _unblock(m4);
        uint256 elapsed = _now() - t2 - 48 hours;
        Shortfall memory sf = c.shortfallOf(2, m4);
        uint256 fee = _feeOfParts(sf, elapsed);
        assertEq(c.lateFeeOf(m4, 2), fee);
        uint256 bal = usdc.balanceOf(m4);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(m4, 100 * U, fee);
        vm.prank(m4);
        c.repayDebt(100 * U);
        assertEq(bal - usdc.balanceOf(m4), 100 * U + fee);
    }

    function test_M01_APauseBeforeTheSettlementIsNotSubtractedTwice() public {
        vm.warp(_now() + 10);
        _pause();
        vm.warp(_now() + 1000);
        _unpause();
        _m4FailsRound2(); // both rounds settle after the pause
        uint256 t2 = c.roundInfo(2).settledAt;
        vm.warp(t2 + 30);
        Shortfall memory sf = c.shortfallOf(2, _M(4));
        assertEq(c.lateFeeOf(_M(4), 2), _feeOfParts(sf, 30), "elapsed = real time since the settlement");
    }

    // ================================================================== M-02

    /// @dev Audit scenario. Rounds 1-3 are won by M1-M3, so M4 and M5 are the two live members. M5 cannot pay round 3
    /// (live, shortfall). In round 4 M4 commits a valid bid under the cap of one payer; markDefault(M5) inside the
    /// reveal window drops the live count to 1, which would give a cap of 0. The cap is fixed by the first commit, so
    /// M4's honest bid still reveals and its reveal bond is not forfeited.
    function test_M02_CapIsFixedByTheFirstCommit_MarkDefaultInsideRevealDoesNotBreakAnHonestBid() public {
        _settleRounds(1, 2);
        _block(_M(5));
        _settle(); // round 3: M3 wins; M5 (live) fails, bond covers
        uint256 t3 = c.roundInfo(3).settledAt;
        assertEq(c.liveCount(), 2);
        uint256 cap = 1_643_835; // docs/03 section 8, row k = 4 (one payer)
        assertEq(c.maxBid(4), cap);

        uint256 bid = 1_500_000;
        vm.warp(t3 + 10);
        _commit(_M(4), bid);
        assertEq(c.maxBid(4), cap, "unchanged by the first commit");

        vm.warp(t3 + 121); // reveal window is [t3 + 90, t3 + 150); M5's grace (t3 + 120) is over
        c.markDefault(_M(5));
        assertEq(c.liveCount(), 1);
        assertEq(c.maxBid(4), cap, "still the cap of the first commit, not 0");
        assertEq(c.maxBid(5), 0, "other rounds follow the live count (nobody can bid in round 5)");

        uint256 balBefore = usdc.balanceOf(_M(4));
        _reveal(_M(4), bid); // would have reverted BidTooHigh(1_500_000, 0) before the fix
        assertEq(usdc.balanceOf(_M(4)) - balBefore, 1 * U, "reveal bond refunded");
        assertTrue(c.commitOf(4, _M(4)).revealed);

        vm.recordLogs();
        _settle();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_count(logs, IHuiCircle.RevealBondForfeited.selector), 0, "no bond forfeited");
        RoundInfo memory ri = c.roundInfo(4);
        assertEq(ri.winner, _M(4));
        assertEq(ri.winningBid, bid, "the honest bid won");
        assertEq(c.memberInfo(_M(4)).lateCount, 0);
        assertEq(rep.reputationOf(_M(4)).late, 0);
        assertEq(c.revealBondsHeld(), 0);
        _assertLedger();
    }

    function test_M02_BeforeAnyCommitTheViewFollowsTheLiveCount() public {
        _settleRounds(1, 3);
        assertEq(c.liveCount(), 2);
        assertEq(c.maxBid(4), 1_643_835);
        c.exposed_setDefaulted(_M(5), true); // live count drops to 1 before anybody committed
        assertEq(c.liveCount(), 1);
        assertEq(c.maxBid(4), 0);
    }

    function test_M02_EachRoundFixesItsOwnCap() public {
        _settle(); // round 1
        uint256 cap2 = c.maxBid(2);
        _commit(_M(2), 1 * U);
        assertEq(c.maxBid(2), cap2);
        _toReveal();
        _reveal(_M(2), 1 * U);
        _settle(); // round 2: M2 wins, live = 3
        uint256 cap3 = c.maxBid(3); // 2 payers = N - k
        assertEq(cap3, 3_287_671);
        _commit(_M(3), 1 * U);
        assertEq(c.maxBid(3), cap3);
        assertEq(c.maxBid(2), cap2, "round 2 keeps its own cap");
    }

    // ================================================================== L-03 (strict boundary, with a pause)

    function test_L03_FinalizeNeedsStrictlyMoreThanGraceEnd_AlsoAfterAPause() public {
        _settleRounds(1, 5);
        vm.warp(_now() + 20);
        _pause();
        vm.warp(_now() + 500);
        _unpause();
        uint256 end = _graceEnd(5) + 500; // grace end shifted by the 500 s pause
        vm.warp(end);
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.finalize();
        vm.warp(end + 1);
        c.finalize();
    }
}
