// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CircleScenario} from "../utils/CircleScenario.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {IHuiFactory} from "../../src/interfaces/IHuiFactory.sol";
import {CircleParams, CircleState, MemberAttestation, MemberInfo, PermitSig} from "../../src/libraries/HuiTypes.sol";

/// @notice C7 pause, unpause and emergency unwind (docs/03 sections 5.4 and 4, CLAUDE.md hard rule 7). The admin acts
/// only through the factory; the circle only trusts the factory. Circle of docs/03 section 8; actors[0..4] are M1..M5.
contract HuiCircleEmergencyTest is CircleScenario {
    address internal stranger = makeAddr("stranger");

    // ------------------------------------------------------------------ helpers

    function _pauseNow() internal {
        vm.prank(admin);
        factory.pauseCircle(address(c));
    }

    function _unpauseNow() internal {
        vm.prank(admin);
        factory.unpauseCircle(address(c));
    }

    function _unwindNow() internal {
        vm.prank(admin);
        factory.unwindCircle(address(c));
    }

    /// @dev Pause now, wait exactly 48 hours, unwind.
    function _pauseWaitUnwind() internal {
        _pauseNow();
        vm.warp(_now() + 48 hours);
        _unwindNow();
    }

    function _balances() internal view returns (uint256[5] memory b) {
        for (uint256 i = 1; i <= 5; i++) {
            b[i - 1] = usdc.balanceOf(_M(i));
        }
    }

    function _assertEmptyBooks() internal view {
        assertEq(c.bondRemaining(), 0, "bond");
        assertEq(c.reserve(), 0, "reserve");
        assertEq(c.totalHoldback(), 0, "holdback");
        assertEq(c.totalFeeEscrow(), 0, "fee escrow");
        assertEq(c.revealBondsHeld(), 0, "reveal bonds");
        assertEq(usdc.balanceOf(address(c)), c.totalClaimable(), "only claimable is left");
    }

    // ================================================================== access control

    function test_AccessControl_CircleFunctionsOnlyCallableByTheFactory() public {
        address[5] memory callers = [admin, organizer, stranger, _M(1), address(forwarder)];
        for (uint256 i = 0; i < callers.length; i++) {
            vm.startPrank(callers[i]);
            vm.expectRevert(IHuiCircle.NotFactory.selector);
            c.pause();
            vm.expectRevert(IHuiCircle.NotFactory.selector);
            c.unpause();
            vm.expectRevert(IHuiCircle.NotFactory.selector);
            c.emergencyUnwind();
            vm.stopPrank();
        }
        assertEq(uint8(c.state()), uint8(CircleState.Active));
    }

    function test_AccessControl_NotFactoryEvenWhenPausedAndOld() public {
        _pauseNow();
        vm.warp(_now() + 10 days);
        vm.prank(admin); // the admin wallet cannot unwind directly, only through the factory
        vm.expectRevert(IHuiCircle.NotFactory.selector);
        c.emergencyUnwind();
        vm.prank(organizer);
        vm.expectRevert(IHuiCircle.NotFactory.selector);
        c.unpause();
    }

    function test_AccessControl_FactoryEntryPointsAreAdminOnly() public {
        vm.startPrank(organizer);
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        factory.pauseCircle(address(c));
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        factory.unpauseCircle(address(c));
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        factory.unwindCircle(address(c));
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        factory.pauseCircle(address(c));
        assertEq(uint8(c.state()), uint8(CircleState.Active));
    }

    // ================================================================== pause and unpause

    function test_Pause_EmitsAndStoresTheStart() public {
        vm.warp(t0 + 50);
        vm.expectEmit(address(c));
        emit IHuiCircle.CirclePaused(uint64(t0 + 50));
        vm.expectEmit(address(factory));
        emit IHuiFactory.CirclePausedByAdmin(address(c));
        _pauseNow();
        assertEq(uint8(c.state()), uint8(CircleState.Paused));
        assertEq(c.pausedAt(), t0 + 50);
        assertEq(c.pausedTotal(), 0, "only finished pauses count");
    }

    function test_Unpause_AddsTheLengthToPausedTotal() public {
        vm.warp(t0 + 50);
        _pauseNow();
        vm.warp(t0 + 350);
        vm.expectEmit(address(c));
        emit IHuiCircle.CircleUnpaused(uint64(t0 + 350), 300);
        vm.expectEmit(address(factory));
        emit IHuiFactory.CircleUnpausedByAdmin(address(c));
        _unpauseNow();
        assertEq(uint8(c.state()), uint8(CircleState.Active));
        assertEq(c.pausedTotal(), 300);
        assertEq(c.pausedAt(), 0);
    }

    function test_Pause_TwoPausesAccumulateAndShiftTheSchedule() public {
        vm.warp(t0 + 10);
        _pauseNow();
        vm.warp(t0 + 110);
        _unpauseNow(); // 100
        vm.warp(t0 + 200);
        _pauseNow();
        vm.warp(t0 + 450);
        vm.expectEmit(address(c));
        emit IHuiCircle.CircleUnpaused(uint64(t0 + 450), 350);
        _unpauseNow(); // 250
        assertEq(c.pausedTotal(), 350);
        assertEq(c.roundStart(1), t0 + 350);
        assertEq(c.deadline(1), t0 + 350 + 180);
        assertEq(c.roundStart(3), t0 + 360 + 350);
        vm.warp(t0 + 529);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.TooEarly.selector, uint64(t0 + 530)));
        c.settleRound();
        vm.warp(t0 + 530);
        c.settleRound();
        assertEq(c.settledRounds(), 1);
    }

    function test_Pause_ZeroLengthPauseChangesNothing() public {
        _pauseNow();
        _unpauseNow();
        assertEq(c.pausedTotal(), 0);
        assertEq(c.deadline(1), t0 + 180);
    }

    function test_Pause_StateErrors() public {
        // Forming
        HuiCircleHarness forming = _create(_params());
        vm.prank(address(factory));
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Forming));
        forming.pause();
        vm.prank(address(factory));
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Forming));
        forming.unpause();
        vm.prank(address(factory));
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Forming));
        forming.emergencyUnwind();

        // Active: cannot unpause or unwind
        vm.prank(address(factory));
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Active));
        c.unpause();
        vm.prank(address(factory));
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Active));
        c.emergencyUnwind();

        // Paused: cannot pause again
        _pauseNow();
        vm.prank(address(factory));
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.pause();
        _unpauseNow();

        // Cancelled
        CircleParams memory p = _params();
        HuiCircleHarness cancelled = _create(p);
        vm.warp(_now() + JOIN_WINDOW + 1);
        cancelled.cancel();
        vm.prank(address(factory));
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Cancelled)
        );
        cancelled.pause();
    }

    function test_Pause_CompletedCircleCannotBePausedOrUnwound() public {
        _settleRounds(1, 5);
        vm.warp(_graceEnd(5));
        c.finalize();
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Completed)
        );
        factory.pauseCircle(address(c));
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Completed)
        );
        factory.unwindCircle(address(c));
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Completed)
        );
        factory.unpauseCircle(address(c));
    }

    function test_Pause_OnlyClaimWorksWhilePaused() public {
        // Give M1 something to claim: its round-1 payout fails (blocked), then the circle is paused.
        usdc.setBlacklisted(_M(1), true);
        _settle();
        uint256 owed = c.claimable(_M(1));
        assertGt(owed, 0);
        usdc.setBlacklisted(_M(1), false);
        _pauseNow();

        bytes memory paused = abi.encodeWithSelector(IHuiCircle.CircleIsPaused.selector);
        MemberAttestation memory att;
        PermitSig memory permit;

        vm.prank(organizer);
        vm.expectRevert(paused);
        c.depositBond(1, permit);
        vm.prank(organizer);
        vm.expectRevert(paused);
        c.withdrawBond();
        vm.prank(_M(1));
        vm.expectRevert(paused);
        c.join(att, "", permit);
        vm.prank(_M(1));
        vm.expectRevert(paused);
        c.leave();
        vm.prank(organizer);
        vm.expectRevert(paused);
        c.activate();
        vm.expectRevert(paused);
        c.cancel();
        vm.prank(_M(2));
        vm.expectRevert(paused);
        c.commitBid(bytes32(uint256(1)));
        vm.prank(_M(2));
        vm.expectRevert(paused);
        c.revealBid(1, bytes32(0));
        vm.expectRevert(paused);
        c.settleRound();
        vm.prank(_M(2));
        vm.expectRevert(paused);
        c.payLate(1);
        vm.expectRevert(paused);
        c.markDefault(_M(2));
        vm.prank(_M(2));
        vm.expectRevert(paused);
        c.repayDebt(1);
        vm.expectRevert(paused);
        c.finalize();

        // Views keep working, and claim() pays out.
        assertEq(c.roundInfo(1).winner, _M(1));
        assertEq(c.members().length, 5);
        uint256 before = usdc.balanceOf(_M(1));
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.Claimed(_M(1), owed);
        vm.prank(_M(1));
        c.claim();
        assertEq(usdc.balanceOf(_M(1)) - before, owed);
        _assertLedger();
    }

    function test_Pause_MidRound_KeepsCommitsAndShiftsTheWindows() public {
        vm.warp(t0 + 10);
        _commit(_M(2), 3 * U);
        vm.warp(t0 + 20);
        _pauseNow();
        vm.warp(t0 + 1020);
        _unpauseNow(); // 1000 s
        assertEq(c.roundStart(1), t0 + 1000);
        // Round 1 re-opens at t0 + 1000; the reveal window is [t0 + 1090, t0 + 1150).
        vm.prank(_M(2));
        vm.expectRevert(IHuiCircle.NotInRevealWindow.selector);
        c.revealBid(3 * U, _salt(_M(2)));
        vm.warp(t0 + 1090);
        _reveal(_M(2), 3 * U);
        vm.warp(t0 + 1180);
        c.settleRound();
        assertEq(c.roundInfo(1).winner, _M(2));
        assertEq(c.roundInfo(1).winningBid, 3 * U);
        _assertLedger();
    }

    // ================================================================== 48 hours

    function test_Unwind_47h59m59sReverts_Exactly48hWorks() public {
        vm.warp(t0 + 100);
        _pauseNow();
        uint256 p = _now();
        vm.warp(p + 48 hours - 1);
        vm.prank(admin);
        vm.expectRevert(IHuiCircle.UnwindTooEarly.selector);
        factory.unwindCircle(address(c));
        assertEq(uint8(c.state()), uint8(CircleState.Paused));
        vm.warp(p + 48 hours);
        vm.expectEmit(address(c));
        emit IHuiCircle.CircleUnwound();
        _unwindNow();
        assertEq(uint8(c.state()), uint8(CircleState.Unwound));
    }

    function test_Unwind_ClockRestartsWithEachPause() public {
        vm.warp(t0 + 100);
        _pauseNow();
        vm.warp(_now() + 40 hours);
        _unpauseNow();
        vm.warp(_now() + 1);
        _pauseNow(); // a new, separate pause: 40 h of the old one do not count
        uint256 p = _now();
        vm.warp(p + 48 hours - 1);
        vm.prank(admin);
        vm.expectRevert(IHuiCircle.UnwindTooEarly.selector);
        factory.unwindCircle(address(c));
        vm.warp(p + 48 hours);
        _unwindNow();
        assertEq(uint8(c.state()), uint8(CircleState.Unwound));
    }

    function test_Unwind_ActiveCircleCannotBeUnwound() public {
        vm.warp(t0 + 10 days);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Active));
        factory.unwindCircle(address(c));
    }

    // ================================================================== exact payouts

    function test_Unwind_ExactPayouts_AfterRoundTwoWithAShortfall() public {
        _m4FailsRound2();
        assertEq(usdc.balanceOf(address(c)), 535_340_000, "bond 460 + holdback 60 + reserve 7.67 + fee escrow 7.67");
        uint256 orgBefore = usdc.balanceOf(organizer);
        uint256[5] memory before = _balances();
        assertEq(factory.activeCirclesOf(organizer), 1);

        _pauseNow();
        vm.warp(_now() + 48 hours);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.FeeForfeited(1, 3_760_000);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.FeeForfeited(2, 3_910_000);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.HoldbackReleased(_M(1), 2, 60 * U);
        vm.expectEmit(address(c));
        emit IHuiCircle.CircleUnwound();
        _unwindNow();

        assertEq(uint8(c.state()), uint8(CircleState.Unwound));
        assertEq(usdc.balanceOf(organizer) - orgBefore, 460 * U, "remaining bond back to the organizer");
        // reserve 7.67 + fee escrows 7.67 = 15.34 shared by the 5 non-defaulted members: 3.068 each, no dust
        for (uint256 i = 1; i <= 5; i++) {
            uint256 got = usdc.balanceOf(_M(i)) - before[i - 1];
            assertEq(got, i == 1 ? 60 * U + 3_068_000 : 3_068_000, "holdback to its owner + equal reserve share");
        }
        _assertEmptyBooks();
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(c.totalClaimable(), 0);
        assertEq(usdc.balanceOf(admin), 0, "nothing for the admin");
        assertEq(usdc.balanceOf(address(factory)), 0);
        assertEq(factory.activeCirclesOf(organizer), 0, "factory told");
        assertEq(c.memberInfo(_M(1)).holdback, 0);
        _assertConserved();
    }

    function test_Unwind_DefaultedMemberGetsNoReserveShare() public {
        _m4FailsRound2();
        vm.warp(_graceEnd(2) + 1);
        c.markDefault(_M(4)); // fee escrow of round 2 (3.91) already moved to the reserve
        uint256[5] memory before = _balances();
        _pauseWaitUnwind();
        // reserve 7.67 + 3.91 + fee escrow of round 1 (3.76) = 15.34 over M1, M2, M3, M5 = 3.835 each
        for (uint256 i = 1; i <= 5; i++) {
            uint256 got = usdc.balanceOf(_M(i)) - before[i - 1];
            if (i == 4) assertEq(got, 0, "DefaultedDead: no share");
            else assertEq(got, i == 1 ? 60 * U + 3_835_000 : 3_835_000);
        }
        _assertEmptyBooks();
        _assertConserved();
    }

    function test_Unwind_EveryMemberDefaulted_ReserveGoesToTheOrganizerNeverTheAdmin() public {
        _settle();
        for (uint256 i = 1; i <= 5; i++) {
            c.exposed_setDefaulted(_M(i), true);
        }
        uint256 orgBefore = usdc.balanceOf(organizer);
        _pauseWaitUnwind();
        // bond 480 + reserve (premium 4 + fee escrow 4)
        assertEq(usdc.balanceOf(organizer) - orgBefore, 480 * U + 8 * U);
        assertEq(usdc.balanceOf(admin), 0);
        _assertEmptyBooks();
        _assertConserved();
    }

    function test_Unwind_ReturnsOpenRevealBondsToTheirSenders() public {
        _settle(); // round 1: M1 wins with b = 0
        _commit(_M(2), 2 * U);
        _commit(_M(3), 1 * U);
        _commit(_M(5), 1 * U);
        _toReveal();
        _reveal(_M(5), 1 * U); // bond of M5 already refunded
        assertEq(c.revealBondsHeld(), 2 * U);
        uint256 orgBefore = usdc.balanceOf(organizer);
        uint256[5] memory before = _balances();

        _pauseNow();
        vm.warp(_now() + 48 hours);
        _unwindNow();

        // bond 480 to the organizer; M1 holdback 80; reserve = premium 4 + fee escrow 4 = 8 -> 1.6 each
        assertEq(usdc.balanceOf(organizer) - orgBefore, 480 * U);
        uint256 share = 1_600_000;
        assertEq(usdc.balanceOf(_M(1)) - before[0], 80 * U + share);
        assertEq(usdc.balanceOf(_M(2)) - before[1], 1 * U + share, "open reveal bond back");
        assertEq(usdc.balanceOf(_M(3)) - before[2], 1 * U + share, "open reveal bond back");
        assertEq(usdc.balanceOf(_M(4)) - before[3], share);
        assertEq(usdc.balanceOf(_M(5)) - before[4], share, "no second refund for the revealed bond");
        assertEq(c.commitOf(2, _M(2)).bondHeld, 0);
        assertEq(c.revealBondsHeld(), 0);
        _assertEmptyBooks();
        assertEq(usdc.balanceOf(address(c)), 0);
        _assertConserved();
    }

    function test_Unwind_AfterAllRoundsSettledBeforeFinalize() public {
        _settleRounds(1, 5);
        uint256 orgBefore = usdc.balanceOf(organizer);
        _pauseWaitUnwind();
        // bond 480; reserve = 5 premiums + 5 fee escrows = 40 -> 8 each
        assertEq(usdc.balanceOf(organizer) - orgBefore, 480 * U);
        assertEq(uint8(c.state()), uint8(CircleState.Unwound));
        _assertEmptyBooks();
        assertEq(usdc.balanceOf(address(c)), 0);
        _assertConserved();
    }

    function test_Unwind_BlockedRecipientsGoToClaimable_ClaimWorksAfterwards() public {
        _m4FailsRound2();
        usdc.setBlacklisted(organizer, true);
        usdc.setBlacklisted(_M(1), true);
        _pauseNow();
        vm.warp(_now() + 48 hours);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(organizer, 460 * U);
        _unwindNow();

        assertEq(uint8(c.state()), uint8(CircleState.Unwound), "one blocked address cannot block the unwind");
        assertEq(c.claimable(organizer), 460 * U);
        assertEq(c.claimable(_M(1)), 60 * U + 3_068_000);
        assertEq(usdc.balanceOf(address(c)), c.totalClaimable());
        _assertLedger();

        usdc.setBlacklisted(organizer, false);
        usdc.setBlacklisted(_M(1), false);
        vm.prank(organizer);
        c.claim();
        vm.prank(_M(1));
        c.claim();
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(c.totalClaimable(), 0);
        _assertConserved();
    }

    // ================================================================== Unwound is terminal

    function test_Unwound_IsTerminal() public {
        _pauseWaitUnwind();
        bytes memory wrong =
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Unwound);
        vm.expectRevert(wrong);
        c.settleRound();
        vm.expectRevert(wrong);
        c.finalize();
        vm.expectRevert(wrong);
        c.markDefault(_M(1));
        vm.prank(_M(1));
        vm.expectRevert(wrong);
        c.commitBid(bytes32(uint256(1)));
        vm.prank(_M(1));
        vm.expectRevert(wrong);
        c.payLate(1);
        vm.prank(_M(1));
        vm.expectRevert(wrong);
        c.repayDebt(1);
        // The factory cannot revive or unwind it again.
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Unwound));
        factory.pauseCircle(address(c));
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Unwound));
        factory.unpauseCircle(address(c));
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Paused, CircleState.Unwound));
        factory.unwindCircle(address(c));
        // claim() has nothing, but is not state-gated
        vm.prank(_M(1));
        vm.expectRevert(IHuiCircle.NothingToClaim.selector);
        c.claim();
        assertEq(uint8(c.state()), uint8(CircleState.Unwound));
    }

    // ================================================================== fuzz

    function _h(uint256 seed, uint256 a, uint256 b) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, a, b)));
    }

    /// @dev Random circle (0..4 rounds settled, random pull failures, open commits, random pause cycles, random
    /// blocked recipients) is paused, waited out and unwound: the ledger holds before and after, the contract keeps
    /// exactly what is claimable, nothing is created or lost, and nothing reaches the admin or the factory.
    function testFuzz_Unwind_RandomCircle_LedgerHoldsAndNothingReachesTheAdmin(uint256 seed) public {
        uint32 rounds = uint32(_h(seed, 0, 0) % 5);
        for (uint32 k = 1; k <= rounds; k++) {
            for (uint256 j = 1; j <= 5; j++) {
                if (_h(seed, k, j) % 5 == 0) _block(_M(j));
                else _unblock(_M(j));
            }
            _settle();
            _assertLedger();
        }
        for (uint256 j = 1; j <= 5; j++) {
            _unblock(_M(j));
        }
        // some open commits in the current round (the round after the settled ones)
        uint32 k2 = c.currentRound();
        if (rounds < 5 && c.liveCount() > 1) {
            if (_now() < c.roundStart(k2)) vm.warp(c.roundStart(k2));
            for (uint256 j = 1; j <= 5; j++) {
                MemberInfo memory mi = c.memberInfo(_M(j));
                if (mi.received || mi.defaulted || mi.debt != 0 || _h(seed, 77, j) % 2 == 0) continue;
                bytes32 hash = keccak256(abi.encode(address(c), k2, _M(j), uint256(1 * U), _salt(_M(j))));
                vm.prank(_M(j));
                try c.commitBid(hash) {} catch {}
            }
        }
        _assertLedger();

        // a few earlier pauses of random length
        uint256 cycles = _h(seed, 1, 0) % 3;
        for (uint256 i = 0; i < cycles; i++) {
            _pauseNow();
            vm.warp(_now() + 1 + _h(seed, 2, i) % 30 hours);
            _unpauseNow();
            _assertLedger();
        }

        // random blocked recipients at unwind time
        for (uint256 j = 1; j <= 5; j++) {
            usdc.setBlacklisted(_M(j), _h(seed, 3, j) % 6 == 0);
        }
        usdc.setBlacklisted(organizer, _h(seed, 4, 0) % 6 == 0);

        _pauseNow();
        vm.warp(_now() + 48 hours + _h(seed, 5, 0) % 1 days);
        uint256 supply = usdc.totalSupply();
        _unwindNow();

        assertEq(uint8(c.state()), uint8(CircleState.Unwound));
        _assertLedger();
        _assertEmptyBooks();
        assertEq(usdc.totalSupply(), supply);
        assertEq(usdc.balanceOf(admin), 0);
        assertEq(usdc.balanceOf(address(factory)), 0);
        for (uint256 j = 1; j <= 5; j++) {
            assertEq(c.memberInfo(_M(j)).holdback, 0);
            usdc.setBlacklisted(_M(j), false);
        }
        usdc.setBlacklisted(organizer, false);
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
        _assertConserved();
    }
}
