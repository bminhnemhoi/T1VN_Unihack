// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/console2.sol";

import {CircleFixture} from "../utils/CircleFixture.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {
    CircleMode,
    CircleParams,
    CircleState,
    CoverSource,
    MemberInfo,
    RoundInfo,
    RoundPhase,
    Shortfall
} from "../../src/libraries/HuiTypes.sol";

/// @notice C6: `settleRound` (docs/03 sections 6.5-6.8) through the real contract. Circle of docs/03 section 8:
/// N = 5, C = 100 USDC, alpha 20%, bond 480, fee 1%, reserve 1%, reveal bond 1; actors[0..4] are M1..M5.
/// Round k commit window [start, start+90), reveal [start+90, start+150), deadline start+180.
contract HuiCircleSettleTest is CircleFixture {
    HuiCircleHarness internal c;
    uint256 internal t0;
    uint256 internal constant U = 1e6;

    function setUp() public override {
        super.setUp();
        c = _workedExample();
        t0 = block.timestamp;
    }

    // ------------------------------------------------------------------ helpers

    function _salt(address m) internal pure returns (bytes32) {
        return keccak256(abi.encode("salt", m));
    }

    function _commit(address m, uint256 bid) internal {
        bytes32 h = keccak256(abi.encode(address(c), c.currentRound(), m, bid, _salt(m)));
        vm.prank(m);
        c.commitBid(h);
    }

    function _reveal(address m, uint256 bid) internal {
        vm.prank(m);
        c.revealBid(bid, _salt(m));
    }

    function _toReveal() internal {
        vm.warp(c.roundStart(c.currentRound()) + 90);
    }

    function _toDeadline() internal {
        vm.warp(c.deadline(c.currentRound()));
    }

    function _settle() internal {
        _toDeadline();
        c.settleRound();
    }

    /// @dev Revoke the allowance so the pull of `m` fails (as if the wallet were empty).
    function _block(address m) internal {
        vm.prank(m);
        usdc.approve(address(c), 0);
    }

    function _unblock(address m) internal {
        vm.prank(m);
        usdc.approve(address(c), type(uint256).max);
    }

    /// @dev docs/03 section 2.5 for the demo clock: amount owed for `elapsed` real seconds.
    function _lateFee(uint256 amount, uint256 elapsed) internal view returns (uint256) {
        return HuiMath.lateFee(amount, c.lateRateBps(), elapsed, 30 days, 180);
    }

    function _assertLedger(HuiCircleHarness x) internal view {
        assertEq(
            usdc.balanceOf(address(x)),
            x.bondRemaining() + x.reserve() + x.totalHoldback() + x.totalFeeEscrow() + x.revealBondsHeld()
                + x.totalClaimable(),
            "INV-01 ledger"
        );
    }

    function _assertLedger() internal view {
        _assertLedger(c);
    }

    function _newCircle(CircleParams memory p, uint256 bond) internal {
        c = _active(p, bond);
        t0 = block.timestamp;
    }

    /// @dev docs/03 section 8 round 1: M2 bids 4, M4 bids 6, M4 wins.
    function _round1() internal {
        _commit(actors[1], 4 * U);
        _commit(actors[3], 6 * U);
        _toReveal();
        _reveal(actors[1], 4 * U);
        _reveal(actors[3], 6 * U);
        _settle();
    }

    /// @dev docs/03 section 8 round 2: M1 and M2 both bid 3, M1 commits first and wins. Call after `_round1`.
    function _round2Bids() internal {
        _commit(actors[0], 3 * U);
        _commit(actors[1], 3 * U);
        _toReveal();
        _reveal(actors[0], 3 * U);
        _reveal(actors[1], 3 * U);
    }

    // ================================================================== reverts

    function test_Settle_RevertsBeforeDeadline() public {
        uint256 dl = c.deadline(1);
        vm.warp(dl - 1);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.TooEarly.selector, uint64(dl)));
        c.settleRound();
    }

    function test_Settle_RevertsWhenForming() public {
        CircleParams memory p = _params();
        HuiCircleHarness f = _create(p);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Forming));
        f.settleRound();
    }

    function test_Settle_RevertsWhenPaused() public {
        c.exposed_setState(CircleState.Paused);
        _toDeadline();
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.settleRound();
    }

    function test_Settle_RevertsWhenAllRoundsSettled() public {
        for (uint256 i = 0; i < 5; i++) {
            _settle();
        }
        assertEq(c.settledRounds(), 5);
        _toDeadline();
        vm.expectRevert(IHuiCircle.RoundAlreadySettled.selector);
        c.settleRound();
    }

    function test_Settle_CallableByAnyone() public {
        _toDeadline();
        vm.prank(makeAddr("stranger"));
        c.settleRound();
        assertEq(c.settledRounds(), 1);
    }

    // ================================================================== docs/03 section 8 through the real contract

    function test_WorkedExample_Round1() public {
        address m2 = actors[1];
        address m4 = actors[3];
        _commit(m2, 4 * U);
        _commit(m4, 6 * U);
        _toReveal();
        _reveal(m2, 4 * U);
        _reveal(m4, 6 * U);
        assertEq(usdc.balanceOf(m2), 10_000 * U, "reveal bond refunded");
        uint256 m4Before = usdc.balanceOf(m4);
        uint256 m1Before = usdc.balanceOf(actors[0]);
        _toDeadline();

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.RoundSettled(1, m4, 6 * U, 376 * U, 288_480_000, 80 * U, 3_760_000, 3_760_000, 0);
        c.settleRound();

        assertEq(usdc.balanceOf(m4) - m4Before, 288_480_000, "M4 receives 288.48");
        assertEq(m1Before - usdc.balanceOf(actors[0]), 94 * U, "live members pay C - b");
        RoundInfo memory ri = c.roundInfo(1);
        assertEq(ri.winner, m4);
        assertEq(ri.winningBid, 6 * U);
        assertEq(ri.pot, 376 * U);
        assertEq(ri.payout, 288_480_000);
        assertEq(ri.holdback, 80 * U);
        assertEq(ri.fee, 3_760_000);
        assertEq(ri.premium, 3_760_000);
        assertEq(ri.uncovered, 0);
        assertEq(ri.settledAt, block.timestamp);
        assertEq(ri.commitCount, 2);
        assertTrue(ri.settled);
        assertEq(c.reserve(), 3_760_000);
        assertEq(c.feeEscrow(1), 0, "round 1 had no shortfall: the fee went to the organizer at once");
        assertEq(usdc.balanceOf(organizer), 3_760_000);
        assertEq(c.totalHoldback(), 80 * U);
        assertEq(c.settledRounds(), 1);
        assertEq(c.liveCount(), 4);
        MemberInfo memory mi = c.memberInfo(m4);
        assertTrue(mi.received);
        assertEq(mi.receivedRound, 1);
        assertEq(mi.holdback, 80 * U);
        assertEq(c.bondRemaining(), 480 * U);
        _assertLedger();
    }

    function test_WorkedExample_Round2_BranchB_M4ShortfallCoveredByHoldbackThenBond() public {
        _round1();
        _round2Bids();
        _block(actors[3]); // M4 cannot pay
        uint256 m1Before = usdc.balanceOf(actors[0]);
        _toDeadline();

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ContributionShortfall(2, actors[3], 100 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallCovered(2, actors[3], CoverSource.Holdback, 80 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallCovered(2, actors[3], CoverSource.Bond, 20 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.RoundSettled(2, actors[0], 3 * U, 391 * U, 323_180_000, 60 * U, 3_910_000, 3_910_000, 0);
        c.settleRound();

        assertEq(usdc.balanceOf(actors[0]) - m1Before, 323_180_000, "M1 receives 323.18");
        Shortfall memory sf = c.shortfallOf(2, actors[3]);
        assertEq(sf.amount, 100 * U);
        assertEq(sf.fromHoldback, 80 * U);
        assertEq(sf.fromBond, 20 * U);
        assertEq(sf.fromReserve, 0);
        assertEq(sf.uncovered, 0);
        assertEq(sf.since, block.timestamp);
        assertFalse(sf.resolved);
        MemberInfo memory m4 = c.memberInfo(actors[3]);
        assertEq(m4.holdback, 0, "M4 holdback used up");
        assertEq(m4.debt, 100 * U, "debt");
        assertEq(m4.lateCount, 1);
        assertEq(rep.reputationOf(actors[3]).late, 1, "registry told");
        assertEq(c.bondRemaining(), 460 * U);
        assertEq(c.reserve(), 7_670_000, "3.76 + 3.91");
        assertEq(c.totalHoldback(), 60 * U, "only M1 held back");
        assertEq(c.memberInfo(actors[0]).holdback, 60 * U);
        _assertLedger();
    }

    function test_WorkedExample_Round2_BranchA_M4PaysOnTimeAndHoldbackIsReleased() public {
        _round1();
        _round2Bids();
        uint256 m4Before = usdc.balanceOf(actors[3]);
        _toDeadline();
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.HoldbackReleased(actors[3], 2, 20 * U);
        c.settleRound();
        // M4 paid 100 and got 20 of its holdback back.
        assertEq(m4Before - usdc.balanceOf(actors[3]), 80 * U);
        assertEq(c.memberInfo(actors[3]).holdback, 60 * U);
        assertEq(c.totalHoldback(), 120 * U, "= alpha * O(2) = 20% * 600");
        RoundInfo memory ri = c.roundInfo(2);
        assertEq(ri.pot, 391 * U);
        assertEq(ri.payout, 323_180_000);
        assertEq(c.bondRemaining(), 480 * U);
        assertEq(rep.reputationOf(actors[3]).onTime, 1);
        _assertLedger();
    }

    // ================================================================== cover cascade, one source at a time

    function test_Cascade_HoldbackAlone() public {
        CircleParams memory p = _params();
        p.alphaBps = 10_000;
        _newCircle(p, 0);
        _settle(); // M1 wins with b = 0: pot 400, fee 4, premium 4, H = min(400, 392) = 392, payout 0
        assertEq(c.memberInfo(actors[0]).holdback, 392 * U);
        _block(actors[0]);
        _settle();
        Shortfall memory sf = c.shortfallOf(2, actors[0]);
        assertEq(sf.fromHoldback, 100 * U);
        assertEq(sf.fromBond, 0);
        assertEq(sf.fromReserve, 0);
        assertEq(sf.uncovered, 0);
        assertEq(c.memberInfo(actors[0]).holdback, 292 * U);
        _assertLedger();
    }

    function test_Cascade_BondAlone_LiveMemberFails() public {
        _block(actors[4]);
        _settle();
        Shortfall memory sf = c.shortfallOf(1, actors[4]);
        assertEq(sf.amount, 100 * U);
        assertEq(sf.fromHoldback, 0, "live members have no holdback");
        assertEq(sf.fromBond, 100 * U);
        assertEq(c.bondRemaining(), 380 * U);
        RoundInfo memory ri = c.roundInfo(1);
        assertEq(ri.pot, 400 * U, "3 pulled + 100 covered");
        assertEq(ri.payout, 400 * U - 4 * U - 4 * U - 80 * U);
        assertEq(c.memberInfo(actors[4]).debt, 100 * U);
        assertEq(c.memberInfo(actors[4]).lateCount, 1);
        _assertLedger();
    }

    function test_Cascade_ReserveAlone() public {
        CircleParams memory p = _params();
        p.alphaBps = 5000;
        _newCircle(p, 0);
        usdc.mint(address(c), 200 * U);
        c.exposed_setReserve(200 * U);
        _block(actors[4]);
        _settle();
        Shortfall memory sf = c.shortfallOf(1, actors[4]);
        assertEq(sf.fromReserve, 100 * U);
        assertEq(sf.uncovered, 0);
        // 100 left of the preset reserve plus the 1% premium of the 400 pot.
        assertEq(c.reserve(), 100 * U + 4 * U);
        assertEq(c.roundInfo(1).uncovered, 0);
        _assertLedger();
    }

    function test_Cascade_ReserveThenUncovered_WinnerReceivesLess() public {
        CircleParams memory p = _params();
        p.alphaBps = 5000;
        _newCircle(p, 0);
        usdc.mint(address(c), 60 * U);
        c.exposed_setReserve(60 * U);
        _block(actors[4]);
        _toDeadline();
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallCovered(1, actors[4], CoverSource.Reserve, 60 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallCovered(1, actors[4], CoverSource.Uncovered, 40 * U);
        c.settleRound();
        Shortfall memory sf = c.shortfallOf(1, actors[4]);
        assertEq(sf.fromReserve, 60 * U);
        assertEq(sf.uncovered, 40 * U);
        RoundInfo memory ri = c.roundInfo(1);
        assertEq(ri.pot, 360 * U, "300 pulled + 60 from reserve");
        assertEq(ri.uncovered, 40 * U);
        // fee 3.6, premium 3.6, H = min(50% * 4 * 100 = 200, 352.8) = 200
        assertEq(ri.fee, 3_600_000);
        assertEq(ri.payout, 360 * U - 3_600_000 - 3_600_000 - 200 * U);
        _assertLedger();
    }

    /// @dev All four sources in order inside one round, several debtors sharing the bond and reserve.
    function test_Cascade_AllSourcesExhaustedInOrder() public {
        CircleParams memory p = _params();
        p.alphaBps = 1000;
        _newCircle(p, 240 * U); // coverage 10% + 240/600 = 50%
        _settle(); // M1 wins, pot 400, fee 4, premium 4 (reserve 4), H = 40
        assertEq(c.memberInfo(actors[0]).holdback, 40 * U);
        assertEq(c.reserve(), 4 * U);
        _block(actors[0]); // dead, holdback 40
        _block(actors[2]);
        _block(actors[3]);
        _block(actors[4]);
        _settle(); // winner M2 (fallback); nobody pays
        // joinIndex order: M1 (holdback 40 + bond 60), M3 (bond 100), M4 (bond 80 + reserve 4 + 16 uncovered), M5 (100 uncovered)
        Shortfall memory a = c.shortfallOf(2, actors[0]);
        assertEq(a.fromHoldback, 40 * U);
        assertEq(a.fromBond, 60 * U);
        Shortfall memory b = c.shortfallOf(2, actors[2]);
        assertEq(b.fromBond, 100 * U);
        Shortfall memory d = c.shortfallOf(2, actors[3]);
        assertEq(d.fromBond, 80 * U);
        assertEq(d.fromReserve, 4 * U);
        assertEq(d.uncovered, 16 * U);
        Shortfall memory e = c.shortfallOf(2, actors[4]);
        assertEq(e.fromBond, 0);
        assertEq(e.fromReserve, 0);
        assertEq(e.uncovered, 100 * U);
        RoundInfo memory ri = c.roundInfo(2);
        assertEq(ri.pot, 284 * U, "40 + 60 + 100 + 80 + 4");
        assertEq(ri.uncovered, 116 * U);
        assertEq(ri.fee, 2_840_000);
        assertEq(ri.premium, 2_840_000);
        assertEq(ri.holdback, 30 * U, "alpha * (5 - 2) * 100 = 30");
        assertEq(ri.payout, 284 * U - 2_840_000 - 2_840_000 - 30 * U);
        assertEq(c.bondRemaining(), 0);
        assertEq(c.reserve(), 2_840_000, "reserve emptied, then the new premium");
        assertEq(c.memberInfo(actors[0]).holdback, 0);
        assertEq(c.memberInfo(actors[0]).debt, 100 * U);
        _assertLedger();
    }

    // ================================================================== frozen and defaulted members

    function test_Frozen_MemberIsNotPulledAndCountsAsFullShortfall() public {
        c.exposed_setDefaulted(actors[2], true); // frozen: not received, defaulted
        uint256 before = usdc.balanceOf(actors[2]);
        _settle();
        assertEq(usdc.balanceOf(actors[2]), before, "no transferFrom attempted");
        Shortfall memory sf = c.shortfallOf(1, actors[2]);
        assertEq(sf.amount, 100 * U, "C - b with b = 0");
        assertEq(sf.fromBond, 100 * U);
        assertEq(c.memberInfo(actors[2]).debt, 100 * U);
        assertEq(c.memberInfo(actors[2]).lateCount, 0, "already defaulted: not late again");
        assertEq(rep.reputationOf(actors[2]).late, 0);
        assertEq(c.roundInfo(1).pot, 400 * U);
        _assertLedger();
    }

    function test_DefaultedDead_IsStillPulledAndGetsNoRelease() public {
        _round1();
        c.exposed_setDefaulted(actors[3], true); // M4: received then defaulted
        _round2Bids();
        uint256 before = usdc.balanceOf(actors[3]);
        _settle();
        assertEq(before - usdc.balanceOf(actors[3]), 100 * U, "C is still pulled");
        assertEq(c.memberInfo(actors[3]).holdback, 80 * U, "no per-round release for a defaulted member");
        assertEq(rep.reputationOf(actors[3]).onTime, 0);
        _assertLedger();
    }

    /// @dev Frozen winner repays its own shortfalls from its pot: principal in refund order, then late fees.
    function test_FrozenWinner_RepaysFromPotPrincipalThenFees() public {
        _block(actors[4]);
        _settle(); // r1: M5 (live) fails, bond covers 100
        _unblock(actors[4]);
        _settle(); // r2: M5 pays
        _settle(); // r3
        c.exposed_setDefaulted(actors[4], true); // markDefault happens (C7): M5 frozen
        _settle(); // r4: virtual shortfall, bond covers 100
        assertEq(c.memberInfo(actors[4]).debt, 200 * U);
        assertEq(c.bondRemaining(), 280 * U);
        uint256 bondEnd = c.bondRemaining();
        uint256 reserveBefore = c.reserve();
        uint256 balBefore = usdc.balanceOf(actors[4]);
        _toDeadline(); // r5: only M5 is left, frozen, so it wins with b = 0; the 4 dead members pay C each
        c.settleRound();

        RoundInfo memory ri = c.roundInfo(5);
        assertEq(ri.winner, actors[4]);
        assertEq(ri.pot, 400 * U);
        assertEq(ri.holdback, 0, "frozen: H = 0");
        uint256 fee = _lateFee(100 * U, 4 * 180) + _lateFee(100 * U, 180);
        assertEq(ri.payout, 392 * U - 200 * U - fee, "pot - fee - premium - principal - late fees");
        assertEq(usdc.balanceOf(actors[4]) - balBefore, ri.payout);
        assertEq(c.memberInfo(actors[4]).debt, 0);
        assertTrue(c.shortfallOf(1, actors[4]).resolved);
        assertTrue(c.shortfallOf(4, actors[4]).resolved);
        assertEq(c.shortfallOf(1, actors[4]).fromBond, 0);
        assertEq(c.bondRemaining(), bondEnd + 200 * U, "bond refilled");
        assertEq(c.reserve(), reserveBefore + 4 * U + fee, "premium + late fees");
        assertTrue(c.memberInfo(actors[4]).received);
        assertEq(c.liveCount(), 0);
        _assertLedger();
    }

    /// @dev Pot too small for the whole debt: principal goes first, oldest round first, no fees, winner gets nothing.
    function test_FrozenWinner_PotShortOfDebt_PaysOldestPrincipalFirst() public {
        _block(actors[4]);
        _settle(); // r1 shortfall (bond 100)
        c.exposed_setDefaulted(actors[4], true);
        _settle(); // r2 virtual
        _settle(); // r3 virtual
        _settle(); // r4 virtual
        assertEq(c.memberInfo(actors[4]).debt, 400 * U);
        _toDeadline();
        c.settleRound(); // r5 pot 400, avail 392 < 400 debt
        assertEq(c.roundInfo(5).payout, 0);
        assertEq(c.memberInfo(actors[4]).debt, 8 * U);
        assertTrue(c.shortfallOf(1, actors[4]).resolved);
        assertTrue(c.shortfallOf(3, actors[4]).resolved);
        assertFalse(c.shortfallOf(4, actors[4]).resolved);
        assertEq(c.shortfallOf(4, actors[4]).fromBond, 8 * U, "newest keeps the remainder");
        _assertLedger();
    }

    /// @dev I-09: a Fixed winner that is live but still owes a shortfall (markDefault not called yet).
    function test_LiveWinnerWithOpenShortfall_RepaysFromPotThenGetsHoldback() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        _newCircle(p, 480 * U);
        _block(actors[1]);
        _settle(); // r1: M1 wins (joinIndex 0); M2 fails
        _unblock(actors[1]);
        assertEq(c.memberInfo(actors[1]).debt, 100 * U);
        _toDeadline();
        c.settleRound(); // r2: M2 wins (live, owes 100)
        RoundInfo memory ri = c.roundInfo(2);
        assertEq(ri.winner, actors[1]);
        uint256 fee = _lateFee(100 * U, 180);
        // pot 400 = 100 (M1, dead) + 3 live x 100; minus 4 + 4; minus debt 100 + fee; H = 20% * 3 * 100 = 60
        assertEq(ri.holdback, 60 * U);
        assertEq(ri.payout, 392 * U - 100 * U - fee - 60 * U);
        assertEq(c.memberInfo(actors[1]).debt, 0);
        assertTrue(c.shortfallOf(1, actors[1]).resolved);
        assertEq(c.bondRemaining(), 480 * U);
        assertEq(c.liveCount(), 3);
        assertEq(c.memberInfo(actors[1]).holdback, 60 * U);
        _assertLedger();
    }

    /// @dev docs/03 6.8 refund order inside one shortfall: uncovered (to that round's winner), reserve, bond, holdback.
    function test_RepayOrder_UncoveredThenReserveThenBondThenHoldback() public {
        address debtor = actors[4];
        address r1Winner = actors[0];
        usdc.mint(address(c), 1000 * U);
        c.exposed_setRoundWinner(1, r1Winner);
        c.exposed_setDebt(debtor, uint128(140 * U));
        c.exposed_setShortfall(
            1,
            debtor,
            Shortfall({
                amount: uint128(140 * U),
                fromHoldback: uint128(10 * U),
                fromBond: uint128(20 * U),
                fromReserve: uint128(30 * U),
                uncovered: uint128(80 * U),
                since: uint64(block.timestamp),
                resolved: false
            })
        );
        uint256 winnerBefore = usdc.balanceOf(r1Winner);
        uint256 bondBefore = c.bondRemaining();
        uint256 reserveBefore = c.reserve();

        // Budget 100: uncovered 80 (straight to the round winner) then reserve 20 of 30.
        c.exposed_repayFromPot(debtor, 100 * U, 2);
        assertEq(usdc.balanceOf(r1Winner) - winnerBefore, 80 * U);
        Shortfall memory sf = c.shortfallOf(1, debtor);
        assertEq(sf.uncovered, 0);
        assertEq(sf.fromReserve, 10 * U);
        assertEq(sf.fromBond, 20 * U);
        assertEq(sf.fromHoldback, 10 * U);
        assertEq(c.reserve(), reserveBefore + 20 * U);
        assertEq(c.bondRemaining(), bondBefore);
        assertEq(c.memberInfo(debtor).debt, 40 * U);
        assertFalse(sf.resolved);

        // Budget 60: reserve 10, bond 20, holdback 10 (and 20 left over, nothing more to repay).
        c.exposed_repayFromPot(debtor, 60 * U, 2);
        sf = c.shortfallOf(1, debtor);
        assertEq(sf.fromReserve + sf.fromBond + sf.fromHoldback + sf.uncovered, 0);
        assertTrue(sf.resolved);
        assertEq(c.reserve(), reserveBefore + 30 * U, "no time passed, so no late fee");
        assertEq(c.bondRemaining(), bondBefore + 20 * U);
        assertEq(c.memberInfo(debtor).holdback, 10 * U, "holdback refilled");
        assertEq(c.memberInfo(debtor).debt, 0);
    }

    // ================================================================== reveal bonds, ties, payouts

    function test_UnrevealedCommit_ForfeitsBondToReserveAndCountsLate() public {
        _commit(actors[0], 3 * U);
        _commit(actors[1], 2 * U);
        _toReveal();
        _reveal(actors[1], 2 * U); // actors[0] never reveals
        assertEq(c.revealBondsHeld(), 1 * U);
        _toDeadline();
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.RevealBondForfeited(1, actors[0], 1 * U);
        c.settleRound();
        assertEq(c.roundInfo(1).winner, actors[1], "unrevealed bid cannot win");
        assertEq(c.revealBondsHeld(), 0);
        assertEq(c.reserve(), 1 * U + HuiMath.bpsOf(c.roundInfo(1).pot, 100), "bond + premium");
        assertEq(c.memberInfo(actors[0]).lateCount, 1);
        assertEq(rep.reputationOf(actors[0]).late, 1);
        assertEq(c.commitOf(1, actors[0]).bondHeld, 0);
        _assertLedger();
    }

    function test_UnrevealedCommit_ZeroRevealBond_StillCountsLate() public {
        CircleParams memory p = _params();
        p.revealBondBps = 0;
        _newCircle(p, 480 * U);
        _commit(actors[0], 3 * U);
        _toReveal(); // never revealed
        _settle();
        assertEq(c.memberInfo(actors[0]).lateCount, 1);
        assertEq(rep.reputationOf(actors[0]).late, 1);
        assertEq(c.reserve(), HuiMath.bpsOf(c.roundInfo(1).pot, 100), "only the premium");
        _assertLedger();
    }

    function test_BidAboveCap_CannotReveal_ForfeitsBond() public {
        _commit(actors[2], 7 * U); // cap is 6.575342
        _commit(actors[1], 1 * U);
        _toReveal();
        vm.prank(actors[2]);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.BidTooHigh.selector, 7 * U, 6_575_342));
        c.revealBid(7 * U, _salt(actors[2]));
        _reveal(actors[1], 1 * U);
        _settle();
        assertEq(c.roundInfo(1).winner, actors[1]);
        assertEq(c.reserve(), 1 * U + HuiMath.bpsOf(c.roundInfo(1).pot, 100));
        _assertLedger();
    }

    function test_Tiebreak_UsesRegistryLatenessAtSettlement() public {
        _commit(actors[0], 3 * U); // earlier
        _commit(actors[1], 3 * U);
        rep.setLate(actors[0], 1);
        _toReveal();
        _reveal(actors[1], 3 * U);
        _reveal(actors[0], 3 * U);
        _settle();
        assertEq(c.roundInfo(1).winner, actors[1]);
    }

    function test_NoBid_FallbackWinnerIsSmallestLiveJoinIndexWithZeroBid() public {
        _settle();
        RoundInfo memory ri = c.roundInfo(1);
        assertEq(ri.winner, actors[0]);
        assertEq(ri.winningBid, 0);
        assertEq(ri.pot, 400 * U);
        assertEq(ri.payout, 400 * U - 4 * U - 4 * U - 80 * U);
    }

    function test_BlockedWinner_PayoutGoesToClaimable() public {
        usdc.setBlacklisted(actors[0], true); // winner of round 1 (fallback)
        _toDeadline();
        uint256 expected = 400 * U - 4 * U - 4 * U - 80 * U;
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(actors[0], expected);
        c.settleRound(); // the round still settles
        assertEq(c.settledRounds(), 1);
        assertEq(c.claimable(actors[0]), expected);
        assertEq(c.totalClaimable(), expected);
        _assertLedger();
        usdc.setBlacklisted(actors[0], false);
        uint256 before = usdc.balanceOf(actors[0]);
        vm.prank(actors[0]);
        c.claim();
        assertEq(usdc.balanceOf(actors[0]) - before, expected);
        _assertLedger();
    }

    function test_BlockedMember_PullFailureIsShortfallNotRevert() public {
        usdc.setBlacklisted(actors[2], true); // transferFrom from a blocked wallet reverts
        _settle();
        assertEq(c.shortfallOf(1, actors[2]).amount, 100 * U);
        assertEq(c.settledRounds(), 1);
        _assertLedger();
    }

    // ================================================================== schedule (D-A) and eligibility (D-D)

    function test_LateSettle_DelaysNextRoundButKeepsFullCommitWindow() public {
        uint256 late = t0 + 1000; // much later than deadline(1) = t0 + 180
        vm.warp(late);
        c.settleRound();
        assertEq(c.roundStart(2), late, "round 2 starts when round 1 was settled");
        assertEq(c.deadline(2), late + 180);
        assertEq(uint8(c.phase()), uint8(RoundPhase.Commit));
        // A full commit window remains: still open at +89 s, closed at +90 s.
        vm.warp(late + 89);
        _commit(actors[1], 2 * U);
        vm.warp(late + 90);
        vm.prank(actors[2]);
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        c.commitBid(bytes32(uint256(1)));
        // Reveal window follows, and the round cannot be settled before its own deadline.
        _reveal(actors[1], 2 * U);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.TooEarly.selector, uint64(late + 180)));
        c.settleRound();
        assertEq(c.roundInfo(2).settled, false);
    }

    function test_OnTimeSettle_NextRoundStartsAtDeadline() public {
        _settle();
        assertEq(c.roundStart(2), t0 + 180);
        _settle();
        assertEq(c.roundStart(3), t0 + 360);
    }

    function test_OnlyLiveMember_CannotCommit() public {
        for (uint256 i = 0; i < 4; i++) {
            c.exposed_setReceived(actors[i], uint8(i + 1));
        }
        c.exposed_setSettled(4);
        assertEq(c.liveCount(), 1);
        vm.warp(c.roundStart(5));
        vm.prank(actors[4]);
        vm.expectRevert(IHuiCircle.NotEligibleToBid.selector);
        c.commitBid(bytes32(uint256(1)));
    }

    // ================================================================== full circles

    function test_FullCircle_NoBids_AllPay_HoldbackFollowsSpecEveryRound() public {
        uint256 alphaC = 20 * U; // alpha * C per remaining round
        for (uint32 m = 1; m <= 5; m++) {
            _settle();
            assertEq(c.roundInfo(m).winner, actors[m - 1], "fallback order = joinIndex");
            assertEq(c.settledRounds(), m);
            // INV-06 equality: every dead member holds alpha * (N - m) * C.
            for (uint32 j = 0; j < m; j++) {
                assertEq(c.memberInfo(actors[j]).holdback, alphaC * (5 - m), "holdback = alpha (N - m) C");
            }
            assertEq(c.totalHoldback(), alphaC * (5 - m) * m, "sum = alpha O(m)");
            assertEq(c.liveCount(), 5 - m);
            _assertLedger();
        }
        // docs/03: nothing is lost, every winner of round k was a distinct member.
        for (uint256 i = 0; i < 5; i++) {
            assertTrue(c.memberInfo(actors[i]).received);
        }
        assertEq(c.bondRemaining(), 480 * U);
    }

    function test_FullCircle_Fixed_WinnersFollowJoinOrder() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        _newCircle(p, 480 * U);
        for (uint32 m = 1; m <= 5; m++) {
            _settle();
            assertEq(c.roundInfo(m).winner, actors[m - 1]);
            assertEq(c.roundInfo(m).winningBid, 0);
            _assertLedger();
        }
    }

    function test_FullCircle_FixedFrozenMemberIsPushedToTheEnd() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        _newCircle(p, 480 * U);
        c.exposed_setDefaulted(actors[0], true); // joinIndex 0 would win round 1 but is frozen
        _settle();
        assertEq(c.roundInfo(1).winner, actors[1]);
        _settle();
        _settle();
        _settle();
        assertEq(c.roundInfo(4).winner, actors[4]);
        _settle();
        assertEq(c.roundInfo(5).winner, actors[0], "frozen member receives last");
        _assertLedger();
    }

    // ================================================================== gas (informational, but bounded)

    function _gasCircle(uint8 n, uint256 bond) internal {
        CircleParams memory p = _params();
        p.memberCount = n;
        _newCircle(p, bond);
    }

    function test_Gas_Settle_N5_AllPay() public {
        _toDeadline();
        uint256 g = gasleft();
        c.settleRound();
        uint256 used = g - gasleft();
        console2.log("settleRound N=5 all pay, round 1:", used);
        assertLt(used, 1_000_000);
    }

    function test_Gas_Settle_N30_AllPay_MidCircle() public {
        _gasCircle(30, 18_000 * U);
        for (uint256 i = 0; i < 14; i++) {
            _settle();
        }
        _toDeadline();
        uint256 g = gasleft();
        c.settleRound(); // round 15: 14 dead members release holdback, 15 live members pay
        uint256 used = g - gasleft();
        console2.log("settleRound N=30 all pay, round 15:", used);
        assertLt(used, 3_000_000, "relay gas cap");
    }

    /// @dev docs/04 section 7.1 worst case: late round, many dead members releasing holdback, a few shortfalls.
    function test_Gas_Settle_N30_Round29_ThreeShortfalls() public {
        _gasCircle(30, 18_000 * U);
        for (uint256 i = 0; i < 28; i++) {
            _settle();
        }
        _block(actors[3]);
        _block(actors[4]);
        _block(actors[5]);
        _toDeadline();
        uint256 g = gasleft();
        c.settleRound();
        uint256 used = g - gasleft();
        console2.log("settleRound N=30 round 29, 3 shortfalls:", used);
        assertLt(used, 2_500_000, "docs/04 warning level");
        _assertLedger();
    }

    /// @dev Pathological: every one of the 29 payers fails in one round. Not the documented worst case, but it must
    /// still fit the keeper hard cap of 5,000,000 gas (docs/04 section 7.1).
    function test_Gas_Settle_N30_AllFail_Round1() public {
        _gasCircle(30, 18_000 * U);
        for (uint256 i = 1; i < 30; i++) {
            _block(actors[i]);
        }
        _toDeadline();
        uint256 g = gasleft();
        c.settleRound(); // 29 shortfalls
        uint256 used = g - gasleft();
        console2.log("settleRound N=30 all fail, round 1:", used);
        assertLt(used, 5_000_000, "keeper hard cap");
        _assertLedger();
    }

    // ================================================================== fuzz (INV-01, INV-02, INV-03, INV-05 per round)

    /// @dev Random bids, random pull failures and random markDefault pokes over a whole circle.
    function testFuzz_Settle_FullCircle(uint256 seed, uint16 alphaSeed, uint8 bondPct) public {
        CircleParams memory p = _params();
        p.alphaBps = uint16(5000 + uint256(alphaSeed) % 5001);
        _newCircle(p, (uint256(bondPct) % 101) * 4_800_000);

        for (uint32 k = 1; k <= 5; k++) {
            _fuzzBids(seed, k);
            _fuzzBlocks(seed, k);
            _toDeadline();
            (address w,) = c.exposed_selectWinner(k);
            MemberInfo memory wBefore = c.memberInfo(w);
            assertFalse(wBefore.received, "winner has not received yet");
            c.settleRound();

            RoundInfo memory ri = c.roundInfo(k);
            assertEq(ri.winner, w);
            assertTrue(c.memberInfo(w).received);
            assertLt(ri.winningBid, 100 * U, "INV-03: bid < C");
            uint256 split = uint256(ri.payout) + ri.fee + ri.premium + ri.holdback;
            if (wBefore.debt == 0) {
                assertEq(split, ri.pot, "INV-05: payout + fee + premium + H == pot");
            } else {
                assertLe(split, ri.pot, "INV-05 with the winner's own debt repaid from the pot");
            }
            _assertLedger();
            _fuzzDefault(seed, k);
        }
        assertEq(c.settledRounds(), 5);
        for (uint256 i = 0; i < 5; i++) {
            assertTrue(c.memberInfo(actors[i]).received, "INV-02: everybody received once");
        }
        uint256 fees;
        for (uint32 k = 1; k <= 5; k++) {
            fees += c.feeEscrow(k);
        }
        assertEq(fees, c.totalFeeEscrow());
    }

    function _h(uint256 seed, uint32 k, uint256 j, uint256 salt) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, k, j, salt)));
    }

    function _fuzzBids(uint256 seed, uint32 k) internal {
        if (c.liveCount() <= 1) return;
        uint256 max = c.maxBid(k);
        address[5] memory who;
        uint256[5] memory bids;
        uint256 count;
        vm.warp(c.roundStart(k));
        for (uint256 j = 0; j < 5; j++) {
            MemberInfo memory mi = c.memberInfo(actors[j]);
            if (mi.received || mi.defaulted || mi.debt != 0) continue;
            if (_h(seed, k, j, 1) % 3 != 0) continue;
            uint256 bid = (_h(seed, k, j, 2) % (max + 1));
            _commit(actors[j], bid);
            who[count] = actors[j];
            bids[count] = bid;
            count++;
        }
        _toReveal();
        for (uint256 i = 0; i < count; i++) {
            if (_h(seed, k, i, 3) % 5 == 0) continue; // some never reveal
            _reveal(who[i], bids[i]);
        }
    }

    function _fuzzBlocks(uint256 seed, uint32 k) internal {
        for (uint256 j = 0; j < 5; j++) {
            if (_h(seed, k, j, 4) % 7 == 0) _block(actors[j]);
            else _unblock(actors[j]);
        }
    }

    /// @dev Pretend `markDefault` ran for a member that still owes something.
    function _fuzzDefault(uint256 seed, uint32 k) internal {
        for (uint256 j = 0; j < 5; j++) {
            MemberInfo memory mi = c.memberInfo(actors[j]);
            if (mi.debt != 0 && !mi.defaulted && _h(seed, k, j, 5) % 4 == 0) c.exposed_setDefaulted(actors[j], true);
        }
    }
}
