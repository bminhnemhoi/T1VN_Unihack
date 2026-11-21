// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {
    CircleMode,
    CircleParams,
    CircleState,
    CoverSource,
    MemberInfo,
    RoundInfo,
    Shortfall
} from "../../src/libraries/HuiTypes.sol";

/// @notice C7 (docs/03 sections 6.8 and 3.2): `payLate`, `markDefault`, `repayDebt`, `lateFeeOf`, the refund order,
/// grace periods extended by pauses, the M-01 schedule fix and the reputation calls, through the real contract.
/// Circle of docs/03 section 8; actors[0..4] are M1..M5.
contract HuiCircleLateTest is CircleScenario {
    address internal stranger = makeAddr("stranger");

    // ------------------------------------------------------------------ helpers

    function _pause() internal {
        vm.prank(admin);
        factory.pauseCircle(address(c));
    }

    function _unpause() internal {
        vm.prank(admin);
        factory.unpauseCircle(address(c));
    }

    /// @dev Pause `at` seconds after now for `len` seconds; leaves the circle unpaused and the clock at the unpause.
    function _pauseFor(uint256 at, uint256 len) internal {
        vm.warp(_now() + at);
        _pause();
        vm.warp(_now() + len);
        _unpause();
    }

    function _debt(address m) internal view returns (uint256) {
        return c.memberInfo(m).debt;
    }

    // ================================================================== payLate: happy path (docs/03 branch A)

    function test_PayLate_BranchA_RestoresInRefundOrderAndReleasesOnce() public {
        _m4FailsRound2();
        address m4 = _M(4);
        uint256 t2 = c.roundInfo(2).settledAt;
        _unblock(m4);
        vm.warp(t2 + 6); // one nominal day at the demo clock (30 days / 180 s = 1 day per 6 s)

        Shortfall memory sf = c.shortfallOf(2, m4);
        assertEq(sf.fromBond, 20 * U);
        assertEq(sf.fromHoldback, 80 * U);
        uint256 fee = _feeOfParts(sf, 6);
        // docs/03 section 8: ~0.027397 on 100 USDC for one nominal day; part-by-part rounding gives 27_396.
        assertEq(fee, 27_396, "late fee, one nominal day");
        assertEq(c.lateFeeOf(m4, 2), fee, "view agrees");

        uint256 balBefore = usdc.balanceOf(m4);
        uint256 reserveBefore = c.reserve();

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, m4, CoverSource.Bond, 20 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, m4, CoverSource.Holdback, 80 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.LatePaid(2, m4, 100 * U, fee);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.HoldbackReleased(m4, 2, 20 * U);
        vm.prank(m4);
        c.payLate(2);

        assertEq(c.bondRemaining(), 480 * U, "bond back to 480");
        assertEq(c.memberInfo(m4).holdback, 60 * U, "80 restored, 20 released: as if paid on time");
        assertEq(c.totalHoldback(), 120 * U, "= alpha * O(2) = 20% * 600 (INV-06)");
        assertEq(c.reserve(), reserveBefore + fee, "late fee goes to the reserve");
        assertEq(_debt(m4), 0);
        sf = c.shortfallOf(2, m4);
        assertTrue(sf.resolved);
        assertEq(_openPrincipal(sf), 0);
        assertEq(sf.amount, 100 * U, "original amount is never rewritten");
        assertEq(balBefore - usdc.balanceOf(m4), 100 * U + fee - 20 * U, "pays 100 + fee, gets 20 released");
        assertEq(c.lateFeeOf(m4, 2), 0);
        assertEq(c.memberInfo(m4).lateCount, 1, "lateness was recorded once, at settlement");
        assertEq(rep.reputationOf(m4).late, 1);
        assertEq(rep.reputationOf(m4).defaults, 0);
        _assertLedger();
        _assertConserved();
    }

    function test_PayLate_SecondCallReverts_ReleaseHappensExactlyOnce() public {
        _m4FailsRound2();
        address m4 = _M(4);
        _unblock(m4);
        vm.warp(c.roundInfo(2).settledAt + 5);
        vm.prank(m4);
        c.payLate(2);
        assertEq(c.memberInfo(m4).holdback, 60 * U);
        vm.prank(m4);
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.payLate(2);
        assertEq(c.memberInfo(m4).holdback, 60 * U, "no second release");
        _assertLedger();
    }

    function test_PayLate_AtZeroElapsed_NoFee() public {
        _m4FailsRound2();
        address m4 = _M(4);
        _unblock(m4);
        vm.warp(c.roundInfo(2).settledAt); // same second as the settlement
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.LatePaid(2, m4, 100 * U, 0);
        vm.prank(m4);
        c.payLate(2);
        assertEq(c.reserve(), 7_670_000, "reserve unchanged: 3.76 + 3.91");
    }

    function test_PayLate_LiveMember_NoHoldbackRelease() public {
        _block(_M(5));
        _settle(); // round 1: M1 wins (b = 0); M5 live and unable to pay, the bond covers 100
        _unblock(_M(5));
        vm.recordLogs();
        vm.warp(c.roundInfo(1).settledAt + 30);
        vm.prank(_M(5));
        c.payLate(1);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_count(logs, IHuiCircle.HoldbackReleased.selector), 0, "never received: nothing to release");
        assertEq(c.bondRemaining(), 480 * U);
        assertEq(c.memberInfo(_M(5)).holdback, 0);
        assertEq(_debt(_M(5)), 0);
        assertTrue(c.shortfallOf(1, _M(5)).resolved);
        _assertLedger();
    }

    function test_PayLate_DoesNotCallRegistryAgain() public {
        _m4FailsRound2();
        _unblock(_M(4));
        vm.warp(c.roundInfo(2).settledAt + 5);
        vm.prank(_M(4));
        c.payLate(2);
        assertEq(rep.reputationOf(_M(4)).late, 1);
        assertEq(rep.reputationOf(_M(4)).onTime, 0, "round 1 was the win; round 2 failed");
        assertEq(rep.reputationOf(_M(4)).repaid, 0, "recordRepaid is for repayDebt");
    }

    // ================================================================== payLate: refund order with uncovered

    /// @dev Alpha 50%, no bond, reserve preset to 60: M5's round-1 shortfall is 60 reserve + 40 uncovered.
    function _uncoveredShortfall() internal {
        CircleParams memory p = _params();
        p.alphaBps = 5000;
        _newCircle(p, 0);
        usdc.mint(address(c), 60 * U);
        c.exposed_setReserve(60 * U);
        _block(_M(5));
        _settle();
        Shortfall memory sf = c.shortfallOf(1, _M(5));
        assertEq(sf.fromReserve, 60 * U);
        assertEq(sf.uncovered, 40 * U);
        _unblock(_M(5));
    }

    function test_PayLate_UncoveredIsPaidStraightToTheRoundWinnerBeforeReserve() public {
        _uncoveredShortfall();
        address winner = c.roundInfo(1).winner;
        assertEq(winner, _M(1));
        vm.warp(c.roundInfo(1).settledAt + 30);
        uint256 fee = _lateFee(40 * U, 30) + _lateFee(60 * U, 30);
        uint256 winnerBefore = usdc.balanceOf(winner);
        uint256 reserveBefore = c.reserve();

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(1, _M(5), CoverSource.Uncovered, 40 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(1, _M(5), CoverSource.Reserve, 60 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.LatePaid(1, _M(5), 100 * U, fee);
        vm.prank(_M(5));
        c.payLate(1);

        assertEq(usdc.balanceOf(winner) - winnerBefore, 40 * U, "the member short-changed in round 1 is made whole");
        assertEq(c.reserve(), reserveBefore + 60 * U + fee);
        assertTrue(c.shortfallOf(1, _M(5)).resolved);
        _assertLedger();
        _assertConserved();
    }

    function test_PayLate_UncoveredToBlockedWinner_GoesToClaimable() public {
        _uncoveredShortfall();
        address winner = c.roundInfo(1).winner;
        vm.warp(c.roundInfo(1).settledAt + 30);
        usdc.setBlacklisted(winner, true);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(winner, 40 * U);
        vm.prank(_M(5));
        c.payLate(1);
        assertEq(c.claimable(winner), 40 * U);
        assertEq(c.totalClaimable(), 40 * U);
        _assertLedger();
        usdc.setBlacklisted(winner, false);
        uint256 before = usdc.balanceOf(winner);
        vm.prank(winner);
        c.claim();
        assertEq(usdc.balanceOf(winner) - before, 40 * U);
        _assertLedger();
    }

    // ================================================================== payLate: reverts

    function test_PayLate_RevertsWithoutShortfall() public {
        _round1();
        vm.prank(_M(4));
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.payLate(1); // M4 won round 1, it never owed anything
        vm.prank(_M(2));
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.payLate(99);
        vm.prank(stranger);
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.payLate(1);
    }

    function test_PayLate_ShortfallBelongsToTheCaller() public {
        _m4FailsRound2();
        _unblock(_M(3));
        vm.prank(_M(3)); // somebody else cannot pay M4's shortfall through payLate
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.payLate(2);
    }

    function test_PayLate_GraceBoundary_LastSecondWorks() public {
        _m4FailsRound2();
        _unblock(_M(4));
        vm.warp(_graceEnd(2));
        vm.prank(_M(4));
        c.payLate(2);
        assertEq(_debt(_M(4)), 0);
    }

    function test_PayLate_GraceBoundary_OneSecondLaterReverts() public {
        _m4FailsRound2();
        _unblock(_M(4));
        vm.warp(_graceEnd(2) + 1);
        vm.prank(_M(4));
        vm.expectRevert(IHuiCircle.GraceExpired.selector);
        c.payLate(2);
        // The shortfall is still open and can now be defaulted.
        c.markDefault(_M(4));
        assertTrue(c.memberInfo(_M(4)).defaulted);
    }

    function test_PayLate_RevertsIfAllowanceCoversOnlyPrincipal_AtomicOnRevert() public {
        _m4FailsRound2();
        address m4 = _M(4);
        vm.prank(m4);
        usdc.approve(address(c), 100 * U); // principal yes, fee no
        vm.warp(c.roundInfo(2).settledAt + 60);
        uint256 bal = usdc.balanceOf(m4);
        vm.prank(m4);
        vm.expectPartialRevert(IERC20Errors.ERC20InsufficientAllowance.selector);
        c.payLate(2);
        assertEq(usdc.balanceOf(m4), bal, "nothing pulled");
        assertFalse(c.shortfallOf(2, m4).resolved);
        assertEq(c.bondRemaining(), 460 * U);
        assertEq(_debt(m4), 100 * U);
        _assertLedger();
    }

    function test_PayLate_RevertsOnInsufficientBalance() public {
        _m4FailsRound2();
        address m4 = _M(4);
        _unblock(m4);
        uint256 all = usdc.balanceOf(m4);
        vm.prank(m4);
        usdc.transfer(stranger, all); // wallet emptied
        vm.warp(c.roundInfo(2).settledAt + 5);
        vm.prank(m4);
        vm.expectPartialRevert(IERC20Errors.ERC20InsufficientBalance.selector);
        c.payLate(2);
        assertEq(_debt(m4), 100 * U);
    }

    function test_PayLate_RevertsWhenFormingPausedOrCompleted() public {
        HuiCircleHarness forming = _create(_params());
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Forming));
        forming.payLate(1);

        _m4FailsRound2();
        _unblock(_M(4));
        _pause();
        vm.prank(_M(4));
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.payLate(2);
        _unpause();

        _unblock(_M(4));
        _settleRounds(3, 5);
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        vm.prank(_M(4));
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Completed)
        );
        c.payLate(2);
    }

    // ================================================================== grace periods, pauses and INV-06 (M-02)

    function test_Grace_ExpiresBeforeTheNextRoundCanSettle() public {
        _m4FailsRound2();
        _settle(); // round 3 settles at its deadline; M4 fails again
        _unblock(_M(4));
        assertGt(_now(), _graceEnd(2), "round 2 grace is over before round 3 could settle");
        vm.prank(_M(4));
        vm.expectRevert(IHuiCircle.GraceExpired.selector);
        c.payLate(2);
        // The newer shortfall is the only one still payable, so a skipped alpha*C release can never pile up (INV-06).
        vm.prank(_M(4));
        c.payLate(3);
        assertTrue(c.shortfallOf(3, _M(4)).resolved);
    }

    function test_Grace_ExtendedByAPauseAfterSettlement() public {
        _m4FailsRound2();
        uint256 t2 = c.roundInfo(2).settledAt;
        vm.warp(t2 + 10);
        _pause();
        vm.warp(t2 + 510);
        _unpause(); // paused for 500 s
        assertEq(c.pausedTotal(), 500);
        _unblock(_M(4));
        // Grace of round 2 is now t2 + 120 + 500.
        vm.warp(t2 + 620);
        vm.prank(stranger);
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.markDefault(_M(4));
        vm.prank(_M(4));
        c.payLate(2);
        assertEq(_debt(_M(4)), 0);
    }

    function test_Grace_ExtendedByAPause_ExpiresOneSecondLater() public {
        _m4FailsRound2();
        uint256 t2 = c.roundInfo(2).settledAt;
        vm.warp(t2 + 10);
        _pause();
        vm.warp(t2 + 510);
        _unpause();
        _unblock(_M(4));
        vm.warp(t2 + 621);
        vm.prank(_M(4));
        vm.expectRevert(IHuiCircle.GraceExpired.selector);
        c.payLate(2);
        c.markDefault(_M(4));
        assertTrue(c.memberInfo(_M(4)).defaulted);
    }

    function test_Grace_APauseBeforeTheSettlementDoesNotExtendIt() public {
        _pauseFor(10, 1000); // paused before round 1 even opened
        assertEq(c.pausedTotal(), 1000);
        _m4FailsRound2();
        uint256 t2 = c.roundInfo(2).settledAt;
        _unblock(_M(4));
        vm.warp(t2 + 121);
        vm.prank(_M(4));
        vm.expectRevert(IHuiCircle.GraceExpired.selector);
        c.payLate(2);
        c.markDefault(_M(4)); // already past grace: no hidden extension from the old pause
    }

    // ================================================================== markDefault

    function test_MarkDefault_DefaultedDead_FeeEscrowOfThatRoundMovesToReserve() public {
        _m4FailsRound2();
        vm.warp(_graceEnd(2) + 1);
        assertEq(c.feeEscrow(2), 3_910_000);
        uint256 reserveBefore = c.reserve();
        uint256 live = c.liveCount();

        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.FeeForfeited(2, 3_910_000);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.MemberDefaulted(_M(4), 2, false);
        vm.prank(stranger); // anyone
        c.markDefault(_M(4));

        MemberInfo memory mi = c.memberInfo(_M(4));
        assertTrue(mi.defaulted);
        assertTrue(mi.received, "DefaultedDead = received + defaulted");
        assertEq(mi.debt, 100 * U, "debt is kept");
        assertEq(c.liveCount(), live, "a dead member is not part of the live set");
        assertEq(c.feeEscrow(2), 0);
        assertEq(c.feeEscrow(1), 0, "round 1 had no shortfall: its fee was paid at once, nothing to keep");
        assertEq(c.totalFeeEscrow(), 0);
        assertEq(c.reserve(), reserveBefore + 3_910_000);
        assertTrue(c.roundInfo(2).feeForfeited);
        assertFalse(c.roundInfo(1).feeForfeited);
        assertEq(rep.reputationOf(_M(4)).defaults, 1);
        _assertLedger();
    }

    function test_MarkDefault_Frozen_LeavesTheLiveSetAndLowersTheBidCeiling() public {
        _block(_M(5));
        _settle(); // round 1: M1 wins, M5 (live) cannot pay, bond covers 100
        assertEq(c.liveCount(), 4);
        vm.warp(_graceEnd(1) + 1);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.MemberDefaulted(_M(5), 1, true);
        c.markDefault(_M(5));

        MemberInfo memory mi = c.memberInfo(_M(5));
        assertTrue(mi.defaulted);
        assertFalse(mi.received, "Frozen = defaulted without having received");
        assertEq(c.liveCount(), 3, "I-08: frozen member leaves the live set");
        assertEq(rep.reputationOf(_M(5)).defaults, 1);
        assertTrue(c.roundInfo(1).feeForfeited);
        assertEq(c.feeEscrow(1), 0);
        // Round 2 with 3 live members: 2 payers. docs/03 section 2.4: 2000 * 9 * 100e6 * 30d / (10_000 * 365d * 2).
        assertEq(c.maxBid(2), 7_397_260);
        _assertLedger();
    }

    function test_MarkDefault_Frozen_NextRoundIsNotPulledAndNotLateAgain() public {
        _block(_M(5));
        _settle();
        vm.warp(_graceEnd(1) + 1);
        c.markDefault(_M(5));
        _unblock(_M(5)); // would have been able to pay, but frozen members are not pulled
        uint256 bal = usdc.balanceOf(_M(5));
        _settle(); // round 2
        assertEq(usdc.balanceOf(_M(5)), bal, "no transferFrom attempted on a frozen member");
        Shortfall memory sf = c.shortfallOf(2, _M(5));
        assertEq(sf.amount, 100 * U);
        assertEq(sf.fromBond, 100 * U);
        assertEq(_debt(_M(5)), 200 * U);
        assertEq(c.memberInfo(_M(5)).lateCount, 1, "round 1 only");
        assertEq(rep.reputationOf(_M(5)).late, 1);
        _assertLedger();
    }

    function test_MarkDefault_NamesTheOldestShortfallPastGrace() public {
        _m4FailsRound2();
        _settle(); // round 3, M4 fails again: r2 grace is over, r3 grace is not
        vm.warp(_now() + 1);
        assertGt(_now(), _graceEnd(2));
        assertLt(_now(), _graceEnd(3));
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.MemberDefaulted(_M(4), 2, false);
        c.markDefault(_M(4));
        assertFalse(c.roundInfo(3).feeForfeited, "round 3 fee escrow stays");
        assertEq(c.feeEscrow(3), 4 * U);
        assertTrue(c.roundInfo(2).feeForfeited);
    }

    function test_MarkDefault_SkipsAShortfallThatWasPaid() public {
        _m4FailsRound2();
        _unblock(_M(4));
        vm.warp(c.roundInfo(2).settledAt + 5);
        vm.prank(_M(4));
        c.payLate(2); // round 2 resolved in grace
        _block(_M(4));
        _settle(); // round 3: M4 fails again (holdback 60 + bond 40)
        vm.warp(_graceEnd(3) + 1);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.MemberDefaulted(_M(4), 3, false);
        c.markDefault(_M(4));
        assertTrue(c.roundInfo(3).feeForfeited);
        assertFalse(c.roundInfo(2).feeForfeited, "the paid round keeps its fee");
    }

    function test_MarkDefault_NoFeeEscrow_NoForfeitEvent() public {
        CircleParams memory p = _params();
        p.commissionMode = false;
        p.feeBps = 0;
        _newCircle(p, 480 * U);
        _block(_M(5));
        _settle();
        vm.warp(_graceEnd(1) + 1);
        vm.recordLogs();
        c.markDefault(_M(5));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_count(logs, IHuiCircle.FeeForfeited.selector), 0);
        assertEq(_count(logs, IHuiCircle.MemberDefaulted.selector), 1);
        assertFalse(c.roundInfo(1).feeForfeited);
    }

    function test_MarkDefault_Reverts() public {
        _m4FailsRound2();
        // not a member
        vm.expectRevert(IHuiCircle.NotMember.selector);
        c.markDefault(stranger);
        // member without any shortfall
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.markDefault(_M(1));
        // shortfall still inside grace, also exactly at its last second
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.markDefault(_M(4));
        vm.warp(_graceEnd(2));
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.markDefault(_M(4));
        // one second later it works, and a second call reverts
        vm.warp(_graceEnd(2) + 1);
        c.markDefault(_M(4));
        vm.expectRevert(IHuiCircle.AlreadyDefaulted.selector);
        c.markDefault(_M(4));
    }

    function test_MarkDefault_RevertsWhenFormingPausedOrCompleted() public {
        HuiCircleHarness forming = _create(_params());
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Forming));
        forming.markDefault(_M(1));

        _m4FailsRound2();
        vm.warp(_graceEnd(2) + 1);
        _pause();
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.markDefault(_M(4));
        _unpause();

        _unblock(_M(4));
        _settleRounds(3, 5);
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Completed)
        );
        c.markDefault(_M(4));
    }

    // ================================================================== repayDebt

    /// @dev M4 fails rounds 2 and 3 and is marked defaulted: r2 = bond 20 + holdback 80, r3 = bond 100. Allowance of
    /// M4 is restored so it can repay. Bond is 360, M4 holdback 0.
    function _m4DefaultedWithTwoShortfalls() internal {
        _m4FailsRound2();
        _settle(); // round 3
        vm.warp(_now() + 1);
        c.markDefault(_M(4));
        _unblock(_M(4));
        assertEq(_debt(_M(4)), 200 * U);
        assertEq(c.bondRemaining(), 360 * U);
    }

    function test_RepayDebt_PartialAppliesOldestRoundFirstInRefundOrder() public {
        _m4DefaultedWithTwoShortfalls();
        address m4 = _M(4);
        vm.warp(_now() + 40);
        Shortfall memory s2 = c.shortfallOf(2, m4);
        // 50 of principal: round 2 only; refund order inside it is bond (20) then holdback (30 of 80).
        uint256 fee = _lateFee(20 * U, _now() - s2.since) + _lateFee(30 * U, _now() - s2.since);
        uint256 bal = usdc.balanceOf(m4);
        uint256 reserveBefore = c.reserve();

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, m4, CoverSource.Bond, 20 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, m4, CoverSource.Holdback, 30 * U);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(m4, 50 * U, fee);
        vm.prank(m4);
        c.repayDebt(50 * U);

        s2 = c.shortfallOf(2, m4);
        assertEq(s2.fromBond, 0);
        assertEq(s2.fromHoldback, 50 * U);
        assertFalse(s2.resolved);
        assertEq(c.shortfallOf(3, m4).fromBond, 100 * U, "round 3 untouched");
        assertEq(_debt(m4), 150 * U);
        assertEq(c.memberInfo(m4).holdback, 30 * U, "restored into holdback, not released");
        assertEq(c.bondRemaining(), 380 * U);
        assertEq(c.reserve(), reserveBefore + fee);
        assertEq(bal - usdc.balanceOf(m4), 50 * U + fee);
        assertTrue(c.memberInfo(m4).defaulted, "still defaulted");
        assertEq(rep.reputationOf(m4).repaid, 0, "not fully repaid yet");
        _assertLedger();
        _assertConserved();
    }

    function test_RepayDebt_FullRepay_ResolvesEverythingAndRecordsRepaidOnce() public {
        _m4DefaultedWithTwoShortfalls();
        address m4 = _M(4);
        vm.warp(_now() + 40);
        Shortfall memory s2 = c.shortfallOf(2, m4);
        Shortfall memory s3 = c.shortfallOf(3, m4);
        uint256 fee = _feeOfParts(s2, _now() - s2.since) + _feeOfParts(s3, _now() - s3.since);
        uint256 bal = usdc.balanceOf(m4);

        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(m4, 200 * U, fee);
        vm.prank(m4);
        c.repayDebt(200 * U);

        assertEq(_debt(m4), 0);
        assertTrue(c.shortfallOf(2, m4).resolved);
        assertTrue(c.shortfallOf(3, m4).resolved);
        assertEq(c.bondRemaining(), 480 * U);
        assertEq(c.memberInfo(m4).holdback, 80 * U, "the holdback that covered round 2 is back, not released");
        assertEq(bal - usdc.balanceOf(m4), 200 * U + fee);
        assertEq(rep.reputationOf(m4).repaid, 1);
        assertTrue(c.memberInfo(m4).defaulted, "repaying does not clear the default");
        _assertLedger();

        vm.prank(m4);
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.repayDebt(1);
        assertEq(rep.reputationOf(m4).repaid, 1);
    }

    function test_RepayDebt_TwoStepsRecordRepaidOnlyAtZero() public {
        _m4DefaultedWithTwoShortfalls();
        vm.startPrank(_M(4));
        c.repayDebt(120 * U);
        assertEq(rep.reputationOf(_M(4)).repaid, 0);
        assertEq(_debt(_M(4)), 80 * U);
        c.repayDebt(80 * U);
        vm.stopPrank();
        assertEq(rep.reputationOf(_M(4)).repaid, 1);
        assertEq(_debt(_M(4)), 0);
        _assertLedger();
    }

    function test_RepayDebt_CanRunInAnyLaterRound() public {
        _m4DefaultedWithTwoShortfalls();
        _settle(); // round 4: M4 (defaulted dead) is still pulled C; its allowance is back, so it pays
        // The shortfalls of rounds 2 and 3 stay open: debt unchanged.
        assertEq(_debt(_M(4)), 200 * U);
        vm.prank(_M(4));
        c.repayDebt(200 * U);
        assertEq(_debt(_M(4)), 0);
        assertEq(c.memberInfo(_M(4)).holdback, 80 * U, "no per-round release for a defaulted member");
        _assertLedger();
    }

    /// @dev Documents a third gap: a frozen member's debt grows again every round (virtual shortfall), so repaying it
    /// to zero twice in ONE circle writes `recordRepaid` twice for a single `recordDefault`. `repaid > defaults` then
    /// hides a later unrepaid default in another circle from the /api/attest rule (defaults <= repaid).
    function test_Gap_RepaidRecordedTwiceInOneCircle_Documented() public {
        _block(_M(5));
        _settle(); // r1: M5 (live) cannot pay
        vm.warp(_graceEnd(1) + 1);
        c.markDefault(_M(5)); // frozen
        _unblock(_M(5));
        uint256 d1 = _debt(_M(5));
        vm.prank(_M(5));
        c.repayDebt(d1); // debt 0: recordRepaid #1
        assertEq(_debt(_M(5)), 0);
        _settle(); // r2: frozen M5 is not pulled, a virtual shortfall makes the debt grow again
        uint256 d2 = _debt(_M(5));
        assertGt(d2, 0, "debt is back");
        vm.prank(_M(5));
        c.repayDebt(d2); // debt 0 again: recordRepaid #2
        assertEq(rep.reputationOf(_M(5)).defaults, 1);
        assertEq(rep.reputationOf(_M(5)).repaid, 2, "two repaid marks for one default");
    }

    function test_RepayDebt_FrozenMemberRepaysThenWinsLastRoundWithFullPot() public {
        _block(_M(5));
        _settle(); // r1: M5 live, fails, bond covers
        vm.warp(_graceEnd(1) + 1);
        c.markDefault(_M(5)); // Frozen
        _settleRounds(2, 4); // frozen M5 is never pulled: virtual shortfalls r2..r4 covered by the bond
        assertEq(_debt(_M(5)), 400 * U);
        assertEq(c.bondRemaining(), 80 * U);
        _unblock(_M(5));
        vm.warp(_now() + 10);

        uint256 fee;
        for (uint32 r = 1; r <= 4; r++) {
            Shortfall memory sf = c.shortfallOf(r, _M(5));
            assertEq(sf.fromBond, 100 * U, "every round of M5's debt sits in the bond");
            fee += _feeOfParts(sf, _now() - sf.since);
        }
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(_M(5), 400 * U, fee);
        vm.prank(_M(5));
        c.repayDebt(400 * U);
        assertEq(c.bondRemaining(), 480 * U);
        assertEq(_debt(_M(5)), 0);
        assertEq(rep.reputationOf(_M(5)).repaid, 1);

        uint256 bal = usdc.balanceOf(_M(5));
        _settle(); // r5: only M5 left, frozen, wins with b = 0
        RoundInfo memory ri = c.roundInfo(5);
        assertEq(ri.winner, _M(5));
        assertEq(ri.pot, 400 * U);
        assertEq(ri.holdback, 0, "H = 0 for a frozen winner");
        assertEq(ri.payout, 400 * U - 4 * U - 4 * U, "nothing left to deduct: debt already repaid");
        assertEq(usdc.balanceOf(_M(5)) - bal, ri.payout);
        assertEq(c.liveCount(), 0);
        _assertLedger();
    }

    function test_RepayDebt_UncoveredGoesStraightToTheRoundWinner() public {
        _uncoveredShortfall();
        address winner = c.roundInfo(1).winner;
        vm.warp(_graceEnd(1) + 1);
        c.markDefault(_M(5));
        uint256 winnerBefore = usdc.balanceOf(winner);
        uint256 reserveBefore = c.reserve();
        Shortfall memory sf = c.shortfallOf(1, _M(5));
        uint256 fee = _feeOfParts(sf, _now() - sf.since);

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(1, _M(5), CoverSource.Uncovered, 40 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(1, _M(5), CoverSource.Reserve, 60 * U);
        vm.prank(_M(5));
        c.repayDebt(100 * U);

        assertEq(usdc.balanceOf(winner) - winnerBefore, 40 * U);
        assertEq(c.reserve(), reserveBefore + 60 * U + fee);
        _assertLedger();
        _assertConserved();
    }

    function test_RepayDebt_PartialSmallerThanUncovered_PaysOnlyTheWinner() public {
        _uncoveredShortfall();
        address winner = c.roundInfo(1).winner;
        vm.warp(_graceEnd(1) + 1);
        c.markDefault(_M(5));
        uint256 reserveBefore = c.reserve();
        uint256 winnerBefore = usdc.balanceOf(winner);
        vm.prank(_M(5));
        c.repayDebt(25 * U);
        assertEq(usdc.balanceOf(winner) - winnerBefore, 25 * U);
        Shortfall memory sf = c.shortfallOf(1, _M(5));
        assertEq(sf.uncovered, 15 * U);
        assertEq(sf.fromReserve, 60 * U, "reserve part untouched until uncovered is paid");
        assertGe(c.reserve(), reserveBefore, "only the late fee moved into the reserve");
        assertEq(_debt(_M(5)), 75 * U);
        _assertLedger();
    }

    function test_RepayDebt_Reverts() public {
        _m4DefaultedWithTwoShortfalls();
        // a live member with a shortfall cannot use repayDebt (it uses payLate)
        vm.prank(stranger);
        vm.expectRevert(IHuiCircle.NotMember.selector);
        c.repayDebt(1);
        vm.prank(_M(1));
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.repayDebt(1);
        // zero amount
        vm.prank(_M(4));
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.repayDebt(0);
        // above the principal still owed
        vm.prank(_M(4));
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.RepayTooLarge.selector, 200 * U + 1, 200 * U));
        c.repayDebt(200 * U + 1);
    }

    function test_RepayDebt_LiveMemberWithOpenShortfallCannotUseIt() public {
        _block(_M(5));
        _settle();
        assertEq(_debt(_M(5)), 100 * U);
        assertFalse(c.memberInfo(_M(5)).defaulted);
        _unblock(_M(5));
        vm.prank(_M(5));
        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.repayDebt(100 * U);
    }

    function test_RepayDebt_RevertsWhenAllowanceOrBalanceShort() public {
        _m4DefaultedWithTwoShortfalls();
        address m4 = _M(4);
        vm.warp(_now() + 60);
        // principal covered, fee not
        vm.prank(m4);
        usdc.approve(address(c), 50 * U);
        vm.prank(m4);
        vm.expectPartialRevert(IERC20Errors.ERC20InsufficientAllowance.selector);
        c.repayDebt(50 * U);
        assertEq(_debt(m4), 200 * U);
        assertEq(c.bondRemaining(), 360 * U);
        // nothing at all
        vm.prank(m4);
        usdc.approve(address(c), 0);
        vm.prank(m4);
        vm.expectPartialRevert(IERC20Errors.ERC20InsufficientAllowance.selector);
        c.repayDebt(1 * U);
        _assertLedger();
    }

    function test_RepayDebt_RevertsWhenFormingPausedOrCompleted() public {
        HuiCircleHarness forming = _create(_params());
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Forming));
        forming.repayDebt(1);

        _m4DefaultedWithTwoShortfalls();
        _pause();
        vm.prank(_M(4));
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.repayDebt(1);
        _unpause();

        _settleRounds(4, 5);
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        vm.prank(_M(4));
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Completed)
        );
        c.repayDebt(1);
    }

    // ================================================================== lateFeeOf

    function test_LateFeeOf_ZeroWithoutOpenShortfall() public {
        _m4FailsRound2();
        assertEq(c.lateFeeOf(_M(1), 2), 0);
        assertEq(c.lateFeeOf(_M(4), 1), 0, "M4 won round 1");
        assertEq(c.lateFeeOf(_M(4), 99), 0);
        assertEq(c.lateFeeOf(stranger, 2), 0);
        assertEq(c.lateFeeOf(_M(4), 2), 0, "no time has passed since the settlement");
    }

    function test_LateFeeOf_SumsPartsAndGrowsWithTime() public {
        _m4FailsRound2();
        uint256 t2 = c.roundInfo(2).settledAt;
        uint256 prev;
        for (uint256 dt = 6; dt <= 120; dt += 18) {
            vm.warp(t2 + dt);
            uint256 fee = c.lateFeeOf(_M(4), 2);
            assertEq(fee, _lateFee(20 * U, dt) + _lateFee(80 * U, dt));
            assertGe(fee, prev, "non-decreasing in time");
            prev = fee;
        }
    }

    function test_LateFeeOf_EqualsWhatPayLateCharges() public {
        _m4FailsRound2();
        _unblock(_M(4));
        vm.warp(c.roundInfo(2).settledAt + 77);
        uint256 quoted = c.lateFeeOf(_M(4), 2);
        uint256 reserveBefore = c.reserve();
        vm.prank(_M(4));
        c.payLate(2);
        assertEq(c.reserve() - reserveBefore, quoted);
        assertEq(c.lateFeeOf(_M(4), 2), 0);
    }

    function test_LateFeeOf_ShrinksWithPartialRepayment() public {
        _m4DefaultedWithTwoShortfalls();
        vm.warp(_now() + 30);
        uint256 before = c.lateFeeOf(_M(4), 3);
        assertGt(before, 0);
        vm.prank(_M(4));
        c.repayDebt(100 * U); // clears round 2 (100) first
        assertEq(c.lateFeeOf(_M(4), 2), 0);
        assertEq(c.lateFeeOf(_M(4), 3), before, "round 3 not touched yet");
    }

    // ================================================================== schedule fix M-01 (docs/03 section 3.2)

    /// @dev Round 1 settled late, then a pause of X seconds: round 2 moves by exactly X relative to before the pause
    /// and keeps its full commit, reveal and settle windows.
    function test_Schedule_LateSettleThenPause_MovesRoundStartByExactlyThePause() public {
        uint256 late = t0 + 1000;
        vm.warp(late);
        c.settleRound();
        assertEq(c.roundStart(2), late);

        vm.warp(late + 10);
        _pause();
        vm.warp(late + 510);
        _unpause(); // X = 500
        assertEq(c.pausedTotal(), 500);
        assertEq(c.roundStart(2), late + 500, "moved by X, not by X twice and not by 0");
        assertEq(c.deadline(2), late + 500 + 180);

        uint256 start = c.roundStart(2);
        vm.warp(start); // opens at its start
        _commit(_M(2), 2 * U);
        vm.warp(start + 89);
        _commit(_M(3), 1 * U);
        vm.warp(start + 90);
        vm.prank(_M(5));
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        c.commitBid(bytes32(uint256(1)));
        _reveal(_M(2), 2 * U); // reveal window is [start + 90, start + 150)
        vm.warp(start + 149);
        _reveal(_M(3), 1 * U);
        vm.warp(start + 150);
        vm.prank(_M(2));
        vm.expectRevert(IHuiCircle.NotInRevealWindow.selector);
        c.revealBid(2 * U, _salt(_M(2)));
        vm.warp(start + 179);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.TooEarly.selector, uint64(start + 180)));
        c.settleRound();
        vm.warp(start + 180);
        c.settleRound();
        assertEq(c.roundInfo(2).winner, _M(2));
    }

    /// @dev A pause that happened BEFORE the late settlement is already inside `settledAt`; it must not be added twice.
    function test_Schedule_PauseThenLateSettle_DoesNotCountThePauseTwice() public {
        vm.warp(t0 + 10);
        _pause();
        vm.warp(t0 + 210);
        _unpause(); // X = 200, round 1 deadline = t0 + 200 + 180
        assertEq(c.deadline(1), t0 + 380);
        vm.warp(t0 + 1000);
        c.settleRound();
        assertEq(c.roundStart(2), t0 + 1000, "= settledAt, the 200 s pause is already inside it");
        assertEq(c.deadline(2), t0 + 1180);
    }

    function test_Schedule_EarlySettleThenPause_ShiftsTheNominalScheduleByThePause() public {
        _settle(); // exactly on time: roundStart(2) = t0 + 180
        assertEq(c.roundStart(2), t0 + 180);
        _pauseFor(5, 300);
        assertEq(c.roundStart(2), t0 + 180 + 300);
        assertEq(c.roundStart(3), t0 + 360 + 300, "later rounds shift too");
    }

    function test_Schedule_TwoPausesAccumulate() public {
        _pauseFor(10, 100);
        _pauseFor(10, 250);
        assertEq(c.pausedTotal(), 350);
        assertEq(c.roundStart(1), t0 + 350);
        assertEq(c.deadline(1), t0 + 350 + 180);
        vm.warp(c.deadline(1) - 1);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.TooEarly.selector, uint64(t0 + 530)));
        c.settleRound();
    }

    // ================================================================== live winner with open debt (I-09)

    /// @dev Fixed circle: M2 fails round 1 and nobody calls markDefault; its grace expires before it wins round 2.
    function test_LiveWinnerWithExpiredGraceDebt_RepaysFromPot_ThenMarkDefaultHasNothingToDo() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        _newCircle(p, 480 * U);
        _block(_M(2));
        _settle(); // r1: M1 wins; M2 live, fails, bond covers 100
        _unblock(_M(2));
        vm.warp(_graceEnd(1) + 1);
        assertEq(_debt(_M(2)), 100 * U);

        _toDeadline();
        uint256 fee = _lateFee(100 * U, _now() - c.shortfallOf(1, _M(2)).since);
        c.settleRound(); // r2: M2 wins (joinIndex 1), repays from the pot
        RoundInfo memory ri = c.roundInfo(2);
        assertEq(ri.winner, _M(2));
        assertEq(_debt(_M(2)), 0);
        assertTrue(c.shortfallOf(1, _M(2)).resolved);
        // pot 400 - fee 4 - premium 4 - debt 100 - late fee - H (20% * 3 * 100 = 60)
        assertEq(ri.payout, 392 * U - 100 * U - fee - 60 * U);
        assertEq(c.bondRemaining(), 480 * U);

        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        c.markDefault(_M(2));
        assertFalse(c.memberInfo(_M(2)).defaulted);
        _assertLedger();
    }

    function test_LiveWinnerWithExpiredGraceDebt_CanStillBeDefaultedBeforeItWins() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        _newCircle(p, 480 * U);
        _block(_M(2));
        _settle();
        vm.warp(_graceEnd(1) + 1);
        c.markDefault(_M(2)); // Frozen: pushed to the end of the Fixed order
        _settle(); // r2: M3 wins, not M2
        assertEq(c.roundInfo(2).winner, _M(3));
        _assertLedger();
    }

    // ================================================================== reputation calls over a whole story

    function test_Reputation_OnTimeLateDefaultRepaidAreRecordedOnce() public {
        _m4FailsRound2();
        address m4 = _M(4);
        assertEq(rep.reputationOf(m4).late, 1);
        assertEq(rep.reputationOf(_M(1)).onTime, 1, "M1 paid round 1");
        vm.warp(_graceEnd(2) + 1);
        c.markDefault(m4);
        assertEq(rep.reputationOf(m4).defaults, 1);
        _unblock(m4);
        vm.prank(m4);
        c.repayDebt(100 * U);
        assertEq(rep.reputationOf(m4).repaid, 1);
        _settle(); // round 3: M4 is defaulted: pulled but neither on time nor late is recorded again
        assertEq(rep.reputationOf(m4).onTime, 0);
        assertEq(rep.reputationOf(m4).late, 1);
        assertEq(rep.reputationOf(m4).defaults, 1);
    }

    // ================================================================== fuzz: refund order (docs/03 section 6.8)

    function _h(uint256 seed, uint256 a, uint256 b) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, a, b)));
    }

    /// @dev Reads the four open parts of `debtor`'s shortfalls of rounds 1..3 and checks the refund-order shape:
    /// resolved <=> all four parts zero; a later source of a round is only reduced once every earlier source is
    /// zero; a later round is only reduced once every earlier round is resolved. Returns the sum of open parts.
    function _checkRefundShape(address debtor, uint256[3][4] memory start) internal view returns (uint256 total) {
        bool earlierOpen;
        for (uint32 r = 1; r <= 3; r++) {
            Shortfall memory sf = c.shortfallOf(r, debtor);
            uint256 open = _openPrincipal(sf);
            total += open;
            assertEq(sf.resolved, open == 0, "resolved <=> all four parts are zero");
            uint256[4] memory parts = [uint256(sf.uncovered), sf.fromReserve, sf.fromBond, sf.fromHoldback];
            bool reduced;
            bool earlierSourceOpen;
            for (uint256 i = 0; i < 4; i++) {
                assertLe(parts[i], start[i][r - 1], "parts only go down");
                if (parts[i] < start[i][r - 1]) {
                    reduced = true;
                    assertFalse(earlierSourceOpen, "source order: uncovered, reserve, bond, holdback");
                }
                if (parts[i] != 0) earlierSourceOpen = true;
            }
            if (reduced) assertFalse(earlierOpen, "oldest round first");
            if (open != 0) earlierOpen = true;
        }
    }

    function testFuzz_RepayOrder_RandomCompositionAndPartialRepayments(uint256 seed) public {
        address debtor = _M(5);
        uint256[3][4] memory start; // [source][round - 1]
        uint256 totalDebt;
        for (uint32 r = 1; r <= 3; r++) {
            uint256 u = _h(seed, r, 0) % 41 * U;
            uint256 rs = _h(seed, r, 1) % 41 * U;
            uint256 bd = _h(seed, r, 2) % 41 * U;
            uint256 hb = _h(seed, r, 3) % 41 * U;
            if (u + rs + bd + hb == 0) hb = 1 * U;
            start[0][r - 1] = u;
            start[1][r - 1] = rs;
            start[2][r - 1] = bd;
            start[3][r - 1] = hb;
            uint256 amount = u + rs + bd + hb;
            totalDebt += amount;
            c.exposed_setRoundWinner(r, _M(r));
            c.exposed_setShortfall(
                r,
                debtor,
                Shortfall({
                    amount: uint128(amount),
                    fromHoldback: uint128(hb),
                    fromBond: uint128(bd),
                    fromReserve: uint128(rs),
                    uncovered: uint128(u),
                    since: uint64(_now()),
                    resolved: false
                })
            );
        }
        c.exposed_setDebt(debtor, uint128(totalDebt));
        c.exposed_setDefaulted(debtor, true);
        c.exposed_setSettled(3);
        _unblock(debtor);
        uint256 supply = usdc.totalSupply();

        uint256 remaining = totalDebt;
        for (uint256 step = 0; step < 6 && remaining > 0; step++) {
            uint256 amount = step == 5 ? remaining : 1 + _h(seed, 100 + step, 0) % remaining;
            vm.warp(_now() + _h(seed, 100 + step, 1) % 500);
            uint256[3] memory winnerBal = [usdc.balanceOf(_M(1)), usdc.balanceOf(_M(2)), usdc.balanceOf(_M(3))];
            uint256 uncoveredBefore;
            for (uint32 r = 1; r <= 3; r++) {
                uncoveredBefore += c.shortfallOf(r, debtor).uncovered;
            }
            vm.prank(debtor);
            c.repayDebt(amount);
            remaining -= amount;

            uint256 open = _checkRefundShape(debtor, start);
            assertEq(open, remaining, "open parts == remaining principal");
            assertEq(c.memberInfo(debtor).debt, remaining, "debt == sum of the open parts");
            uint256 uncoveredAfter;
            for (uint32 r = 1; r <= 3; r++) {
                uncoveredAfter += c.shortfallOf(r, debtor).uncovered;
            }
            uint256 paidToWinners = usdc.balanceOf(_M(1)) + usdc.balanceOf(_M(2)) + usdc.balanceOf(_M(3)) - winnerBal[0]
                - winnerBal[1] - winnerBal[2];
            assertEq(paidToWinners, uncoveredBefore - uncoveredAfter, "uncovered is paid to the round winners");
            assertEq(usdc.totalSupply(), supply, "no USDC created");
            _assertLedger();
        }
        assertEq(remaining, 0);
        assertEq(rep.reputationOf(debtor).repaid, 1, "recordRepaid exactly when debt hits zero");
        assertEq(c.memberInfo(debtor).debt, 0);
    }

    // ================================================================== INV-08 (docs/03 sections 7.2 and 7.3)

    /// @dev One round of the INV-08 scenarios: random sealed bids by live members, markDefault pokes at the deadline
    /// (the grace of the previous round is over by then), then settlement. Returns the round record.
    function _inv08Round(uint256 seed, uint32 k) internal returns (RoundInfo memory ri, uint256 live) {
        if (c.liveCount() > 1) {
            uint256 max = c.maxBid(k);
            address[5] memory who;
            uint256[5] memory bids;
            uint256 count;
            for (uint256 j = 1; j <= 5; j++) {
                MemberInfo memory mi = c.memberInfo(_M(j));
                if (mi.received || mi.defaulted || mi.debt != 0 || _h(seed, k, j * 10 + 2) % 3 == 0) continue;
                uint256 bid = _h(seed, k, j * 10 + 3) % (max + 1);
                _commit(_M(j), bid);
                who[count] = _M(j);
                bids[count] = bid;
                count++;
            }
            _toReveal();
            for (uint256 i = 0; i < count; i++) {
                if (_h(seed, k, i * 10 + 4) % 6 != 0) _reveal(who[i], bids[i]);
            }
        }
        _toDeadline();
        for (uint256 j = 1; j <= 5; j++) {
            try c.markDefault(_M(j)) {} catch {}
        }
        live = c.liveCount();
        c.settleRound();
        ri = c.roundInfo(k);
        _assertLedger();
    }

    /// @dev docs/03 section 7.3, the case the proof covers: coverage index 100% (alpha 20% + bond 0.8 * O_max) and
    /// every defaulter is a member who already received and they all stop paying right after the same round m
    /// (any non-empty subset of the m dead members). Then nothing is ever left uncovered and each winner's pot is
    /// exactly what the honest members and the covered shortfalls add up to.
    function testFuzz_INV08_DeadMembersStopTogetherAfterRoundM_EveryRoundPaysItsFullPot(uint256 seed) public {
        uint32 m = uint32(1 + _h(seed, 0, 0) % 4);
        uint256 mask = 1 + _h(seed, 0, 1) % ((1 << m) - 1); // non-empty subset of the dead members, by win order
        for (uint32 k = 1; k <= 5; k++) {
            if (k == m + 1) {
                for (uint256 j = 1; j <= 5; j++) {
                    if (c.memberInfo(_M(j)).received && (mask >> (c.memberInfo(_M(j)).receivedRound - 1)) & 1 == 1) {
                        _block(_M(j)); // never unblocked again
                    }
                }
            }
            (RoundInfo memory ri, uint256 live) = _inv08Round(seed, k);
            assertEq(ri.uncovered, 0, "INV-08: nobody is short-changed");
            uint256 expectedPot = (live - 1) * (100 * U - ri.winningBid) + (5 - live) * 100 * U;
            assertEq(ri.pot, expectedPot, "the winner's pot is complete");
            assertEq(uint256(ri.payout) + ri.fee + ri.premium + ri.holdback, ri.pot, "INV-05");
            assertLe(c.bondRemaining(), 480 * U);
        }
        assertEq(c.settledRounds(), 5);
    }

    /// @notice Documented limit of INV-08 (docs/03 sections 2.3, 7.2 and 7.3, decision A6): coverage index 100% only
    /// covers the peak simultaneous shock (every receiver who defaults stops in the SAME round). If the receivers
    /// stop one after the other, right after each of them wins (M1 after round 1, M2 after round 2, M3 after round 3,
    /// M4 after round 4), the unpaid contributions add up to N(N-1)/2 * C = 1000, not O_max = 600: the bond (480) and
    /// the reserve (16) run dry and the honest last winner M5 receives 94.08 of a possible 392 in round 5. Full
    /// sequential coverage would need B_seq = (1 - alpha) * N(N-1)/2 * C = 800 (roadmap, "bao chung toan phan").
    /// This test asserts those documented numbers; if the docs or the bond rule change, it must change with them.
    function test_INV08_SequentialDefaults_ExceedBond_Documented() public {
        _settle(); // r1: M1 wins (no bids)
        _block(_M(1));
        _settle(); // r2: M2 wins; M1 stops paying
        _block(_M(2));
        _settle(); // r3
        _block(_M(3));
        _settle(); // r4
        assertEq(c.bondRemaining(), 60 * U, "bond almost gone after round 4");
        for (uint32 r = 2; r <= 4; r++) {
            assertEq(c.roundInfo(r).uncovered, 0, "rounds 2-4 are still fully covered");
        }
        _block(_M(4));
        _settle(); // r5: M5 is the honest last winner; M1..M4 all fail
        RoundInfo memory ri = c.roundInfo(5);
        assertEq(c.bondRemaining(), 0);
        assertEq(ri.winner, _M(5));
        assertEq(ri.uncovered, 304 * U, "documented: sequential defaults exceed the bond (docs/03 7.3), uncovered 304");
        assertEq(ri.pot, 96 * U);
        assertEq(ri.payout, 94_080_000);
        assertEq(c.reserve(), ri.premium, "the reserve was emptied by the cascade; only the new premium is in it");
        _assertLedger();
    }
}
