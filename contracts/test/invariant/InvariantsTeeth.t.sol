// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";

import {Handler} from "./Handler.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {CircleParams, CircleState} from "../../src/libraries/HuiTypes.sol";
import {HuiInvariants, HuiInvariantsFixed, HuiInvariantsFullCoverage, HuiInvariantsLens} from "./Invariants.t.sol";

/// @notice "Teeth" checks for the invariant suite: each test corrupts the system on purpose (or drives it into the
/// documented INV-08 sequential-defaults limit) and demands that the matching `invariant_*` function fails. An invariant that cannot fail
/// proves nothing, so this guards the suite itself against being weakened by accident.
/// @dev The inherited `invariant_*` functions still run as invariants here, but with the `warp` selector only, so
/// they cost almost nothing; the real campaigns are `HuiInvariants` and friends.
contract HuiInvariantsTeeth is HuiInvariants {
    using stdStorage for StdStorage;

    function _selectors() internal pure override returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = Handler.warp.selector;
    }

    function _label() internal pure override returns (string memory) {
        return "HuiInvariantsTeeth";
    }

    /// @dev Settles `n` rounds with nobody bidding (winner = smallest live joinIndex, bid 0).
    function _play(uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            handler.advanceRound(1);
        }
        assertEq(circle.settledRounds(), n, "setup: rounds settled");
    }

    function _write(string memory sig, uint256 v) internal {
        stdstore.target(address(handler)).sig(sig).checked_write(v);
    }

    function test_Teeth_Healthy_AllInvariantsHoldAfterTwoRounds() public {
        _play(2);
        this.invariant_INV01_ledger();
        this.invariant_INV02_oneWinEach();
        this.invariant_INV03_bidCap();
        this.invariant_INV04_noOverPull();
        this.invariant_INV05_potSplit();
        this.invariant_INV06_holdback();
        this.invariant_INV07_noAdminPayout();
        this.invariant_INV09_schedule();
        this.invariant_LIVENESS_settleNeverStuck();
        this.invariant_LIVENESS_finalizeNeverStuck();
    }

    function test_Teeth_INV01_FailsWhenTheReserveIsInflated() public {
        _play(1);
        circle.exposed_setReserve(circle.reserve() + 1);
        vm.expectRevert();
        this.invariant_INV01_ledger();
    }

    function test_Teeth_INV01_FailsWhenUsdcIsStuckInTheCircle() public {
        _play(1);
        usdc.mint(address(circle), 1);
        vm.expectRevert();
        this.invariant_INV01_ledger();
    }

    function test_Teeth_INV02_FailsWhenAMemberIsMarkedReceivedWithoutARound() public {
        _play(1);
        circle.exposed_setReceived(actors[4], 5);
        vm.expectRevert();
        this.invariant_INV02_oneWinEach();
    }

    function test_Teeth_INV03_FailsWhenABidAboveTheCapWasRevealed() public {
        _play(1);
        _write("ghostBidCapBreach()", 1);
        vm.expectRevert();
        this.invariant_INV03_bidCap();
    }

    function test_Teeth_INV04_FailsOnAnOverPull() public {
        _play(1);
        _write("ghostOverPull()", 1);
        vm.expectRevert();
        this.invariant_INV04_noOverPull();
    }

    /// @dev End to end: a payout misrecorded in the round info breaks `pot == payout + fee + premium + H + repaid`.
    function test_Teeth_INV05_FailsWhenThePayoutIsMisrecorded() public {
        _play(2);
        this.invariant_INV05_potSplit();
        circle.exposed_setRoundPayout(1, circle.roundInfo(1).payout + 1);
        vm.expectRevert();
        this.invariant_INV05_potSplit();
    }

    /// @dev End to end through RecordingUSDC and the Handler audit (no ghost written by hand): the circle is made to
    /// pull 101 USDC per payer while the spec allows 100, and `invariant_INV04_noOverPull` must see it.
    function test_Teeth_INV04_FailsWhenTheCirclePullsMoreThanDue() public {
        _play(1);
        this.invariant_INV04_noOverPull();
        circle.exposed_setContribution(uint96(C + 1e6));
        handler.advanceRound(1); // round 2: every payer is pulled 101 USDC (M1: C instead of 100)
        assertEq(circle.settledRounds(), 2, "round 2 settled");
        assertGt(handler.ghostOverPull(), 0, "the Handler audit flagged the pull");
        vm.expectRevert();
        this.invariant_INV04_noOverPull();
    }

    /// @dev M-01: `settleRound` reverting on an Active circle past its deadline trips the liveness invariant, and the
    /// selector of the revert is kept.
    function test_Teeth_LIVENESS_FailsWhenSettleRoundReverts() public {
        _play(1);
        this.invariant_LIVENESS_settleNeverStuck();
        vm.mockCallRevert(address(circle), abi.encodeCall(circle.settleRound, ()), abi.encodeWithSignature("Boom()"));
        handler.advanceRound(1);
        assertEq(circle.settledRounds(), 1, "the settlement never happened");
        assertEq(handler.ghostStuckSettle(), 1);
        assertEq(handler.ghostStuckSettleRound(), 2);
        assertEq(handler.ghostStuckSettleSelector(), bytes4(keccak256("Boom()")));
        vm.expectRevert();
        this.invariant_LIVENESS_settleNeverStuck();
    }

    /// @dev M-01, `finalize`: a member with `debt` but no open shortfall (an accounting bug) makes `finalize` revert
    /// `GraceNotOver` for ever; the Handler sees a revert past `graceEnd(N)` and the invariant trips.
    function test_Teeth_LIVENESS_FailsWhenFinalizeIsStuck() public {
        _play(5);
        circle.exposed_setDebt(actors[0], 1);
        this.invariant_LIVENESS_finalizeNeverStuck();
        handler.advanceRound(1); // warps past the grace period of round 5 and calls finalize
        assertEq(uint8(circle.state()), uint8(CircleState.Active), "finalize never ran");
        assertEq(handler.ghostStuckFinalize(), 1);
        assertEq(handler.ghostStuckFinalizeSelector(), IHuiCircle.GraceNotOver.selector);
        vm.expectRevert();
        this.invariant_LIVENESS_finalizeNeverStuck();
    }

    /// @dev Legitimate reverts are not liveness failures: too early, Paused, and `finalize` inside the grace period.
    function test_Teeth_LIVENESS_LegitimateRevertsDoNotCount() public {
        handler.settle(); // before deadline(1): TooEarly
        assertEq(handler.ghostStuckSettle(), 0);
        vm.warp(circle.deadline(1));
        vm.prank(admin);
        factory.pauseCircle(address(circle));
        handler.settle(); // due, but Paused: CircleIsPaused
        assertEq(handler.ghostStuckSettle(), 0, "paused is not stuck");
        vm.prank(admin);
        factory.unpauseCircle(address(circle));
        _play(5);
        handler.finalize(); // inside the grace period of round 5: GraceNotOver
        assertEq(uint8(circle.state()), uint8(CircleState.Active));
        assertEq(handler.ghostStuckFinalize(), 0, "inside the grace period is not stuck");
        this.invariant_LIVENESS_settleNeverStuck();
        this.invariant_LIVENESS_finalizeNeverStuck();
        handler.advanceRound(1);
        assertEq(uint8(circle.state()), uint8(CircleState.Completed));
        this.invariant_LIVENESS_finalizeNeverStuck();
    }

    function test_Teeth_INV06_FailsWhenHoldbackIsAboveTheBound() public {
        _play(2); // M1 won round 1 (H = 80) and paid round 2 on time: 60 = alpha * (5 - 2) * C is left
        assertEq(circle.memberInfo(actors[0]).holdback, 60e6);
        circle.exposed_setHoldback(actors[0], 60e6 + 6);
        vm.expectRevert();
        this.invariant_INV06_holdback();
    }

    function test_Teeth_INV06_FailsWhenHoldbackIsBelowTheExactValue() public {
        _play(2);
        circle.exposed_setHoldback(actors[0], 50e6);
        vm.expectRevert();
        this.invariant_INV06_holdback();
    }

    function test_Teeth_INV07_FailsWhenTheAdminReceivedUsdc() public {
        _play(1);
        _write("ghostAdminReceived()", 1);
        vm.expectRevert();
        this.invariant_INV07_noAdminPayout();
    }

    function test_Teeth_INV07_FailsWhenAnUnauthorizedCallSucceeded() public {
        _play(1);
        _write("ghostUnauthorizedSuccess()", 1);
        vm.expectRevert();
        this.invariant_INV07_noAdminPayout();
    }

    function test_Teeth_INV07_FailsWhenTheFactoryHoldsUsdc() public {
        _play(1);
        usdc.mint(address(factory), 1);
        vm.expectRevert();
        this.invariant_INV07_noAdminPayout();
    }

    function test_Teeth_INV09_FailsWhenARoundSettledEarly() public {
        _play(1);
        _write("ghostSettledBeforeDeadline()", 1);
        vm.expectRevert();
        this.invariant_INV09_schedule();
    }

    function test_Teeth_INV09_FailsWhenTheParametersChanged() public {
        _play(1);
        _write("ghostParamsHash()", uint256(keccak256("other")));
        vm.expectRevert();
        this.invariant_INV09_schedule();
    }
}

