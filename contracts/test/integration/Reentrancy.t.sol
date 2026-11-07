// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {ReentrantUSDC} from "../utils/ReentrantUSDC.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {CircleState, MemberAttestation, PermitSig} from "../../src/libraries/HuiTypes.sol";

/// @notice Malicious-token reentrancy (docs/09 threat model, CLAUDE.md "nonReentrant at every function that moves
/// money out"). The circle runs on a `ReentrantUSDC` whose `transfer` / `transferFrom` call back into the circle,
/// as a member, from the middle of every token movement of the money paths: the contribution pull in `settleRound`,
/// the payout and holdback release, `claim`, the `payLate` pull, `finalize` payouts and `emergencyUnwind` payouts.
/// Each re-entry must revert with `ReentrancyGuardReentrantCall` (the guard is the first modifier, so it answers
/// before any state check), the outer call must complete with the unchanged numbers, and INV-01 must hold.
contract ReentrancyTest is CircleScenario {
    ReentrantUSDC internal rusdc;
    address internal stranger = makeAddr("stranger");

    function setUp() public override {
        super.setUp(); // a MockUSDC circle, kept only in the conservation accounting
        rusdc = new ReentrantUSDC();
        usdc = rusdc;
        cfg.usdc = address(rusdc);
        factory = new HuiFactory(admin, address(impl), cfg);
        _newCircle(_params(), 480 * U);
    }

    // ------------------------------------------------------------------ re-entry payloads

    /// @dev Every state-changing entry point that carries `nonReentrant` in `HuiCircle`.
    function _guardedPayloads() internal view returns (bytes[] memory ps) {
        PermitSig memory noPermit;
        MemberAttestation memory att;
        ps = new bytes[](12);
        ps[0] = abi.encodeCall(IHuiCircle.settleRound, ());
        ps[1] = abi.encodeCall(IHuiCircle.payLate, (1));
        ps[2] = abi.encodeCall(IHuiCircle.markDefault, (_M(4)));
        ps[3] = abi.encodeCall(IHuiCircle.repayDebt, (1));
        ps[4] = abi.encodeCall(IHuiCircle.finalize, ());
        ps[5] = abi.encodeCall(IHuiCircle.claim, ());
        ps[6] = abi.encodeCall(IHuiCircle.commitBid, (bytes32(uint256(1))));
        ps[7] = abi.encodeCall(IHuiCircle.revealBid, (0, bytes32(0)));
        ps[8] = abi.encodeCall(IHuiCircle.depositBond, (1, noPermit));
        ps[9] = abi.encodeCall(IHuiCircle.withdrawBond, ());
        ps[10] = abi.encodeCall(IHuiCircle.activate, ());
        ps[11] = abi.encodeCall(IHuiCircle.join, (att, bytes(""), noPermit));
    }

    function _assertBlocked() internal view {
        assertEq(rusdc.hookCalls(), 1, "the hook fired exactly once");
        assertFalse(rusdc.lastOk(), "the re-entry reverted");
        assertEq(
            rusdc.lastRevertSelector(),
            ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
            "reverted by the guard, not by a later check"
        );
    }

    /// @dev Round 1 without bids: M1 wins; pot 400, fee 4, premium 4, H = 20% x 4 x 100 = 80, payout 312; each of
    /// M2..M5 was pulled exactly 100.
    function _assertRoundOneUnchanged(uint256[5] memory before) internal view {
        assertEq(c.settledRounds(), 1);
        assertEq(c.roundInfo(1).winner, _M(1));
        assertEq(c.roundInfo(1).pot, 400 * U);
        assertEq(c.roundInfo(1).fee, 4 * U);
        assertEq(c.roundInfo(1).premium, 4 * U);
        assertEq(c.roundInfo(1).holdback, 80 * U);
        assertEq(c.roundInfo(1).payout, 312 * U);
        assertEq(c.roundInfo(1).uncovered, 0);
        assertEq(c.memberInfo(_M(1)).holdback, 80 * U);
        assertEq(c.totalHoldback(), 80 * U);
        assertEq(c.reserve(), 4 * U);
        assertEq(c.totalFeeEscrow(), 4 * U);
        assertEq(c.bondRemaining(), 480 * U);
        assertEq(c.totalClaimable(), 0);
        assertEq(usdc.balanceOf(_M(1)), before[0] + 312 * U);
        for (uint256 i = 2; i <= 5; i++) {
            assertEq(usdc.balanceOf(_M(i)), before[i - 1] - 100 * U, "pulled once, not twice");
        }
        assertEq(usdc.balanceOf(address(c)), 480 * U + 80 * U + 4 * U + 4 * U);
        _assertLedger();
        _assertConserved();
    }

    function _balances() internal view returns (uint256[5] memory b) {
        for (uint256 i = 1; i <= 5; i++) {
            b[i - 1] = usdc.balanceOf(_M(i));
        }
    }

    // ================================================================== settleRound

    /// @dev M2 is mid-`transferFrom` (pulled into the circle) and calls every guarded entry point.
    function test_Reentrancy_DuringContributionPull_EveryGuardedEntryPointIsBlocked() public {
        bytes[] memory ps = _guardedPayloads();
        uint256[5] memory before = _balances();
        for (uint256 i = 0; i < ps.length; i++) {
            uint256 snap = vm.snapshotState();
            rusdc.arm(ReentrantUSDC.Side.Source, _M(2), _M(2), address(c), ps[i]);
            _toDeadline();
            c.settleRound();
            _assertBlocked();
            _assertRoundOneUnchanged(before);
            vm.revertToState(snap);
        }
    }

    /// @dev M1 receives the payout (`usdc.transfer`) and tries to settle again, claim, or touch the bond.
    function test_Reentrancy_DuringPayout_EveryGuardedEntryPointIsBlocked() public {
        bytes[] memory ps = _guardedPayloads();
        uint256[5] memory before = _balances();
        for (uint256 i = 0; i < ps.length; i++) {
            uint256 snap = vm.snapshotState();
            rusdc.arm(ReentrantUSDC.Side.Recipient, _M(1), _M(1), address(c), ps[i]);
            _toDeadline();
            c.settleRound();
            _assertBlocked();
            _assertRoundOneUnchanged(before);
            vm.revertToState(snap);
        }
    }

    /// @dev A bidder is refunded its reveal bond mid-`revealBid` (`transfer`) and re-enters the same function to
    /// reveal a second time or to commit again.
    function test_Reentrancy_DuringRevealBondRefund_IsBlocked() public {
        _commit(_M(2), 4 * U);
        _toReveal();
        bytes[] memory ps = new bytes[](2);
        ps[0] = abi.encodeCall(IHuiCircle.revealBid, (4 * U, _salt(_M(2))));
        ps[1] = abi.encodeCall(IHuiCircle.commitBid, (bytes32(uint256(2))));
        for (uint256 i = 0; i < ps.length; i++) {
            uint256 snap = vm.snapshotState();
            rusdc.arm(ReentrantUSDC.Side.Recipient, _M(2), _M(2), address(c), ps[i]);
            _reveal(_M(2), 4 * U);
            _assertBlocked();
            assertEq(c.revealBondsHeld(), 0, "the bond was refunded once");
            assertTrue(c.commitOf(1, _M(2)).revealed);
            _assertLedger();
            vm.revertToState(snap);
        }
    }

    // ================================================================== claim

    /// @dev The winner is blocked, so the payout becomes `claimable`; once unblocked, `claim()` re-enters itself
    /// and every other entry point while the transfer is in flight. The claim pays exactly once.
    function test_Reentrancy_DuringClaim_PaysOnce_AndEveryEntryPointIsBlocked() public {
        usdc.setBlacklisted(_M(1), true);
        _toDeadline();
        c.settleRound();
        assertEq(c.claimable(_M(1)), 312 * U, "payout deferred to claimable");
        assertEq(c.totalClaimable(), 312 * U);
        _assertLedger();
        usdc.setBlacklisted(_M(1), false);

        bytes[] memory ps = _guardedPayloads();
        uint256 balBefore = usdc.balanceOf(_M(1));
        for (uint256 i = 0; i < ps.length; i++) {
            uint256 snap = vm.snapshotState();
            rusdc.arm(ReentrantUSDC.Side.Recipient, _M(1), _M(1), address(c), ps[i]);
            vm.prank(_M(1));
            c.claim();
            _assertBlocked();
            assertEq(usdc.balanceOf(_M(1)) - balBefore, 312 * U, "paid once");
            assertEq(c.claimable(_M(1)), 0);
            assertEq(c.totalClaimable(), 0);
            _assertLedger();
            vm.prank(_M(1));
            vm.expectRevert(IHuiCircle.NothingToClaim.selector);
            c.claim();
            vm.revertToState(snap);
        }
    }

    // ================================================================== payLate

    /// @dev M4 is mid-`transferFrom` of its late payment (docs/03 section 8 round 2, nominal day 1) and tries to pay
    /// again or to restore twice. `payLate` pulls before it updates the shortfall, so the guard is what protects it.
    function test_Reentrancy_DuringPayLatePull_EveryGuardedEntryPointIsBlocked() public {
        _m4FailsRound2();
        _unblock(_M(4));
        vm.warp(uint256(c.roundInfo(2).settledAt) + 6);
        bytes[] memory ps = _guardedPayloads();
        ps[1] = abi.encodeCall(IHuiCircle.payLate, (2)); // the real round, so only the guard can stop it
        ps[3] = abi.encodeCall(IHuiCircle.repayDebt, (100 * U));
        uint256 m4Before = usdc.balanceOf(_M(4));
        for (uint256 i = 0; i < ps.length; i++) {
            uint256 snap = vm.snapshotState();
            rusdc.arm(ReentrantUSDC.Side.Source, _M(4), _M(4), address(c), ps[i]);
            vm.prank(_M(4));
            c.payLate(2);
            _assertBlocked();
            // docs/03 section 8 branch A: paid 100 + 27_396 fee once, bond back to 480, holdback 80 restored then 20 released.
            assertEq(m4Before - usdc.balanceOf(_M(4)), 100 * U + 27_396 - 20 * U);
            assertEq(c.bondRemaining(), 480 * U);
            assertEq(c.memberInfo(_M(4)).holdback, 60 * U);
            assertEq(c.memberInfo(_M(4)).debt, 0);
            assertTrue(c.shortfallOf(2, _M(4)).resolved);
            assertEq(c.reserve(), 7_670_000 + 27_396);
            _assertLedger();
            _assertConserved();
            vm.revertToState(snap);
        }
    }

    // ================================================================== finalize

    function _toFinalizable() internal {
        _settleRounds(1, 5);
        vm.warp(_graceEnd(5) + 1);
    }

    /// @dev The organizer receives bond + fees, a member receives its reserve share: each tries to re-enter
    /// `finalize` (double payout), `claim`, `withdrawBond` and the rest. The circle empties exactly once.
    function test_Reentrancy_DuringFinalizePayouts_EveryGuardedEntryPointIsBlocked() public {
        _toFinalizable();
        bytes[] memory ps = _guardedPayloads();
        address[2] memory who = [organizer, _M(1)];
        for (uint256 w = 0; w < 2; w++) {
            for (uint256 i = 0; i < ps.length; i++) {
                uint256 snap = vm.snapshotState();
                uint256 orgBefore = usdc.balanceOf(organizer);
                rusdc.arm(ReentrantUSDC.Side.Recipient, who[w], who[w], address(c), ps[i]);
                vm.prank(stranger);
                c.finalize();
                _assertBlocked();
                assertEq(uint8(c.state()), uint8(CircleState.Completed));
                // bond 480 + fees 5 x 4 = 500 to the organizer, once
                assertEq(usdc.balanceOf(organizer) - orgBefore, 500 * U);
                assertEq(usdc.balanceOf(address(c)), 0, "nothing left to drain");
                assertEq(c.totalClaimable(), 0);
                _assertLedger();
                _assertConserved();
                vm.revertToState(snap);
            }
        }
    }

    // ================================================================== emergencyUnwind

    /// @dev The organizer receives the bond during `emergencyUnwind` and re-enters the circle.
    function test_Reentrancy_DuringEmergencyUnwindPayouts_IsBlocked() public {
        _settleRounds(1, 2);
        vm.prank(admin);
        factory.pauseCircle(address(c));
        vm.warp(_now() + 48 hours);
        bytes[] memory ps = _guardedPayloads();
        for (uint256 i = 0; i < ps.length; i++) {
            uint256 snap = vm.snapshotState();
            uint256 orgBefore = usdc.balanceOf(organizer);
            rusdc.arm(ReentrantUSDC.Side.Recipient, organizer, organizer, address(c), ps[i]);
            vm.prank(admin);
            factory.unwindCircle(address(c));
            _assertBlocked();
            assertEq(uint8(c.state()), uint8(CircleState.Unwound));
            assertEq(usdc.balanceOf(organizer) - orgBefore, 480 * U, "the bond only: fee escrows go to the reserve");
            assertEq(usdc.balanceOf(admin), 0, "never to the admin");
            _assertLedger();
            _assertConserved();
            vm.revertToState(snap);
        }
    }

    // ================================================================== a token that returns false or reverts

    /// @dev The two functions without `nonReentrant` never move tokens, so a hook cannot use them: `leave` and
    /// `cancel` revert on the state check when called from inside a pull.
    function test_Reentrancy_UnguardedFunctionsCannotMoveMoney() public {
        bytes[] memory ps = new bytes[](2);
        ps[0] = abi.encodeCall(IHuiCircle.leave, ());
        ps[1] = abi.encodeCall(IHuiCircle.cancel, ());
        uint256[5] memory before = _balances();
        for (uint256 i = 0; i < ps.length; i++) {
            uint256 snap = vm.snapshotState();
            rusdc.arm(ReentrantUSDC.Side.Source, _M(2), _M(2), address(c), ps[i]);
            _toDeadline();
            c.settleRound();
            assertEq(rusdc.hookCalls(), 1);
            assertFalse(rusdc.lastOk(), "state check stops it");
            assertTrue(
                rusdc.lastRevertSelector() != ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
                "not guarded, rejected by the state machine"
            );
            _assertRoundOneUnchanged(before);
            vm.revertToState(snap);
        }
    }
}
