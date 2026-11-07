// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";

import {Handler} from "./Handler.sol";
import {HuiInvariants, HuiInvariantsFullCoverage} from "./Invariants.t.sol";

/// @notice "Teeth" checks for the invariant suite: each test corrupts the system on purpose (or drives it into the
/// known INV-08 spec gap) and demands that the matching `invariant_*` function fails. An invariant that cannot fail
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

/// @notice Teeth of INV-08: the sequential-defaults case of the known spec gap must trip it, which also shows it is
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
    function test_Teeth_INV08_FailsOnSequentialDefaults_KnownSpecGap() public {
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
        assertEq(circle.roundInfo(5).uncovered, 304e6, "the gap of the spec");
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