/// @notice Teeth of INV-08: the sequential-defaults case documented in docs/03 section 7.3 must trip it, which also shows it is
/// not vacuous. (`HuiInvariantsFullCoverage` itself only allows the bounded case that docs/03 section 7.3 proves.)
contract HuiInvariantsFullCoverageTeeth is HuiInvariantsFullCoverage {
    function _selectors() internal pure override returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = Handler.warp.selector;
    }

    function _label() internal pure override returns (string memory) {
        return "HuiInvariantsFullCoverageTeeth";
    }

    function _stop(uint256 i) internal {
        vm.prank(actors[i]);
        usdc.approve(address(circle), 0);
    }

    /// @dev M1..M4 each stop paying right after winning, one round apart: unpaid contributions reach N(N-1)/2 * C =
    /// 1000 USDC against 480 of bond, so round 5 leaves 304 USDC uncovered (pinned in HuiCircleLate.t.sol).
    function test_Teeth_INV08_FailsOnSequentialDefaults_Documented() public {
        handler.advanceRound(1); // round 1: M1 wins
        this.invariant_INV08_fullCoverage();
        _stop(0);
        handler.advanceRound(1); // round 2: M2 wins, M1 fails
        _stop(1);
        handler.advanceRound(1);
        _stop(2);
        handler.advanceRound(1);
        _stop(3);
        handler.advanceRound(1); // round 5: M5 wins and is short-changed
        assertEq(circle.roundInfo(5).uncovered, 304e6, "documented: round 5 uncovered 304 USDC");
        vm.expectRevert();
        this.invariant_INV08_fullCoverage();
        // Every other invariant still holds in that scenario: the money is accounted for, only INV-08 is at stake.
        this.invariant_INV01_ledger();
        this.invariant_INV02_oneWinEach();
        this.invariant_INV04_noOverPull();
        this.invariant_INV05_potSplit();
        this.invariant_INV06_holdback();
        this.invariant_INV07_noAdminPayout();
        this.invariant_INV09_schedule();
    }

    /// @dev Proves the INV-07 pipeline end to end (RecordingUSDC -> Handler audit -> invariant): the winner of round 5
    /// is rewritten to the attacker address, then a late payment makes the circle send the `uncovered` part there.
    function test_Teeth_INV07_FailsWhenUsdcLeavesToAStranger() public {
        handler.advanceRound(1);
        _stop(0);
        handler.advanceRound(1);
        _stop(1);
        handler.advanceRound(1);
        _stop(2);
        handler.advanceRound(1);
        _stop(3);
        handler.advanceRound(1);
        circle.exposed_setRoundWinner(5, handler.attacker());
        this.invariant_INV07_noAdminPayout();
        handler.payLate(1, 0); // M2 tops up and repays inside the grace period
        assertGt(usdc.balanceOf(handler.attacker()), 0, "the stranger was paid");
        vm.expectRevert();
        this.invariant_INV07_noAdminPayout();
    }

    /// @dev The bounded case: the same four receivers stop together after round 4 (or any subset after any round).
    function test_Teeth_INV08_HoldsWhenReceiversStopTogether() public {
        handler.advanceRound(1);
        handler.advanceRound(1);
        handler.advanceRound(1);
        handler.advanceRound(1);
        handler.stopReceivers(type(uint256).max); // a non-empty subset of the four receivers, all at once
        handler.advanceRound(1);
        assertEq(circle.settledRounds(), 5);
        this.invariant_INV08_fullCoverage();
    }
}

