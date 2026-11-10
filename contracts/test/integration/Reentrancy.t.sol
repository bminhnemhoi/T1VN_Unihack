// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {FalseReturningUSDC} from "../utils/FalseReturningUSDC.sol";
import {ReentrantUSDC} from "../utils/ReentrantUSDC.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {CircleState, MemberAttestation, PermitSig, Shortfall} from "../../src/libraries/HuiTypes.sol";

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
        assertEq(c.totalFeeEscrow(), 0, "a round without shortfalls pays its fee at once");
        assertEq(usdc.balanceOf(organizer), 4 * U, "the organizer holds exactly the fee of round 1");
        assertEq(c.bondRemaining(), 480 * U);
        assertEq(c.totalClaimable(), 0);
        assertEq(usdc.balanceOf(_M(1)), before[0] + 312 * U);
        for (uint256 i = 2; i <= 5; i++) {
            assertEq(usdc.balanceOf(_M(i)), before[i - 1] - 100 * U, "pulled once, not twice");
        }
        assertEq(usdc.balanceOf(address(c)), 480 * U + 80 * U + 4 * U);
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

    /// @dev A13 (audit I-01): the organizer receives the fee of a round without shortfalls inside `settleRound` and
    /// tries every guarded entry point from the token hook; the round and the fee are paid exactly once.
    function test_Reentrancy_DuringImmediateFeePayout_IsBlocked() public {
        bytes[] memory ps = _guardedPayloads();
        uint256[5] memory before = _balances();
        for (uint256 i = 0; i < ps.length; i++) {
            uint256 snap = vm.snapshotState();
            rusdc.arm(ReentrantUSDC.Side.Recipient, organizer, organizer, address(c), ps[i]);
            _toDeadline();
            c.settleRound();
            _assertBlocked();
            _assertRoundOneUnchanged(before); // includes: the organizer holds exactly the fee of round 1, once
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

    /// @dev The organizer receives the bond, a member receives its reserve share: each tries to re-enter
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
                // bond 480 to the organizer, once (the fees of rounds without a shortfall were paid at settlement)
                assertEq(usdc.balanceOf(organizer) - orgBefore, 480 * U);
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

    // ================================================================== re-entry that must change nothing (audit L-06)

    /// @dev Everything an outer call can change: balances of the members, the organizer and the circle, the ledger
    /// parts, the member books and the state. A re-entry that "worked" would leave a different digest.
    function _digest() internal view returns (bytes32 d) {
        d = keccak256(
            abi.encode(
                usdc.balanceOf(organizer),
                usdc.balanceOf(address(c)),
                c.bondRemaining(),
                c.reserve(),
                c.totalHoldback(),
                c.totalFeeEscrow(),
                c.revealBondsHeld(),
                c.totalClaimable(),
                uint8(c.state()),
                c.settledRounds()
            )
        );
        for (uint256 i = 1; i <= 5; i++) {
            d = keccak256(
                abi.encode(
                    d, usdc.balanceOf(_M(i)), c.memberInfo(_M(i)).holdback, c.memberInfo(_M(i)).debt, c.claimable(_M(i))
                )
            );
        }
    }

    /// @dev Runs `action` once without any hook (the reference), then once per guarded entry point with the hook
    /// armed on the `skip + 1`-th movement of `who` on `side`; each armed run must be blocked by the guard and end in
    /// exactly the reference state.
    function _reentryChangesNothing(ReentrantUSDC.Side side, address who, uint256 skip, function() internal action)
        internal
    {
        bytes[] memory ps = _guardedPayloads();
        uint256 snap = vm.snapshotState();
        action();
        bytes32 ref = _digest();
        vm.revertToState(snap);
        for (uint256 i = 0; i < ps.length; i++) {
            snap = vm.snapshotState();
            rusdc.armNth(side, who, who, address(c), ps[i], skip);
            action();
            _assertBlocked();
            assertEq(_digest(), ref, "the re-entry left no trace");
            _assertLedger();
            _assertConserved();
            vm.revertToState(snap);
        }
    }

    // ---- repayDebt: principal pull and late fee pull

    /// @dev docs/03 section 8 branch B up to the default: M4 failed round 2 (100: 80 from its holdback, 20 from the
    /// bond), its grace period is over, `markDefault` was called and M4 has money and allowance again.
    function _m4Defaulted() internal {
        _m4FailsRound2();
        vm.warp(_graceEnd(2) + 1);
        c.markDefault(_M(4));
        _unblock(_M(4));
    }

    function _repay100() internal {
        uint256 before = usdc.balanceOf(_M(4));
        vm.prank(_M(4));
        c.repayDebt(100 * U);
        assertEq(c.memberInfo(_M(4)).debt, 0, "debt repaid once");
        uint256 paid = before - usdc.balanceOf(_M(4));
        assertGt(paid, 100 * U - 1, "principal pulled");
        assertLt(paid, 101 * U, "principal plus a small late fee, not twice");
    }

    function test_Reentrancy_DuringRepayDebtPrincipalPull_IsBlocked() public {
        _m4Defaulted();
        _reentryChangesNothing(ReentrantUSDC.Side.Source, _M(4), 0, _repay100);
    }

    function test_Reentrancy_DuringRepayDebtFeePull_IsBlocked() public {
        _m4Defaulted(); // 121 s after the shortfall: a late fee > 0 at the demo time scale (P / D = 14400)
        _reentryChangesNothing(ReentrantUSDC.Side.Source, _M(4), 1, _repay100);
    }

    // ---- payLate: late fee pull and the uncovered payout to the round winner

    address internal _payer;
    uint32 internal _payerRound;
    uint256 internal _payerUncovered;

    /// @dev Docs/03 section 7.3 documented limit (sequential defaults beyond the peak shock): M1..M4 each stop paying right after winning; in round 5 M5 is short-changed.
    /// Picks the first defaulter whose round-5 shortfall has an `uncovered` part (owed to M5) and tops it up.
    function _uncoveredScenario() internal {
        _settleRounds(1, 1);
        _block(_M(1));
        _settleRounds(2, 2);
        _block(_M(2));
        _settleRounds(3, 3);
        _block(_M(3));
        _settleRounds(4, 4);
        _block(_M(4));
        _settleRounds(5, 5);
        assertEq(c.roundInfo(5).winner, _M(5));
        assertGt(c.roundInfo(5).uncovered, 0, "setup: round 5 has an uncovered claim");
        for (uint256 i = 1; i <= 4; i++) {
            Shortfall memory sf = c.shortfallOf(5, _M(i));
            if (sf.uncovered != 0) {
                _payer = _M(i);
                _payerRound = 5;
                _payerUncovered = sf.uncovered;
                break;
            }
        }
        assertTrue(_payer != address(0), "setup: a payer with an uncovered part");
        _fund(_payer, 1000 * U);
        _unblock(_payer);
        vm.warp(_now() + 30); // inside the grace period, long enough for a late fee > 0
    }

    function _payLateUncovered() internal {
        uint256 winnerBefore = usdc.balanceOf(_M(5)) + c.claimable(_M(5));
        vm.prank(_payer);
        c.payLate(_payerRound);
        assertEq(c.shortfallOf(_payerRound, _payer).uncovered, 0, "uncovered part restored once");
        assertEq(
            usdc.balanceOf(_M(5)) + c.claimable(_M(5)) - winnerBefore, _payerUncovered, "M5 was paid its claim once"
        );
    }

    function test_Reentrancy_DuringPayLateFeePull_IsBlocked() public {
        _uncoveredScenario();
        _reentryChangesNothing(ReentrantUSDC.Side.Source, _payer, 1, _payLateUncovered);
    }

    function test_Reentrancy_DuringPayLatePrincipalPull_WithUncoveredPart_IsBlocked() public {
        _uncoveredScenario();
        _reentryChangesNothing(ReentrantUSDC.Side.Source, _payer, 0, _payLateUncovered);
    }

    /// @dev The round winner receives the `uncovered` claim straight from `payLate` (a `transfer` in the middle of
    /// the restore) and calls back as the winner.
    function test_Reentrancy_DuringPayLateUncoveredPayout_IsBlocked() public {
        _uncoveredScenario();
        _reentryChangesNothing(ReentrantUSDC.Side.Recipient, _M(5), 0, _payLateUncovered);
    }

    // ---- commitBid: reveal bond pull

    function _commitM2() internal {
        _commit(_M(2), 4 * U);
        assertEq(c.revealBondsHeld(), 1 * U, "one reveal bond held, pulled once");
        assertEq(c.commitOf(1, _M(2)).bondHeld, 1 * U);
    }

    function test_Reentrancy_DuringCommitBidRevealBondPull_IsBlocked() public {
        _reentryChangesNothing(ReentrantUSDC.Side.Source, _M(2), 0, _commitM2);
    }

    // ---- depositBond pull and withdrawBond payout (organizer is the one called back)

    function _forming() internal {
        _otherCircles.push(address(c));
        c = _create(_params());
    }

    function _deposit100() internal {
        PermitSig memory none;
        _fund(organizer, 100 * U);
        vm.prank(organizer);
        usdc.approve(address(c), 100 * U);
        vm.prank(organizer);
        c.depositBond(100 * U, none);
        assertEq(c.bondRemaining(), 100 * U, "bond counted once");
        assertEq(c.bondDeposited(), 100 * U);
    }

    function test_Reentrancy_DuringDepositBondPull_IsBlocked() public {
        _forming();
        _reentryChangesNothing(ReentrantUSDC.Side.Source, organizer, 0, _deposit100);
    }

    function _withdrawBond() internal {
        uint256 before = usdc.balanceOf(organizer);
        vm.prank(organizer);
        c.withdrawBond();
        assertEq(usdc.balanceOf(organizer) - before, 480 * U, "the bond paid once");
        assertEq(c.bondRemaining(), 0);
    }

    function test_Reentrancy_DuringWithdrawBondPayout_IsBlocked() public {
        _forming();
        _deposit100();
        PermitSig memory none;
        _fund(organizer, 380 * U);
        vm.prank(organizer);
        usdc.approve(address(c), 380 * U);
        vm.prank(organizer);
        c.depositBond(380 * U, none);
        vm.warp(uint256(c.params().joinDeadline) + 1);
        c.cancel();
        assertEq(uint8(c.state()), uint8(CircleState.Cancelled));
        _reentryChangesNothing(ReentrantUSDC.Side.Recipient, organizer, 0, _withdrawBond);
    }

    // ================================================================== functions without the guard

    /// @dev The two functions without `nonReentrant` never move tokens, so a hook cannot use them: `leave` and
    /// `cancel` revert on the state check when called from inside a pull. (A token that returns `false` instead of
    /// reverting is covered by `FalseReturningTokenTest` below.)
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

/// @notice A token that returns `false` (without reverting) on a flagged sender or recipient, as ERC-20s that signal
/// failure by return value do. The circle must treat a `false` pull as a shortfall and a `false` payout as a deferred
/// payment, never lose or double-count a unit (INV-01), and revert (leaving no trace) where `SafeERC20` is used.
contract FalseReturningTokenTest is CircleScenario {
    FalseReturningUSDC internal ftoken;

    function setUp() public override {
        super.setUp();
        ftoken = new FalseReturningUSDC();
        usdc = ftoken;
        cfg.usdc = address(ftoken);
        factory = new HuiFactory(admin, address(impl), cfg);
        _otherCircles.push(address(c));
        c = _active(_params(), 480 * U);
        t0 = _now();
    }

    /// @dev The pull of M2 returns false: round 1 treats it as a shortfall of 100 covered from the bond (M2 has not
    /// received, so there is no holdback), M1 still gets its full payout and nothing is double counted.
    function test_FalseReturn_PullReturningFalse_IsAShortfall() public {
        ftoken.setReturnsFalseFrom(_M(2), true);
        uint256 m2Before = usdc.balanceOf(_M(2));
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ContributionShortfall(1, _M(2), 100 * U);
        _settle();
        assertEq(usdc.balanceOf(_M(2)), m2Before, "nothing moved");
        assertEq(c.memberInfo(_M(2)).debt, 100 * U);
        assertEq(c.shortfallOf(1, _M(2)).fromBond, 100 * U);
        assertEq(c.bondRemaining(), 380 * U, "bond advanced the missing 100");
        assertEq(c.roundInfo(1).pot, 400 * U, "pot complete thanks to the bond");
        assertEq(c.roundInfo(1).uncovered, 0);
        assertEq(c.roundInfo(1).payout, 312 * U);
        _assertLedger();
        _assertConserved();
    }

    /// @dev The payout of M1 returns false: it becomes `claimable` (PaymentDeferred), the ledger holds it, a claim
    /// that still returns false reverts and keeps the claim, and the claim pays exactly once when the token behaves.
    function test_FalseReturn_PayoutReturningFalse_GoesToClaimable() public {
        ftoken.setReturnsFalseTo(_M(1), true);
        uint256 m1Before = usdc.balanceOf(_M(1));
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(_M(1), 312 * U);
        _settle();
        assertEq(usdc.balanceOf(_M(1)), m1Before, "nothing was sent");
        assertEq(c.claimable(_M(1)), 312 * U);
        assertEq(c.totalClaimable(), 312 * U);
        _assertLedger();
        _assertConserved();

        vm.prank(_M(1));
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(ftoken)));
        c.claim();
        assertEq(c.claimable(_M(1)), 312 * U, "a failed claim keeps the claim");
        _assertLedger();

        ftoken.setReturnsFalseTo(_M(1), false);
        vm.prank(_M(1));
        c.claim();
        assertEq(usdc.balanceOf(_M(1)) - m1Before, 312 * U, "paid once");
        assertEq(c.claimable(_M(1)), 0);
        _assertLedger();
        _assertConserved();
        vm.prank(_M(1));
        vm.expectRevert(IHuiCircle.NothingToClaim.selector);
        c.claim();
    }

    /// @dev `payLate` uses `safeTransferFrom`: a false return reverts the whole call, the shortfall stays open and
    /// the ledger is untouched.
    function test_FalseReturn_PayLateReturningFalse_RevertsWithoutTrace() public {
        _m4FailsRound2();
        ftoken.setReturnsFalseFrom(_M(4), true);
        _unblock(_M(4));
        uint256 reserveBefore = c.reserve();
        Shortfall memory before = c.shortfallOf(2, _M(4));
        vm.warp(uint256(c.roundInfo(2).settledAt) + 6);
        vm.prank(_M(4));
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(ftoken)));
        c.payLate(2);
        Shortfall memory after_ = c.shortfallOf(2, _M(4));
        assertFalse(after_.resolved);
        assertEq(after_.fromBond, before.fromBond);
        assertEq(after_.fromHoldback, before.fromHoldback);
        assertEq(c.reserve(), reserveBefore);
        assertEq(c.memberInfo(_M(4)).debt, 100 * U);
        _assertLedger();
        _assertConserved();
    }
}
