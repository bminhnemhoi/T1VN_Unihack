// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {
    CircleParams,
    CircleState,
    CoverSource,
    MemberInfo,
    RoundInfo,
    RoundPhase,
    Shortfall
} from "../../src/libraries/HuiTypes.sol";

/// @notice C7 `finalize` (docs/03 section 5.3) and the docs/03 section 8 worked example at C = 100 USDC, both
/// branches, with exact numbers. Circle: N = 5, C = 100, alpha 20%, bond 480; actors[0..4] are M1..M5.
contract HuiCircleFinalizeTest is CircleScenario {
    address internal stranger = makeAddr("stranger");

    // ------------------------------------------------------------------ the two branches of docs/03 section 8

    /// @dev Branch B: M4 never pays after round 1. Ends with every round settled and M4 marked defaulted; the clock
    /// is at the settlement of round 5.
    function _branchB() internal {
        _round1();
        _round2Bids();
        _block(_M(4));
        _settle(); // round 2: M1 wins with 3, M4 cannot pay
        assertEq(c.bondRemaining(), 460 * U, "bond 480 - 20");
        vm.warp(_graceEnd(2) + 1);
        c.markDefault(_M(4));
        _settle(); // round 3
        assertEq(c.bondRemaining(), 360 * U);
        _settle(); // round 4
        assertEq(c.bondRemaining(), 260 * U);
        _settle(); // round 5
        assertEq(c.bondRemaining(), 160 * U);
    }

    /// @dev Branch A: M4 pays late inside the grace period (one nominal day = 6 s at the demo clock), then pays on
    /// time in rounds 3-5.
    function _branchA() internal {
        _round1();
        _round2Bids();
        _block(_M(4));
        _settle();
        _unblock(_M(4));
        vm.warp(c.roundInfo(2).settledAt + 6);
        vm.prank(_M(4));
        c.payLate(2);
        for (uint32 k = 3; k <= 5; k++) {
            _settle();
            // INV-06 with equality: every dead member holds alpha * (N - k) * C.
            for (uint256 i = 1; i <= 5; i++) {
                if (c.memberInfo(_M(i)).received) {
                    assertEq(c.memberInfo(_M(i)).holdback, 20 * U * (5 - k), "holdback = alpha (N - m) C");
                }
            }
            _assertLedger();
        }
    }

    function test_WorkedExample_BranchB_M4NeverPays_BondEndsAt160() public {
        _branchB();
        // M4 caused 4 x 100 = 400 of shortfall: 80 from its own holdback, 320 from the bond.
        uint256 fromHoldback;
        uint256 fromBond;
        for (uint32 r = 1; r <= 5; r++) {
            Shortfall memory sf = c.shortfallOf(r, _M(4));
            fromHoldback += sf.fromHoldback;
            fromBond += sf.fromBond;
            assertEq(sf.uncovered, 0, "INV-08: nobody short-changed");
        }
        assertEq(fromHoldback, 80 * U);
        assertEq(fromBond, 320 * U);
        assertEq(c.memberInfo(_M(4)).debt, 400 * U);
        assertEq(c.roundInfo(3).uncovered + c.roundInfo(4).uncovered + c.roundInfo(5).uncovered, 0);
        // Fee escrow: round 2 forfeited at markDefault; round 1 had no shortfall and was paid to the organizer at once;
        // rounds 3-5 (M4's shortfalls) are still in escrow.
        assertTrue(c.roundInfo(2).feeForfeited);
        assertEq(c.totalFeeEscrow(), 4 * U + 4 * U + 4 * U);
        // Reserve: premiums 3.76 + 3.91 + 3 x 4, plus the forfeited 3.91 fee.
        assertEq(c.reserve(), 23_580_000);
        assertEq(c.totalHoldback(), 0, "every holdback was released round by round");
        _assertLedger();

        uint256 orgBefore = usdc.balanceOf(organizer);
        uint256[5] memory before;
        for (uint256 i = 1; i <= 5; i++) {
            before[i - 1] = usdc.balanceOf(_M(i));
        }
        assertEq(factory.activeCirclesOf(organizer), 1);
        vm.warp(_graceEnd(5) + 1); // the grace of round 5 ends 120 s after its settlement
        vm.recordLogs();
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleFinalized(160 * U, 12 * U, 23_580_000);
        vm.prank(stranger); // anyone
        c.finalize();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_count(logs, IHuiCircle.HoldbackReleased.selector), 0, "no holdback left to pay at the end");

        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        assertEq(usdc.balanceOf(organizer) - orgBefore, 160 * U + 12 * U, "bond 160 + escrowed fees of rounds 3-5");
        for (uint256 i = 1; i <= 5; i++) {
            uint256 got = usdc.balanceOf(_M(i)) - before[i - 1];
            // reserve 23.58 shared among M1, M2, M3, M5 (not the defaulted M4): 5.895 each, no dust
            assertEq(got, i == 4 ? 0 : 5_895_000, "reserve share");
        }
        assertEq(rep.reputationOf(_M(4)).completed, 0);
        assertEq(rep.reputationOf(_M(4)).defaults, 1);
        assertEq(rep.reputationOf(_M(4)).late, 1);
        for (uint256 i = 1; i <= 5; i++) {
            if (i != 4) assertEq(rep.reputationOf(_M(i)).completed, 1);
        }
        assertEq(factory.activeCirclesOf(organizer), 0);
        assertEq(c.bondRemaining() + c.reserve() + c.totalHoldback() + c.totalFeeEscrow(), 0);
        assertEq(
            c.memberInfo(_M(4)).debt,
            320 * U,
            "400 minus the 80 its own holdback paid (H-01): the rest is a public claim"
        );
        assertEq(c.shortfallOf(2, _M(4)).fromHoldback, 0);
        assertEq(c.shortfallOf(2, _M(4)).fromBond, 20 * U, "bond parts stay on the books");
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(c.totalClaimable(), 0);
        _assertConserved();
    }

    /// @dev Documents an open product gap (not a fix): after `finalize` the debt stays on the books as a public claim
    /// (docs/03 sections 5.3 step 8 and 6.8), but `repayDebt` requires Active, so the defaulter can no longer repay it
    /// on chain and `recordRepaid` can never happen. The /api/attest eligibility rule (defaults > repaid) then refuses
    /// this wallet in every future circle. Changing this is a rule change for the maintainers (docs/03 first).
    function test_Gap_DebtLeftAtFinalize_CannotBeRepaidOnChain_Documented() public {
        _branchB();
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        uint256 debt = c.memberInfo(_M(4)).debt;
        assertEq(debt, 320 * U, "the public claim left after finalize");

        _unblock(_M(4)); // M4 now wants to pay, has the USDC and the allowance
        assertGe(usdc.balanceOf(_M(4)), debt, "M4 can afford the repayment");
        vm.prank(_M(4));
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Completed)
        );
        c.repayDebt(debt);

        // Nothing moved, and the registry keeps the default without any way to record a repayment.
        assertEq(c.memberInfo(_M(4)).debt, debt);
        assertEq(rep.reputationOf(_M(4)).defaults, 1);
        assertEq(rep.reputationOf(_M(4)).repaid, 0);
        assertEq(usdc.balanceOf(address(c)), 0);
    }

    /// @dev Documents a second gap: `recordRepaid` is written only by `repayDebt`. A frozen member whose own pot pays
    /// off its whole debt (docs/03 section 6.6) ends with debt 0 but the registry still shows an unrepaid default,
    /// so the /api/attest rule (defaults > repaid) refuses the wallet in every later circle although it owes nothing.
    function test_Gap_FrozenPotClearsDebt_RegistryStillShowsUnrepaidDefault_Documented() public {
        _settleRounds(1, 3); // M1, M2, M3 receive (nobody bids)
        _block(_M(5));
        _settle(); // round 4: M4 receives, M5 (live) cannot pay its 100
        vm.warp(_graceEnd(4) + 1);
        c.markDefault(_M(5)); // M5 is frozen
        assertGt(c.memberInfo(_M(5)).debt, 0);
        _settle(); // round 5: only the frozen M5 is left, its pot repays the debt first
        assertTrue(c.memberInfo(_M(5)).received);
        assertEq(c.memberInfo(_M(5)).debt, 0, "the pot paid the whole debt");
        assertEq(rep.reputationOf(_M(5)).defaults, 1);
        assertEq(rep.reputationOf(_M(5)).repaid, 0, "no recordRepaid although nothing is owed");
    }

    function test_WorkedExample_BranchA_M4PaysLate_HoldbackBackAndFinalizePaysNoHoldback() public {
        _branchA();
        assertEq(c.bondRemaining(), 480 * U, "payLate refilled the bond");
        assertEq(c.totalHoldback(), 0);
        assertEq(c.reserve(), 3_760_000 + 3_910_000 + 27_396 + 3 * 4 * U, "premiums + late fee");
        assertEq(c.totalFeeEscrow(), 3_910_000, "no fee forfeited; only round 2 (shortfall) waits in escrow");

        uint256 orgBefore = usdc.balanceOf(organizer);
        uint256[5] memory before;
        for (uint256 i = 1; i <= 5; i++) {
            before[i - 1] = usdc.balanceOf(_M(i));
        }
        vm.warp(_graceEnd(5) + 1);
        vm.recordLogs();
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleFinalized(480 * U, 3_910_000, 19_697_396);
        c.finalize();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_count(logs, IHuiCircle.HoldbackReleased.selector), 0, "finalize pays 0 holdback");

        assertEq(usdc.balanceOf(organizer) - orgBefore, 480 * U + 3_910_000);
        // ADR-24, vector V1: weights 4, 4, 4, 3 (M4 paid late once), 4 over 19: floor shares sum to 19_697_395,
        // the one unit of dust goes to M1 (smallest joinIndex with a positive weight).
        uint256[5] memory v1 = [uint256(4_146_821), 4_146_820, 4_146_820, 3_110_115, 4_146_820];
        for (uint256 i = 1; i <= 5; i++) {
            assertEq(usdc.balanceOf(_M(i)) - before[i - 1], v1[i - 1], "reserve split by on-time weight");
            assertEq(rep.reputationOf(_M(i)).completed, 1);
        }
        assertEq(rep.reputationOf(_M(4)).defaults, 0);
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(factory.activeCirclesOf(organizer), 0);
        _assertConserved();
    }

    // ================================================================== preconditions

    function test_Finalize_RevertsBeforeRoundNIsSettled() public {
        vm.expectRevert(IHuiCircle.PreviousRoundNotSettled.selector);
        c.finalize(); // no round settled
        _settleRounds(1, 4);
        vm.warp(_now() + 100_000);
        vm.expectRevert(IHuiCircle.PreviousRoundNotSettled.selector);
        c.finalize(); // round 5 still open
    }

    /// @dev L-03 (docs/03 section 5.3): `now > settledAt(N) + G`, strict, so the last second of the grace period
    /// (where `payLate` still works) is not yet a second where `finalize` works.
    function test_Finalize_GraceBoundary_RevertsAtGraceEndN_WorksOneSecondLater() public {
        _settleRounds(1, 5);
        vm.warp(_graceEnd(5) - 1);
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.finalize();
        vm.warp(_graceEnd(5));
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.finalize();
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        assertEq(uint8(c.phase()), uint8(RoundPhase.Done), "a completed circle reports Done");
    }

    function _pauseFor(uint256 at, uint256 len) internal {
        vm.warp(_now() + at);
        vm.prank(admin);
        factory.pauseCircle(address(c));
        vm.warp(_now() + len);
        vm.prank(admin);
        factory.unpauseCircle(address(c));
    }

    function test_Finalize_AFinishedPauseAfterRoundNExtendsTheWait() public {
        _settleRounds(1, 5);
        uint256 t5 = c.roundInfo(5).settledAt;
        _pauseFor(10, 400);
        vm.warp(t5 + GRACE + 400);
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.finalize();
        vm.warp(t5 + GRACE + 400 + 1);
        c.finalize();
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
    }

    function test_Finalize_APauseBeforeRoundNWasSettledDoesNotExtendTheWait() public {
        _settleRounds(1, 4);
        _pauseFor(10, 400);
        _settle(); // round 5, on its (shifted) deadline
        uint256 t5 = c.roundInfo(5).settledAt;
        vm.warp(t5 + GRACE);
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.finalize();
        vm.warp(t5 + GRACE + 1);
        c.finalize();
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
    }

    function test_Finalize_RevertsWhenFormingPausedOrCompleted() public {
        HuiCircleHarness forming = _create(_params());
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Forming));
        forming.finalize();

        _settleRounds(1, 5);
        vm.warp(_graceEnd(5) + 1);
        vm.prank(admin);
        factory.pauseCircle(address(c));
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.finalize();
        vm.prank(admin);
        factory.unpauseCircle(address(c));

        vm.warp(_graceEnd(5) + 10);
        c.finalize();
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Completed)
        );
        c.finalize();
    }

    function test_Finalize_CompletedCircleRejectsEveryRoundFunction() public {
        _settleRounds(1, 5);
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        bytes memory wrong =
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Completed);
        vm.expectRevert(wrong);
        c.settleRound();
        vm.prank(_M(1));
        vm.expectRevert(wrong);
        c.commitBid(bytes32(uint256(1)));
        vm.prank(_M(1));
        vm.expectRevert(wrong);
        c.revealBid(0, bytes32(0));
        vm.prank(_M(1));
        vm.expectRevert(wrong);
        c.payLate(1);
    }

    function test_Finalize_GraceOfAnOpenRoundNShortfall_BlocksUntilItEnds_ThenDefaultsAutomatically() public {
        _settleRounds(1, 4);
        _block(_M(3)); // M3 won round 3 (dead), holds 20 at this point
        _settle(); // round 5
        Shortfall memory sf = c.shortfallOf(5, _M(3));
        assertEq(sf.fromHoldback, 20 * U);
        assertEq(sf.fromBond, 80 * U);
        assertEq(c.feeEscrow(5), 4 * U);

        vm.warp(_graceEnd(5)); // last second of grace: M3's round-5 grace has not passed yet
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.finalize();
        assertEq(uint8(c.state()), uint8(CircleState.Active));
        assertFalse(c.memberInfo(_M(3)).defaulted);

        vm.warp(_graceEnd(5) + 1);
        uint256 orgBefore = usdc.balanceOf(organizer);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.FeeForfeited(5, 4 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.MemberDefaulted(_M(3), 5, false);
        // bond 400 back; the fees of rounds 1-4 were paid at settlement (no shortfall); reserve = 5 premiums (20) + forfeited fee (4) = 24
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleFinalized(400 * U, 0, 24 * U);
        c.finalize();

        assertTrue(c.memberInfo(_M(3)).defaulted);
        assertEq(rep.reputationOf(_M(3)).defaults, 1);
        assertEq(rep.reputationOf(_M(3)).completed, 0);
        assertEq(usdc.balanceOf(organizer) - orgBefore, 400 * U);
        assertEq(
            c.memberInfo(_M(3)).debt, 80 * U, "100 minus the 20 its own holdback paid (H-01); the rest stays public"
        );
        assertEq(usdc.balanceOf(address(c)), 0);
        _assertConserved();
    }

    function test_Finalize_RoundNShortfallPaidInGrace_FinishesNormally() public {
        _settleRounds(1, 4);
        _block(_M(3));
        _settle();
        _unblock(_M(3));
        vm.warp(c.roundInfo(5).settledAt + 10);
        vm.prank(_M(3));
        c.payLate(5); // restores holdback 20 + bond 80 and releases alpha*C = 20 again
        assertEq(c.memberInfo(_M(3)).holdback, 0);
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        assertFalse(c.memberInfo(_M(3)).defaulted);
        assertEq(rep.reputationOf(_M(3)).completed, 1);
        assertEq(usdc.balanceOf(address(c)), 0);
        _assertConserved();
    }

    // ================================================================== payments: blocked recipients, dust, all defaulted

    function test_Finalize_BlockedRecipientsGoToClaimable_ThenClaim() public {
        _settleRounds(1, 5);
        vm.warp(_graceEnd(5) + 1);
        usdc.setBlacklisted(organizer, true);
        usdc.setBlacklisted(_M(1), true);
        usdc.setBlacklisted(_M(3), true);
        // reserve = 5 x 4 = 20 -> 4 each; the bond 480 to the organizer (fees were paid at settlement)
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(organizer, 480 * U);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(_M(1), 4 * U);
        c.finalize();

        assertEq(uint8(c.state()), uint8(CircleState.Completed), "one blocked address cannot block the others");
        assertEq(c.claimable(organizer), 480 * U);
        assertEq(c.claimable(_M(1)), 4 * U);
        assertEq(c.claimable(_M(3)), 4 * U);
        assertEq(c.totalClaimable(), 488 * U);
        assertEq(usdc.balanceOf(address(c)), 488 * U, "contract holds exactly what is claimable");
        _assertLedger();

        // still blocked: claim reverts and keeps the entitlement
        vm.prank(organizer);
        vm.expectPartialRevert(MockUSDC.Blacklisted.selector);
        c.claim();
        assertEq(c.claimable(organizer), 480 * U);

        usdc.setBlacklisted(organizer, false);
        usdc.setBlacklisted(_M(1), false);
        usdc.setBlacklisted(_M(3), false);
        uint256 orgBefore = usdc.balanceOf(organizer);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.Claimed(organizer, 480 * U);
        vm.prank(organizer);
        c.claim();
        vm.prank(_M(1));
        c.claim();
        vm.prank(_M(3));
        c.claim();
        assertEq(usdc.balanceOf(organizer) - orgBefore, 480 * U);
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(c.totalClaimable(), 0);
        vm.prank(_M(1));
        vm.expectRevert(IHuiCircle.NothingToClaim.selector);
        c.claim();
        _assertConserved();
    }

    function test_Finalize_ReserveDustGoesToSmallestJoinIndex_EvenWhenItIsBlocked() public {
        // Branch A leaves 19_697_396 in the reserve: by on-time weight (V1) M1 gets 4_146_820 and the dust of 1.
        _branchA();
        vm.warp(_graceEnd(5) + 1);
        usdc.setBlacklisted(_M(1), true);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(_M(1), 4_146_821);
        c.finalize();
        assertEq(c.claimable(_M(1)), 4_146_821, "share + dust deferred, not lost");
        _assertLedger();
    }

    /// @dev Audit L-03: every non-defaulted member was late N - 1 times, so every weight is 0 and the reserve is split
    /// equally; `ReserveShared` reports weight 0 for them.
    function test_Finalize_AllWeightsZero_SplitsEquallyAmongNonDefaulted() public {
        _settleRounds(1, 5);
        for (uint256 i = 1; i <= 5; i++) {
            c.exposed_setLateCount(_M(i), 4);
        }
        vm.warp(_graceEnd(5) + 1);
        uint256[5] memory before;
        for (uint256 i = 1; i <= 5; i++) {
            before[i - 1] = usdc.balanceOf(_M(i));
        }
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.ReserveShared(_M(1), 4 * U, 0);
        c.finalize();
        for (uint256 i = 1; i <= 5; i++) {
            assertEq(usdc.balanceOf(_M(i)) - before[i - 1], 4 * U, "equal share (reserve 20 / 5)");
        }
        _assertConserved();
    }

    /// @dev Audit I-03: the dust of the split goes to the smallest `joinIndex` that has a positive weight, not to a
    /// first member whose weight is 0.
    function test_Finalize_DustSkipsZeroWeightFirstMember() public {
        _settleRounds(1, 5);
        c.exposed_setLateCount(_M(1), 4); // weight 0
        usdc.mint(address(c), 1);
        c.exposed_setReserve(c.reserve() + 1); // 20_000_001: floor shares leave 1 unit of dust
        vm.warp(_graceEnd(5) + 1);
        uint256 m1 = usdc.balanceOf(_M(1));
        uint256 m2 = usdc.balanceOf(_M(2));
        c.finalize();
        assertEq(usdc.balanceOf(_M(1)) - m1, 0, "weight 0: no share and no dust");
        assertEq(usdc.balanceOf(_M(2)) - m2, 5 * U + 1, "M2 is the first member with a positive weight");
        assertEq(rep.reputationOf(_M(1)).completed, 1, "completion is still recorded for a member with weight 0");
    }

    function test_Finalize_EveryMemberDefaulted_ReserveGoesToTheOrganizer() public {
        _settleRounds(1, 5);
        for (uint256 i = 1; i <= 5; i++) {
            c.exposed_setDefaulted(_M(i), true);
        }
        vm.warp(_graceEnd(5) + 1);
        uint256 orgBefore = usdc.balanceOf(organizer);
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleFinalized(480 * U, 0, 20 * U);
        c.finalize();
        assertEq(
            usdc.balanceOf(organizer) - orgBefore, 480 * U + 20 * U, "bond + reserve (fees were paid at settlement)"
        );
        for (uint256 i = 1; i <= 5; i++) {
            assertEq(rep.reputationOf(_M(i)).completed, 0);
        }
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(usdc.balanceOf(admin), 0);
        _assertConserved();
    }

    function test_Finalize_FullCircleWithBids_PaysEverythingAndStrandsNothing() public {
        _round1();
        _round2Bids();
        _settle();
        _settleRounds(3, 5);
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        assertEq(usdc.balanceOf(address(c)), 0, "nothing stranded");
        assertEq(c.totalClaimable(), 0);
        assertEq(c.revealBondsHeld(), 0);
        assertEq(c.totalHoldback(), 0);
        _assertConserved();
    }

    // ================================================================== holdback of a defaulted member at the end

    /// @dev Alpha 100%, no bond. M1 wins round 1 (holds 392), is flagged defaulted before round 2 so it never gets a
    /// release, and carries a hand-made round-2 shortfall of 100 = 30 uncovered (owed to M2, the round-2 winner) +
    /// 20 reserve + 40 bond + 10 holdback. All five rounds are settled; the clock is at the settlement of round 5.
    function _mixedDefaultSetup(uint256 m1Holdback) internal {
        CircleParams memory p = _params();
        p.alphaBps = 10_000;
        _newCircle(p, 0);
        _settle(); // round 1: M1 wins, H = min(400, 392) = 392
        assertEq(c.memberInfo(_M(1)).holdback, 392 * U);
        c.exposed_setDefaulted(_M(1), true);
        _settle(); // round 2: M2 wins; M1 (defaulted dead) is still pulled C and gets no release
        c.exposed_setShortfall(
            2,
            _M(1),
            Shortfall({
                amount: uint128(100 * U),
                fromHoldback: uint128(10 * U),
                fromBond: uint128(40 * U),
                fromReserve: uint128(20 * U),
                uncovered: uint128(30 * U),
                since: c.roundInfo(2).settledAt,
                resolved: false
            })
        );
        c.exposed_setDebt(_M(1), uint128(100 * U));
        _settleRounds(3, 5);
        assertEq(c.memberInfo(_M(1)).holdback, 392 * U, "defaulted: never released");
        if (m1Holdback != 392 * U) {
            // keep the ledger identity: the difference moves between the holdback and the reserve
            c.exposed_setHoldback(_M(1), uint128(m1Holdback));
            c.exposed_setReserve(c.reserve() + 392 * U - m1Holdback);
        }
        _assertLedger();
        assertEq(c.totalHoldback(), m1Holdback, "only M1 still holds anything");
    }

    /// @dev H-01 (docs/03 section 5.3 step 2): the part covered by M1's own holdback (10) is forgiven first, with no
    /// transfer and no fee; the remaining holdback then repays uncovered, reserve and bond (90) plus their fee.
    function test_Finalize_DefaultedMembersHoldbackRepaysItsDebtInRefundOrder() public {
        _mixedDefaultSetup(392 * U);
        vm.warp(_graceEnd(5) + 1);
        Shortfall memory sf = c.shortfallOf(2, _M(1));
        uint256 elapsed = _now() - sf.since;
        uint256 fee = _lateFee(30 * U, elapsed) + _lateFee(20 * U, elapsed) + _lateFee(40 * U, elapsed);
        assertGt(fee, 0);
        uint256 reserveBefore = c.reserve();
        uint256 m1Before = usdc.balanceOf(_M(1));
        uint256 m2Before = usdc.balanceOf(_M(2));
        uint256 orgBefore = usdc.balanceOf(organizer);
        uint256 reserveTotal = reserveBefore + 20 * U + fee;
        uint256 share = reserveTotal / 4;
        uint256 dust = reserveTotal - share * 4;

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, _M(1), CoverSource.Holdback, 10 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, _M(1), CoverSource.Uncovered, 30 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, _M(1), CoverSource.Reserve, 20 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, _M(1), CoverSource.Bond, 40 * U);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(_M(1), 90 * U, fee);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.HoldbackReleased(_M(1), 5, 392 * U - 90 * U - fee);
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleFinalized(40 * U, 0, reserveTotal);
        c.finalize();

        assertEq(usdc.balanceOf(_M(1)) - m1Before, 392 * U - 90 * U - fee, "rest of its holdback");
        assertEq(
            usdc.balanceOf(_M(2)) - m2Before,
            30 * U + share + dust,
            "M2 is made whole first (uncovered), then shares the reserve and takes the dust"
        );
        assertEq(usdc.balanceOf(organizer) - orgBefore, 40 * U, "restored bond (fees were paid at settlement)");
        assertEq(c.memberInfo(_M(1)).debt, 0);
        assertTrue(c.shortfallOf(2, _M(1)).resolved);
        assertEq(rep.reputationOf(_M(1)).completed, 0);
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(c.totalClaimable(), 0);
        _assertConserved();
    }

    function test_Finalize_LateFeeThatTheHoldbackCannotCover_IsAnnouncedNotStored() public {
        _mixedDefaultSetup(91 * U); // 90 of principal after forgiving the own-holdback part, 1 USDC left for the fee
        vm.warp(_graceEnd(5) + 1);
        Shortfall memory sf = c.shortfallOf(2, _M(1));
        uint256 elapsed = _now() - sf.since;
        uint256 feeDue = _lateFee(30 * U, elapsed) + _lateFee(20 * U, elapsed) + _lateFee(40 * U, elapsed);
        assertGt(feeDue, 1 * U, "scenario needs a fee larger than what is left");
        uint256 m1Before = usdc.balanceOf(_M(1));

        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.LateFeeUnpaid(_M(1), feeDue - 1 * U);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(_M(1), 90 * U, 1 * U);
        c.finalize();

        assertEq(usdc.balanceOf(_M(1)), m1Before, "91 = 90 principal + 1 fee: nothing is left to return");
        assertEq(c.memberInfo(_M(1)).debt, 0, "principal cleared; the unpaid fee is not a debt");
        assertTrue(c.shortfallOf(2, _M(1)).resolved);
        assertEq(usdc.balanceOf(address(c)), 0);
        _assertConserved();
    }

    function test_Finalize_HoldbackSmallerThanPrincipal_PaysUncoveredFirstAndLeavesTheRestOwed() public {
        _mixedDefaultSetup(50 * U);
        vm.warp(_graceEnd(5) + 1);
        Shortfall memory sf = c.shortfallOf(2, _M(1));
        uint256 elapsed = _now() - sf.since;
        uint256 feeDue = _lateFee(30 * U, elapsed) + _lateFee(20 * U, elapsed);
        uint256 m1Before = usdc.balanceOf(_M(1));
        uint256 m2Before = usdc.balanceOf(_M(2));

        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.LateFeeUnpaid(_M(1), feeDue);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.DebtRepaid(_M(1), 50 * U, 0);
        c.finalize();

        assertEq(usdc.balanceOf(_M(1)), m1Before, "nothing left for M1");
        assertGe(usdc.balanceOf(_M(2)) - m2Before, 30 * U, "M2 gets the uncovered part first");
        sf = c.shortfallOf(2, _M(1));
        assertEq(sf.uncovered, 0);
        assertEq(sf.fromReserve, 0);
        assertEq(sf.fromBond, 40 * U, "what the holdback could not repay stays on the books");
        assertEq(sf.fromHoldback, 0, "own-holdback part forgiven (H-01)");
        assertFalse(sf.resolved);
        assertEq(c.memberInfo(_M(1)).debt, 40 * U);
        assertEq(c.reserve(), 0, "the restored reserve part was shared out with the rest");
        assertEq(usdc.balanceOf(address(c)), 0);
        _assertConserved();
    }

    // ================================================================== fuzz: whole circle, random failures and pokes

    function _h(uint256 seed, uint256 a, uint256 b, uint256 salt) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, a, b, salt)));
    }

    function _warpForward(uint256 t) internal {
        if (t > _now()) vm.warp(t);
    }

    function _fuzzBids(uint256 seed, uint32 k) internal {
        if (c.liveCount() <= 1) return;
        _warpForward(c.roundStart(k));
        uint256 max = c.maxBid(k);
        address[5] memory who;
        uint256[5] memory bids;
        uint256 count;
        for (uint256 j = 1; j <= 5; j++) {
            MemberInfo memory mi = c.memberInfo(_M(j));
            if (mi.received || mi.defaulted || mi.debt != 0) continue;
            if (_h(seed, k, j, 1) % 3 != 0) continue;
            uint256 bid = _h(seed, k, j, 2) % (max + 1);
            if (_now() >= c.roundStart(k) + 90) break;
            bytes32 hash = keccak256(abi.encode(address(c), k, _M(j), bid, _salt(_M(j))));
            vm.prank(_M(j));
            try c.commitBid(hash) {
                who[count] = _M(j);
                bids[count] = bid;
                count++;
            } catch {}
        }
        _warpForward(c.roundStart(k) + 90);
        for (uint256 i = 0; i < count; i++) {
            if (_h(seed, k, i, 3) % 5 == 0) continue; // some never reveal
            vm.prank(who[i]);
            try c.revealBid(bids[i], _salt(who[i])) {} catch {}
        }
    }

    function _fuzzWallets(uint256 seed, uint32 k) internal {
        for (uint256 j = 1; j <= 5; j++) {
            uint256 r = _h(seed, k, j, 4) % 12;
            if (r < 2) _block(_M(j));
            else _unblock(_M(j));
            usdc.setBlacklisted(_M(j), r == 11);
        }
    }

    /// @dev Ghost counters of the fuzz pokes: [payLate, markDefault, repayDebt] successes.
    uint256[3] internal ghostOk;

    /// @dev Random payLate / markDefault / repayDebt pokes; each may legitimately revert. Most wallets are made able
    /// to pay again first, so that late payments and repayments actually happen.
    function _fuzzPokes(uint256 seed, uint32 k) internal {
        for (uint256 j = 1; j <= 5; j++) {
            address m = _M(j);
            uint256 a = _h(seed, k, j, 5) % 7;
            _warpForward(_now() + _h(seed, k, j, 6) % 60);
            if (_h(seed, k, j, 9) % 4 != 0) {
                _unblock(m);
                usdc.setBlacklisted(m, false);
            }
            if (a == 0 || a == 1) {
                uint32 r = uint32(1 + _h(seed, k, j, 7) % k); // fallback: a random round
                for (uint32 q = 1; q <= k; q++) {
                    Shortfall memory sf = c.shortfallOf(q, m);
                    if (!sf.resolved && sf.amount != 0) {
                        r = q;
                        break;
                    }
                }
                vm.prank(m);
                try c.payLate(r) {
                    ghostOk[0]++;
                } catch {}
            } else if (a == 2) {
                try c.markDefault(m) {
                    ghostOk[1]++;
                } catch {}
            } else if (a == 3 || a == 5) {
                uint256 debt = c.memberInfo(m).debt;
                if (debt != 0) {
                    vm.prank(m);
                    try c.repayDebt(1 + _h(seed, k, j, 8) % debt) {
                        ghostOk[2]++;
                    } catch {}
                }
            } else if (a == 4) {
                _warpForward(_now() + 130); // let grace periods run out
            }
            _assertLedger();
        }
    }

    function testFuzz_FullCircle_RandomFailuresAndPokes_LedgerHoldsAtEveryStep_FinalizeLeavesOnlyClaimable(uint256 seed)
        public
    {
        for (uint32 k = 1; k <= 5; k++) {
            _fuzzWallets(seed, k);
            _fuzzBids(seed, k);
            _assertLedger();
            _warpForward(c.deadline(k));
            c.settleRound();
            _assertLedger();
            // INV-05-ish: the split never exceeds the pot
            RoundInfo memory ri = c.roundInfo(k);
            assertLe(uint256(ri.payout) + ri.fee + ri.premium + ri.holdback, ri.pot, "split <= pot");
            _fuzzPokes(seed, k);
        }
        assertEq(c.settledRounds(), 5);
        for (uint256 j = 1; j <= 5; j++) {
            assertTrue(c.memberInfo(_M(j)).received, "INV-02");
        }

        // After the last grace period every open shortfall is past grace, so finalize cannot revert.
        _warpForward(_graceEnd(5) + 1);
        uint256 supplyBefore = usdc.totalSupply();
        c.finalize();
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        _assertLedger();
        assertEq(c.bondRemaining() + c.reserve() + c.totalHoldback() + c.totalFeeEscrow() + c.revealBondsHeld(), 0);
        assertEq(usdc.balanceOf(address(c)), c.totalClaimable(), "the contract holds exactly what is claimable");
        assertEq(factory.activeCirclesOf(organizer), 0);
        for (uint256 j = 1; j <= 5; j++) {
            assertEq(c.memberInfo(_M(j)).holdback, 0, "no holdback survives finalize");
            usdc.setBlacklisted(_M(j), false);
        }
        usdc.setBlacklisted(organizer, false);

        // Everybody collects; the contract ends empty and nothing was created or lost.
        for (uint256 j = 1; j <= 5; j++) {
            if (c.claimable(_M(j)) != 0) {
                vm.prank(_M(j));
                c.claim();
            }
        }
        if (c.claimable(organizer) != 0) {
            vm.prank(organizer);
            c.claim();
        }
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(c.totalClaimable(), 0);
        assertEq(usdc.totalSupply(), supplyBefore);
        _assertConserved();
    }
}