/// @dev A lens that answers every call with 32 zero bytes: stands for a lens whose views disagree with the circle.
contract ZeroLens {
    fallback() external {
        assembly ("memory-safe") {
            mstore(0, 0)
            return(0, 32)
        }
    }
}

/// @notice Teeth of the lens invariants (task A6): a lens that lies must trip `invariant_LENS_viewParity` and
/// `invariant_VIEWS_matchSpec`; the real lens passes both after real rounds.
/// forge-config: default.invariant.runs = 16
/// forge-config: default.invariant.depth = 16
/// forge-config: ci.invariant.runs = 16
/// forge-config: ci.invariant.depth = 16
contract HuiInvariantsLensTeeth is HuiInvariantsLens {
    function _requireCompletion() internal pure override returns (bool) {
        return false; // warp-only selectors never finish a circle
    }

    function _selectors() internal pure override returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = Handler.warp.selector;
    }

    function _label() internal pure override returns (string memory) {
        return "HuiInvariantsLensTeeth";
    }

    function test_Teeth_LENS_HealthyAfterTwoRounds() public {
        handler.advanceRound(1);
        handler.advanceRound(1);
        assertEq(circle.settledRounds(), 2);
        this.invariant_LENS_viewParity();
        this.invariant_VIEWS_matchSpec();
        this.invariant_INV01_ledger();
        this.invariant_INV05_potSplit();
    }

    function test_Teeth_LENS_FailsWhenTheLensLies() public {
        handler.advanceRound(1);
        this.invariant_LENS_viewParity();
        vm.etch(lens, address(new ZeroLens()).code);
        vm.expectRevert();
        this.invariant_LENS_viewParity();
    }

    function test_Teeth_VIEWS_FailsWhenTheLensLies() public {
        handler.advanceRound(1);
        this.invariant_VIEWS_matchSpec();
        vm.etch(lens, address(new ZeroLens()).code);
        vm.expectRevert();
        this.invariant_VIEWS_matchSpec();
    }

    /// @dev The parity check swaps the implementation code for a second and restores it: nothing may stay behind.
    function test_Teeth_LENS_ParityLeavesTheImplementationUntouched() public {
        bytes32 before = keccak256(address(realImpl).code);
        this.invariant_LENS_viewParity();
        assertEq(keccak256(address(realImpl).code), before);
    }
}

