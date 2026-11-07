// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CircleFixture} from "../utils/CircleFixture.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {Commit, CircleMode, CircleParams, CircleState, MemberInfo, RoundPhase} from "../../src/libraries/HuiTypes.sol";

/// @notice C5: sealed bids (commit, reveal) and deterministic winner selection (docs/03 sections 3.2, 6.1-6.4).
/// Circle of docs/03 section 8: round 1 commit [t0, t0+90), reveal [t0+90, t0+150), deadline t0+180.
contract HuiCircleBiddingTest is CircleFixture {
    HuiCircleHarness internal c;
    uint256 internal t0;

    function setUp() public override {
        super.setUp();
        c = _workedExample();
        t0 = block.timestamp;
    }

    // ------------------------------------------------------------------ helpers

    function _salt(uint256 i) internal pure returns (bytes32) {
        return keccak256(abi.encode("salt", i));
    }

    function _hash(HuiCircleHarness circle, uint32 round, address m, uint256 bid, bytes32 salt)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(address(circle), round, m, bid, salt));
    }

    function _commit(address m, uint256 bid, bytes32 salt) internal {
        bytes32 h = _hash(c, c.currentRound(), m, bid, salt);
        vm.prank(m);
        c.commitBid(h);
    }

    function _reveal(address m, uint256 bid, bytes32 salt) internal {
        vm.prank(m);
        c.revealBid(bid, salt);
    }

    function _toReveal() internal {
        vm.warp(t0 + 90);
    }

    function _winner() internal view returns (address w, uint256 bid) {
        return c.exposed_selectWinner(c.currentRound());
    }

    function _assertLedger() internal view {
        assertEq(
            usdc.balanceOf(address(c)),
            c.bondRemaining() + c.reserve() + c.revealBondsHeld() + c.totalClaimable(),
            "INV-01 ledger"
        );
    }

    // ================================================================== views and schedule

    function test_MaxBid_MatchesDocsTable() public {
        // docs/03 section 8: USDC, 6 decimals, rounded down. Nobody has received yet.
        assertEq(c.maxBid(1), 6_575_342);
        // For k >= 2 the table assumes k-1 earlier winners; mimic that by marking them received.
        c.exposed_setReceived(actors[0], 1);
        assertEq(c.maxBid(2), 4_931_506);
        c.exposed_setReceived(actors[1], 2);
        assertEq(c.maxBid(3), 3_287_671);
        c.exposed_setReceived(actors[2], 3);
        assertEq(c.maxBid(4), 1_643_835);
        c.exposed_setReceived(actors[3], 4);
        assertEq(c.maxBid(5), 0);
    }

    function test_MaxBid_ShrinksWhenMembersFreeze() public {
        uint256 before = c.maxBid(1);
        c.exposed_setDefaulted(actors[4], true); // frozen: fewer payers, higher per-payer ceiling but never >= C
        assertEq(c.exposed_liveCount(), 4);
        assertEq(c.maxBid(1), HuiMath.maxBid(2000, 5, 1, 100 * USDC, 30 days, 3));
        assertGe(c.maxBid(1), before);
        assertLt(c.maxBid(1), 100 * USDC);
    }

    function test_Schedule_RoundStartAndDeadline() public view {
        assertEq(c.roundStart(1), t0);
        assertEq(c.deadline(1), t0 + 180);
        assertEq(c.roundStart(2), t0 + 180);
        assertEq(c.deadline(3), t0 + 540);
    }

    function test_Schedule_PausedTotalShiftsWindows() public {
        c.exposed_setPausedTotal(100);
        assertEq(c.roundStart(1), t0 + 100);
        bytes32 h = _hash(c, 1, actors[0], 0, _salt(0));
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        c.commitBid(h);
        vm.warp(t0 + 100);
        vm.prank(actors[0]);
        c.commitBid(h);
        vm.warp(t0 + 100 + 90 - 1);
        vm.prank(actors[1]);
        c.commitBid(_hash(c, 1, actors[1], 0, _salt(1)));
        vm.warp(t0 + 100 + 90);
        vm.prank(actors[2]);
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        c.commitBid(_hash(c, 1, actors[2], 0, _salt(2)));
    }

    function test_Phase_FollowsTheClock() public {
        assertEq(uint8(c.phase()), uint8(RoundPhase.Commit));
        vm.warp(t0 + 89);
        assertEq(uint8(c.phase()), uint8(RoundPhase.Commit));
        vm.warp(t0 + 90);
        assertEq(uint8(c.phase()), uint8(RoundPhase.Reveal));
        vm.warp(t0 + 149);
        assertEq(uint8(c.phase()), uint8(RoundPhase.Reveal));
        vm.warp(t0 + 150);
        assertEq(uint8(c.phase()), uint8(RoundPhase.AwaitingSettle));
        vm.warp(t0 + 170);
        assertEq(uint8(c.phase()), uint8(RoundPhase.AwaitingSettle));
        // Round 1 settled early: round 2 only opens at t0 + 180.
        c.exposed_setSettled(1);
        assertEq(uint8(c.phase()), uint8(RoundPhase.NotStarted));
        vm.warp(t0 + 180);
        assertEq(uint8(c.phase()), uint8(RoundPhase.Commit));
        // Last round settled: Done.
        c.exposed_setSettled(5);
        assertEq(uint8(c.phase()), uint8(RoundPhase.Done));
    }

    // ================================================================== commitBid

    function test_Commit_WindowEdges() public {
        _commit(actors[0], 1, _salt(0)); // first second
        vm.warp(t0 + 89);
        _commit(actors[1], 1, _salt(1)); // last second
        vm.warp(t0 + 90);
        bytes32 h = _hash(c, 1, actors[2], 1, _salt(2));
        vm.prank(actors[2]);
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        c.commitBid(h);
    }

    function test_Commit_BeforeRoundStart() public {
        c.exposed_setSettled(1); // current round 2 starts at t0 + 180
        bytes32 h = _hash(c, 2, actors[0], 1, _salt(0));
        vm.warp(t0 + 179);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        c.commitBid(h);
        vm.warp(t0 + 180);
        vm.prank(actors[0]);
        c.commitBid(h);
        assertEq(c.commitOf(2, actors[0]).commitIndex, 1);
    }

    function test_Commit_PullsRevealBondAndEmits() public {
        bytes32 h = _hash(c, 1, actors[0], 5 * USDC, _salt(0));
        uint256 before = usdc.balanceOf(actors[0]);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.BidCommitted(1, actors[0], h, 1);
        vm.prank(actors[0]);
        c.commitBid(h);

        assertEq(before - usdc.balanceOf(actors[0]), 1 * USDC);
        assertEq(c.revealBondsHeld(), 1 * USDC);
        Commit memory cm = c.commitOf(1, actors[0]);
        assertEq(cm.hash, h);
        assertEq(cm.commitIndex, 1);
        assertEq(cm.bondHeld, 1 * USDC);
        assertFalse(cm.revealed);
        _assertLedger();
    }

    function test_Commit_IndexIncreasesPerCommit() public {
        _commit(actors[2], 1, _salt(2));
        _commit(actors[0], 1, _salt(0));
        _commit(actors[4], 1, _salt(4));
        assertEq(c.commitOf(1, actors[2]).commitIndex, 1);
        assertEq(c.commitOf(1, actors[0]).commitIndex, 2);
        assertEq(c.commitOf(1, actors[4]).commitIndex, 3);
        assertEq(c.revealBondsHeld(), 3 * USDC);
    }

    function test_Commit_OverwriteKeepsBondTakesNewIndex() public {
        _commit(actors[0], 1, _salt(0));
        _commit(actors[1], 1, _salt(1));
        uint256 balance = usdc.balanceOf(actors[0]);
        bytes32 h2 = _hash(c, 1, actors[0], 2, _salt(9));
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.BidCommitted(1, actors[0], h2, 3);
        vm.prank(actors[0]);
        c.commitBid(h2);

        Commit memory cm = c.commitOf(1, actors[0]);
        assertEq(cm.hash, h2);
        assertEq(cm.commitIndex, 3, "later than actors[1]");
        assertEq(cm.bondHeld, 1 * USDC, "single bond");
        assertEq(usdc.balanceOf(actors[0]), balance, "no second bond pulled");
        assertEq(c.revealBondsHeld(), 2 * USDC);
        _assertLedger();
    }

    function test_Commit_NotMember() public {
        _fund(actors[9], 100 * USDC);
        vm.prank(actors[9]);
        vm.expectRevert(IHuiCircle.NotMember.selector);
        c.commitBid(bytes32(uint256(1)));
    }

    function test_Commit_NotEligibleWhenReceived() public {
        c.exposed_setReceived(actors[0], 1);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotEligibleToBid.selector);
        c.commitBid(bytes32(uint256(1)));
    }

    function test_Commit_NotEligibleWhenFrozenOrDefaulted() public {
        c.exposed_setDefaulted(actors[0], true);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotEligibleToBid.selector);
        c.commitBid(bytes32(uint256(1)));
    }

    function test_Commit_NotEligibleWithOpenShortfall() public {
        c.exposed_setDebt(actors[0], 1);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotEligibleToBid.selector);
        c.commitBid(bytes32(uint256(1)));
        // Paying it back (debt 0) restores eligibility.
        c.exposed_setDebt(actors[0], 0);
        _commit(actors[0], 1, _salt(0));
    }

    function test_Commit_RevertsWithoutAllowanceForBond() public {
        vm.prank(actors[0]);
        usdc.approve(address(c), 0);
        vm.prank(actors[0]);
        vm.expectRevert();
        c.commitBid(bytes32(uint256(1)));
        assertEq(c.revealBondsHeld(), 0, "state rolled back");
        assertEq(c.commitOf(1, actors[0]).commitIndex, 0);
    }

    function test_Commit_ZeroRevealBondCircle() public {
        CircleParams memory p = _params();
        p.revealBondBps = 0;
        HuiCircleHarness z = _active(p, 480 * USDC);
        uint256 before = usdc.balanceOf(actors[0]);
        vm.prank(actors[0]);
        z.commitBid(bytes32(uint256(7)));
        assertEq(usdc.balanceOf(actors[0]), before);
        assertEq(z.revealBondsHeld(), 0);
        assertEq(z.commitOf(1, actors[0]).commitIndex, 1);
    }

    function test_Commit_WrongStateWhenForming() public {
        HuiCircleHarness f = _create(_params());
        vm.prank(actors[0]);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Forming));
        f.commitBid(bytes32(uint256(1)));
    }

    function test_Commit_WhilePaused() public {
        c.exposed_setState(CircleState.Paused);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.commitBid(bytes32(uint256(1)));
    }

    function test_Commit_RoundAlreadySettled() public {
        c.exposed_setSettled(5); // last round settled: currentRound() stays 5
        vm.warp(t0 + 4 * 180);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.RoundAlreadySettled.selector);
        c.commitBid(bytes32(uint256(1)));
    }

    function test_Commit_FixedCircleHasNoWindow() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        HuiCircleHarness f = _active(p, 480 * USDC);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        f.commitBid(bytes32(uint256(1)));
        vm.warp(block.timestamp + 1);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotInCommitWindow.selector);
        f.commitBid(bytes32(uint256(1)));
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotInRevealWindow.selector);
        f.revealBid(0, bytes32(0));
    }

    // ================================================================== revealBid

    function test_Reveal_WindowEdges() public {
        _commit(actors[0], 1, _salt(0));
        _commit(actors[1], 1, _salt(1));
        vm.warp(t0 + 89); // still commit window
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotInRevealWindow.selector);
        c.revealBid(1, _salt(0));
        vm.warp(t0 + 90); // first reveal second
        _reveal(actors[0], 1, _salt(0));
        vm.warp(t0 + 149); // last reveal second
        _reveal(actors[1], 1, _salt(1));
        vm.warp(t0 + 150);
        vm.prank(actors[2]);
        vm.expectRevert(IHuiCircle.NotInRevealWindow.selector);
        c.revealBid(1, _salt(2));
    }

    function test_Reveal_AfterWindowLosesBond() public {
        _commit(actors[0], 1, _salt(0));
        vm.warp(t0 + 150);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotInRevealWindow.selector);
        c.revealBid(1, _salt(0));
        assertEq(c.revealBondsHeld(), 1 * USDC, "bond stays for forfeiture at settlement (C6)");
    }

    function test_Reveal_RefundsBondAndEmits() public {
        _commit(actors[0], 3 * USDC, _salt(0));
        _toReveal();
        uint256 before = usdc.balanceOf(actors[0]);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.BidRevealed(1, actors[0], 3 * USDC);
        _reveal(actors[0], 3 * USDC, _salt(0));

        assertEq(usdc.balanceOf(actors[0]) - before, 1 * USDC);
        assertEq(c.revealBondsHeld(), 0);
        Commit memory cm = c.commitOf(1, actors[0]);
        assertTrue(cm.revealed);
        assertEq(cm.bid, 3 * USDC);
        assertEq(cm.bondHeld, 0);
        _assertLedger();
    }

    function test_Reveal_NoCommit() public {
        _toReveal();
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NoCommit.selector);
        c.revealBid(0, bytes32(0));
    }

    function test_Reveal_Twice() public {
        _commit(actors[0], 1, _salt(0));
        _toReveal();
        _reveal(actors[0], 1, _salt(0));
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.AlreadyRevealed.selector);
        c.revealBid(1, _salt(0));
    }

    function test_Reveal_CommitMismatch() public {
        _commit(actors[0], 2 * USDC, _salt(0));
        _toReveal();
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.CommitMismatch.selector);
        c.revealBid(2 * USDC + 1, _salt(0)); // wrong bid
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.CommitMismatch.selector);
        c.revealBid(2 * USDC, _salt(1)); // wrong salt
    }

    function test_Reveal_CommitIsBoundToMemberAndRound() public {
        // Copying someone else's hash does not let you reveal their bid as your own: hash includes the member.
        bytes32 h = _hash(c, 1, actors[0], 2 * USDC, _salt(0));
        vm.prank(actors[1]);
        c.commitBid(h);
        _toReveal();
        vm.prank(actors[1]);
        vm.expectRevert(IHuiCircle.CommitMismatch.selector);
        c.revealBid(2 * USDC, _salt(0));
    }

    function test_Reveal_BidAtCeilingAccepted() public {
        uint256 max = c.maxBid(1);
        assertEq(max, 6_575_342);
        _commit(actors[0], max, _salt(0));
        _toReveal();
        _reveal(actors[0], max, _salt(0));
        (address w, uint256 b) = _winner();
        assertEq(w, actors[0]);
        assertEq(b, max);
    }

    function test_Reveal_BidAboveCeilingRevertsAndBondStaysHeld() public {
        uint256 max = c.maxBid(1);
        _commit(actors[0], max + 1, _salt(0));
        _toReveal();
        vm.prank(actors[0]);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.BidTooHigh.selector, max + 1, max));
        c.revealBid(max + 1, _salt(0));
        assertEq(c.revealBondsHeld(), 1 * USDC);
        assertFalse(c.commitOf(1, actors[0]).revealed);
        (address w,) = _winner();
        assertEq(w, actors[0], "no valid bid: fallback = lowest joinIndex (actors[0] by coincidence)");
        assertEq(c.commitOf(1, actors[0]).bid, 0, "invalid bid never stored");
    }

    function test_Reveal_BidEqualToContributionReverts() public {
        _commit(actors[0], 100 * USDC, _salt(0));
        _toReveal();
        uint256 max = c.maxBid(1);
        vm.prank(actors[0]);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.BidTooHigh.selector, 100 * USDC, max));
        c.revealBid(100 * USDC, _salt(0));
    }

    function test_Reveal_CeilingUsesLiveCountAtRevealTime() public {
        _commit(actors[0], 6_575_342, _salt(0)); // valid with 5 live (4 payers)
        c.exposed_setReceived(actors[4], 1); // later fewer live => higher per-payer ceiling, still fine
        _toReveal();
        _reveal(actors[0], 6_575_342, _salt(0));
        assertTrue(c.commitOf(1, actors[0]).revealed);
    }

    function test_Reveal_NotEligibleAnymore() public {
        _commit(actors[0], 1, _salt(0));
        c.exposed_setDebt(actors[0], 5);
        _toReveal();
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotEligibleToBid.selector);
        c.revealBid(1, _salt(0));
    }

    function test_Reveal_WhilePausedAndWrongState() public {
        _commit(actors[0], 1, _salt(0));
        _toReveal();
        c.exposed_setState(CircleState.Paused);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.revealBid(1, _salt(0));
        c.exposed_setState(CircleState.Completed);
        vm.prank(actors[0]);
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Active, CircleState.Completed)
        );
        c.revealBid(1, _salt(0));
    }

    function test_Reveal_RoundAlreadySettled() public {
        c.exposed_setSettled(5);
        vm.warp(t0 + 4 * 180 + 90);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.RoundAlreadySettled.selector);
        c.revealBid(0, bytes32(0));
    }

    function test_Reveal_BlockedBidderBondGoesToClaimable() public {
        _commit(actors[0], 1, _salt(0));
        _toReveal();
        usdc.setBlacklisted(actors[0], true);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(actors[0], 1 * USDC);
        _reveal(actors[0], 1, _salt(0));
        assertEq(c.claimable(actors[0]), 1 * USDC);
        assertEq(c.revealBondsHeld(), 0);
        assertTrue(c.commitOf(1, actors[0]).revealed, "a blocked address does not break the reveal");
        _assertLedger();
    }

    function test_Reveal_ViaForwarder() public {
        bytes32 h = _hash(c, 1, actors[0], 2, _salt(0));
        _forward(actors[0], address(c), abi.encodeCall(IHuiCircle.commitBid, (h)));
        assertEq(c.commitOf(1, actors[0]).commitIndex, 1);
        _toReveal();
        _forward(actors[0], address(c), abi.encodeCall(IHuiCircle.revealBid, (2, _salt(0))));
        assertTrue(c.commitOf(1, actors[0]).revealed);
    }

    // ================================================================== winner selection: bids

    function test_Winner_HighestBidWins() public {
        _commit(actors[0], 1 * USDC, _salt(0));
        _commit(actors[1], 4 * USDC, _salt(1));
        _commit(actors[3], 6 * USDC, _salt(3));
        _commit(actors[2], 2 * USDC, _salt(2));
        _toReveal();
        _reveal(actors[0], 1 * USDC, _salt(0));
        _reveal(actors[1], 4 * USDC, _salt(1));
        _reveal(actors[3], 6 * USDC, _salt(3));
        _reveal(actors[2], 2 * USDC, _salt(2));
        (address w, uint256 b) = _winner();
        assertEq(w, actors[3]); // docs/03 section 8: M4 wins round 1 with 6 USDC
        assertEq(b, 6 * USDC);
    }

    function test_Winner_RevealOrderDoesNotMatter() public {
        _commit(actors[0], 3 * USDC, _salt(0));
        _commit(actors[1], 3 * USDC, _salt(1));
        _commit(actors[2], 3 * USDC, _salt(2));
        _toReveal();
        _reveal(actors[2], 3 * USDC, _salt(2));
        _reveal(actors[1], 3 * USDC, _salt(1));
        _reveal(actors[0], 3 * USDC, _salt(0));
        (address w,) = _winner();
        assertEq(w, actors[0], "tie on bid and lateness: earliest commit");
    }

    function test_Winner_TieBrokenByFewerLates() public {
        // docs/03 section 8 round 2 shape: same bid, nobody late => earliest commit; here M2 has a late count.
        _commit(actors[0], 3 * USDC, _salt(0)); // earlier commit
        _commit(actors[1], 3 * USDC, _salt(1));
        c.exposed_setLateCount(actors[0], 1);
        _toReveal();
        _reveal(actors[0], 3 * USDC, _salt(0));
        _reveal(actors[1], 3 * USDC, _salt(1));
        (address w,) = _winner();
        assertEq(w, actors[1], "fewer late payments beats earlier commit");
    }

    function test_Winner_GlobalLatenessCounts() public {
        _commit(actors[0], 3 * USDC, _salt(0));
        _commit(actors[1], 3 * USDC, _salt(1));
        rep.setLate(actors[0], 2);
        _toReveal();
        _reveal(actors[1], 3 * USDC, _salt(1));
        _reveal(actors[0], 3 * USDC, _salt(0));
        (address w,) = _winner();
        assertEq(w, actors[1]);
    }

    function test_Winner_LocalPlusGlobalLateness() public {
        // actors[0]: local 1 + global 0 = 1. actors[1]: local 0 + global 2 = 2. actors[0] has fewer.
        _commit(actors[1], 3 * USDC, _salt(1)); // earlier commit
        _commit(actors[0], 3 * USDC, _salt(0));
        c.exposed_setLateCount(actors[0], 1);
        rep.setLate(actors[1], 2);
        _toReveal();
        _reveal(actors[1], 3 * USDC, _salt(1));
        _reveal(actors[0], 3 * USDC, _salt(0));
        (address w,) = _winner();
        assertEq(w, actors[0]);
    }

    function test_Winner_EqualLatenessFallsToCommitIndex() public {
        _commit(actors[2], 3 * USDC, _salt(2));
        _commit(actors[0], 3 * USDC, _salt(0));
        c.exposed_setLateCount(actors[0], 1);
        c.exposed_setLateCount(actors[2], 1);
        _toReveal();
        _reveal(actors[0], 3 * USDC, _salt(0));
        _reveal(actors[2], 3 * USDC, _salt(2));
        (address w,) = _winner();
        assertEq(w, actors[2]);
    }

    function test_Winner_HigherBidBeatsBetterRecord() public {
        _commit(actors[0], 3 * USDC, _salt(0));
        _commit(actors[1], 4 * USDC, _salt(1));
        c.exposed_setLateCount(actors[1], 9);
        _toReveal();
        _reveal(actors[0], 3 * USDC, _salt(0));
        _reveal(actors[1], 4 * USDC, _salt(1));
        (address w,) = _winner();
        assertEq(w, actors[1]);
    }

    function test_Winner_OverwriteMakesCommitLater() public {
        // docs/03 6.2: overwriting takes a new, later commitIndex, so on a tie it loses to the other committer.
        _commit(actors[0], 3 * USDC, _salt(0));
        _commit(actors[1], 3 * USDC, _salt(1));
        _commit(actors[0], 3 * USDC, _salt(5)); // rewrite with a different salt
        _toReveal();
        _reveal(actors[0], 3 * USDC, _salt(5));
        _reveal(actors[1], 3 * USDC, _salt(1));
        (address w,) = _winner();
        assertEq(w, actors[1]);
    }

    function test_Winner_OldSaltFailsAfterOverwrite() public {
        _commit(actors[0], 3 * USDC, _salt(0));
        _commit(actors[0], 3 * USDC, _salt(5));
        _toReveal();
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.CommitMismatch.selector);
        c.revealBid(3 * USDC, _salt(0));
    }

    function test_Winner_RegistryFailureDoesNotBlockReveal() public {
        _commit(actors[0], 3 * USDC, _salt(0));
        _commit(actors[1], 3 * USDC, _salt(1));
        rep.setBroken(true);
        _toReveal();
        _reveal(actors[0], 3 * USDC, _salt(0));
        _reveal(actors[1], 3 * USDC, _salt(1)); // compares lateness with a reverting registry: counts as zero
        (address w,) = _winner();
        assertEq(w, actors[0]);
    }

    function test_Winner_CommitWithoutRevealIgnored() public {
        _commit(actors[0], 6 * USDC, _salt(0)); // never revealed
        _commit(actors[1], 1 * USDC, _salt(1));
        _toReveal();
        _reveal(actors[1], 1 * USDC, _salt(1));
        (address w, uint256 b) = _winner();
        assertEq(w, actors[1]);
        assertEq(b, 1 * USDC);
    }

    function test_Winner_ZeroBidValidAndBeatsNoBid() public {
        // A revealed bid of 0 is a valid bid; the committer wins over the joinIndex fallback.
        _commit(actors[3], 0, _salt(3));
        _toReveal();
        _reveal(actors[3], 0, _salt(3));
        (address w, uint256 b) = _winner();
        assertEq(w, actors[3]);
        assertEq(b, 0);
    }

    // ================================================================== winner selection: no bid

    function test_Winner_NoBidsLowestLiveJoinIndex() public view {
        (address w, uint256 b) = _winner();
        assertEq(w, actors[0]);
        assertEq(b, 0);
    }

    function test_Winner_NoBidsSkipsReceivedAndFrozen() public {
        c.exposed_setReceived(actors[0], 1);
        c.exposed_setDefaulted(actors[1], true); // frozen
        (address w,) = _winner();
        assertEq(w, actors[2]);
    }

    function test_Winner_LastLiveMemberWins() public {
        c.exposed_setReceived(actors[0], 1);
        c.exposed_setReceived(actors[1], 2);
        c.exposed_setReceived(actors[2], 3);
        c.exposed_setReceived(actors[4], 4);
        (address w, uint256 b) = _winner();
        assertEq(w, actors[3]);
        assertEq(b, 0);
        assertEq(c.maxBid(5), 0);
    }

    function test_Winner_OnlyFrozenLeftSmallestJoinIndex() public {
        c.exposed_setReceived(actors[0], 1);
        c.exposed_setReceived(actors[1], 2);
        c.exposed_setReceived(actors[2], 3);
        c.exposed_setDefaulted(actors[4], true);
        c.exposed_setDefaulted(actors[3], true);
        (address w, uint256 b) = _winner();
        assertEq(w, actors[3], "frozen member with the smallest joinIndex");
        assertEq(b, 0);
    }

    function test_Winner_FrozenPushedBehindLiveMembers() public {
        c.exposed_setDefaulted(actors[0], true); // frozen, smallest joinIndex
        (address w,) = _winner();
        assertEq(w, actors[1]);
    }

    function test_Winner_NobodyLeftReturnsZero() public {
        for (uint256 i = 0; i < 5; i++) {
            c.exposed_setReceived(actors[i], uint8(i + 1));
        }
        (address w, uint256 b) = _winner();
        assertEq(w, address(0));
        assertEq(b, 0);
    }

    // ================================================================== Fixed mode order

    function test_Fixed_OrderFollowsJoinIndexWithFrozenAtTheEnd() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        HuiCircleHarness f = _active(p, 480 * USDC);

        (address w,) = f.exposed_selectWinner(1);
        assertEq(w, actors[0], "round 1: joinIndex 0");
        f.exposed_setReceived(actors[0], 1);
        (w,) = f.exposed_selectWinner(2);
        assertEq(w, actors[1], "round 2: joinIndex 1");

        // actors[2] becomes frozen before its turn: skipped, the later ones move up.
        f.exposed_setReceived(actors[1], 2);
        f.exposed_setDefaulted(actors[2], true);
        (w,) = f.exposed_selectWinner(3);
        assertEq(w, actors[3], "round 3: frozen skipped");
        f.exposed_setReceived(actors[3], 3);
        (w,) = f.exposed_selectWinner(4);
        assertEq(w, actors[4]);
        f.exposed_setReceived(actors[4], 4);
        (w,) = f.exposed_selectWinner(5);
        assertEq(w, actors[2], "round 5: frozen member goes last");
    }

    // ================================================================== randomness is never an input

    function testFuzz_Winner_IgnoresBlockEnvironment(uint256 prevrandao, uint64 ts, uint256 salt) public {
        salt = bound(salt, 0, type(uint128).max);
        _commit(actors[0], 3 * USDC, _salt(salt));
        _commit(actors[1], 3 * USDC, _salt(salt + 1));
        _toReveal();
        _reveal(actors[1], 3 * USDC, _salt(salt + 1));
        _reveal(actors[0], 3 * USDC, _salt(salt));
        (address w1,) = _winner();
        vm.prevrandao(bytes32(prevrandao));
        vm.warp(bound(ts, t0 + 150, t0 + 179));
        (address w2,) = _winner();
        assertEq(w1, w2);
        assertEq(w1, actors[0]);
    }

    // ================================================================== fuzz: winner is the argmax of the order

    /// @dev For random bids, commit order and reveal order, the winner is the highest bid, earliest commit on ties
    /// (nobody is late), and every bond is refunded.
    function testFuzz_Winner_MatchesReferenceOrder(uint256 seed) public {
        uint256 max = c.maxBid(1);
        uint256[5] memory bid;
        uint256[5] memory commitOrder = _shuffle(seed);
        for (uint256 i = 0; i < 5; i++) {
            // few distinct values so ties are common
            bid[i] = (uint256(keccak256(abi.encode(seed, "bid", i))) % 4) * (max / 3);
        }
        for (uint256 pos = 0; pos < 5; pos++) {
            uint256 who = commitOrder[pos];
            _commit(actors[who], bid[who], _salt(who));
        }
        _toReveal();
        uint256[5] memory revealOrder = _shuffle(seed >> 7);
        for (uint256 pos = 0; pos < 5; pos++) {
            uint256 who = revealOrder[pos];
            _reveal(actors[who], bid[who], _salt(who));
        }

        // Reference: scan in commit order, replace only on a strictly higher bid (so ties keep the earlier commit).
        uint256 best = commitOrder[0];
        for (uint256 pos = 1; pos < 5; pos++) {
            uint256 who = commitOrder[pos];
            if (bid[who] > bid[best]) best = who;
        }
        (address w, uint256 b) = _winner();
        assertEq(w, actors[best]);
        assertEq(b, bid[best]);
        assertEq(c.revealBondsHeld(), 0);
        _assertLedger();
    }

    function _shuffle(uint256 seed) internal pure returns (uint256[5] memory a) {
        for (uint256 i = 0; i < 5; i++) {
            a[i] = i;
        }
        for (uint256 i = 4; i > 0; i--) {
            uint256 j = uint256(keccak256(abi.encode(seed, i))) % (i + 1);
            (a[i], a[j]) = (a[j], a[i]);
        }
    }
}