/// @notice Teeth and scenarios of the `Fixed` invariants (task A6). The harness is the implementation here
/// (`_realClone` off) so that bookkeeping can be corrupted with the `exposed_*` helpers.
/// forge-config: default.invariant.runs = 16
/// forge-config: default.invariant.depth = 16
/// forge-config: ci.invariant.runs = 16
/// forge-config: ci.invariant.depth = 16
contract HuiInvariantsFixedTeeth is HuiInvariantsFixed {
    using stdStorage for StdStorage;

    function _requireCompletion() internal pure override returns (bool) {
        return false; // warp-only selectors never finish a circle
    }

    function _realClone() internal pure override returns (bool) {
        return false;
    }

    function _selectors() internal pure override returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = Handler.warp.selector;
    }

    function _label() internal pure override returns (string memory) {
        return "HuiInvariantsFixedTeeth";
    }

    function _all() internal view {
        this.invariant_INV01_ledger();
        this.invariant_INV02_oneWinEach();
        this.invariant_INV03_bidCap();
        this.invariant_INV04_noOverPull();
        this.invariant_INV05_potSplit();
        this.invariant_INV06_holdback();
        this.invariant_INV07_noAdminPayout();
        this.invariant_INV09_schedule();
        this.invariant_FIXED_orderFollowsJoinIndex();
        this.invariant_VIEWS_matchSpec();
        this.invariant_LIVENESS_settleNeverStuck();
        this.invariant_LIVENESS_finalizeNeverStuck();
    }

    /// @dev The circle is Fixed, has no bidding window, and `commitBid` can never work.
    function test_Fixed_NoBiddingWindowAndCommitReverts() public {
        assertEq(uint8(circle.params().mode), 0, "Fixed");
        assertEq(circle.params().commitWindow, 0);
        assertEq(circle.params().revealWindow, 0);
        handler.commit(1, 0, bytes32(uint256(1)));
        assertEq(handler.ghostCommits(), 0, "no commit worked");
        assertEq(handler.ghostWindowBreach(), 0);
        vm.prank(actors[1]);
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        circle.commitBid(bytes32(uint256(1)));
    }

    /// @dev Nobody frozen: round k goes to the member with joinIndex k - 1, the circle completes, all invariants hold.
    function test_Fixed_PlainOrder_FullCircleReachesFinalize() public {
        for (uint32 k = 1; k <= 5; k++) {
            handler.advanceRound(1);
            assertEq(circle.roundInfo(k).winner, actors[k - 1], "winner follows joinIndex");
            assertEq(circle.roundInfo(k).winningBid, 0);
            assertEq(handler.ghostFixedExpected(k), actors[k - 1]);
            assertFalse(handler.ghostFixedFrozenAtSettle(k));
            _all();
        }
        handler.advanceRound(1); // past the grace period of round 5: finalize
        assertEq(uint8(circle.state()), uint8(CircleState.Completed), "finalized");
        assertEq(handler.ghostFixedChecked(), 5);
        _all();
    }

    /// @dev docs/03 section 6.4: M2 stops paying in round 1, is marked after the grace period and becomes Frozen. The
    /// queue is then M1 (round 1), M3, M4, M5 and M2 last, with its pot going to the debt first.
    function test_Fixed_FrozenMemberIsPushedToTheBack() public {
        vm.prank(actors[1]);
        usdc.approve(address(circle), 0);
        handler.advanceRound(1); // round 1: M1 wins, M2 fails (covered by the bond)
        assertEq(circle.roundInfo(1).winner, actors[0]);
        assertGt(circle.memberInfo(actors[1]).debt, 0, "M2 has a shortfall");
        vm.warp(circle.roundInfo(1).settledAt + 121);
        circle.markDefault(actors[1]);
        assertTrue(circle.memberInfo(actors[1]).defaulted && !circle.memberInfo(actors[1]).received, "M2 frozen");
        address[4] memory expected = [actors[2], actors[3], actors[4], actors[1]];
        for (uint32 k = 2; k <= 5; k++) {
            handler.advanceRound(1);
            assertEq(circle.roundInfo(k).winner, expected[k - 2], "frozen member goes last");
            assertEq(handler.ghostFixedExpected(k), expected[k - 2], "ghost agrees");
            assertTrue(handler.ghostFixedFrozenAtSettle(k));
            _all();
        }
        assertEq(handler.ghostFixedFrozenRounds(), 4);
        assertEq(handler.ghostFixedOrderBreak(), 0);
        assertEq(handler.ghostFixedStrictBreak(), 0);
        handler.advanceRound(1);
        assertEq(uint8(circle.state()), uint8(CircleState.Completed));
        _all();
    }

    function test_Teeth_FIXED_FailsWhenARoundGoesToTheWrongMember() public {
        handler.advanceRound(1);
        handler.advanceRound(1);
        handler.advanceRound(1);
        this.invariant_FIXED_orderFollowsJoinIndex();
        circle.exposed_setRoundWinner(2, actors[3]); // round 2 "won" by M4 instead of M2
        vm.expectRevert();
        this.invariant_FIXED_orderFollowsJoinIndex();
    }

    function test_Teeth_FIXED_FailsWhenTheHandlerSawAnOrderBreak() public {
        handler.advanceRound(1);
        stdstore.target(address(handler)).sig("ghostFixedOrderBreak()").checked_write(uint256(1));
        vm.expectRevert();
        this.invariant_FIXED_orderFollowsJoinIndex();
    }

    function test_Teeth_FIXED_FailsWhenTheStrictOrderBroke() public {
        handler.advanceRound(1);
        stdstore.target(address(handler)).sig("ghostFixedStrictBreak()").checked_write(uint256(1));
        vm.expectRevert();
        this.invariant_FIXED_orderFollowsJoinIndex();
    }

    function test_Teeth_FIXED_FailsWhenASettlementWasNotChecked() public {
        handler.advanceRound(1);
        stdstore.target(address(handler)).sig("ghostFixedChecked()").checked_write(uint256(0));
        vm.expectRevert();
        this.invariant_FIXED_orderFollowsJoinIndex();
    }
}

/// @notice A13 teeth: INV-11 (commission inside the room), INV-12 (reserve split) and INV-13 (fee timing) must fail
/// when the matching ghost record or the circle is corrupted, on a circle with phi = 50%.
contract HuiInvariantsCommissionTeeth is HuiInvariants {
    using stdStorage for StdStorage;

    function _circleParams() internal view override returns (CircleParams memory p) {
        p = _params();
        p.commissionShareBps = 5000;
        p.feeBps = 300;
    }

    function _selectors() internal pure override returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = Handler.warp.selector;
    }

    function _label() internal pure override returns (string memory) {
        return "HuiInvariantsCommissionTeeth";
    }

    function _play(uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            handler.advanceRound(1);
        }
        assertEq(circle.settledRounds(), n, "setup: rounds settled");
    }

    function _writeK(string memory sig, uint32 k, uint256 v) internal {
        stdstore.target(address(handler)).sig(sig).with_key(k).checked_write(v);
    }

    function _finalize() internal {
        _play(5);
        vm.warp(vm.getBlockTimestamp() + 1 days);
        handler.finalize();
        assertTrue(handler.ghostFinalized(), "setup: finalized");
    }

    function test_Teeth_Commission_Healthy() public {
        _finalize();
        assertGt(circle.roundInfo(1).fee, 0, "setup: a fee was charged");
        this.invariant_INV01_ledger();
        this.invariant_INV05_potSplit();
        this.invariant_INV11_commissionInRoom();
        this.invariant_INV12_reserveSplit();
        this.invariant_INV13_feeTiming();
        assertGt(handler.ghostReserveSharedCount(), 0, "setup: reserve was shared by weight");
    }

    function test_Teeth_INV11_FailsWhenTheRoomIsTooSmall() public {
        _play(1);
        this.invariant_INV11_commissionInRoom();
        _writeK("ghostRoomAtSettle(uint32)", 1, 1);
        vm.expectRevert();
        this.invariant_INV11_commissionInRoom();
    }

    function test_Teeth_INV11_FailsWhenAFeeIsRecordedAboveTheCeiling() public {
        _play(1);
        circle.exposed_setRoundFee(1, uint128(circle.roundInfo(1).pot));
        vm.expectRevert();
        this.invariant_INV11_commissionInRoom();
    }

    function test_Teeth_INV13_FailsWhenTheFeeWasNotPaidAtOnce() public {
        _play(1);
        this.invariant_INV13_feeTiming();
        _writeK("ghostFeePaidAtSettle(uint32)", 1, 0);
        vm.expectRevert();
        this.invariant_INV13_feeTiming();
    }

    function test_Teeth_INV13_FailsWhenARoundWithoutShortfallKeepsEscrow() public {
        _play(1);
        circle.exposed_setFeeEscrow(1, 1);
        vm.expectRevert();
        this.invariant_INV13_feeTiming();
    }

    function test_Teeth_INV12_FailsWhenTheSharesDoNotAddUp() public {
        _finalize();
        stdstore.target(address(handler))
            .sig("ghostReserveSharedSum()")
            .checked_write(handler.ghostReserveSharedSum() + 1);
        vm.expectRevert();
        this.invariant_INV12_reserveSplit();
    }

    function test_Teeth_INV12_FailsWhenAMemberOfLowerWeightGetsMore() public {
        _finalize();
        // pretend M2 was late twice: its weight drops, yet its recorded share stays the largest
        circle.exposed_setLateCount(actors[1], 2);
        vm.expectRevert();
        this.invariant_INV12_reserveSplit();
    }
}
