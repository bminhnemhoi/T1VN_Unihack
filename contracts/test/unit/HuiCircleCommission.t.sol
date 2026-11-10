// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {CircleParams, PermitSig, RoundInfo} from "../../src/libraries/HuiTypes.sol";

/// @notice A13: commission inside the interest cap (docs/03 section 2.7), the owner's own leg, and the fee payout
/// timing (immediate for a round without shortfalls, escrow otherwise). Numbers are the table of docs/03 section 8.1
/// (N = 5, C = 100, phi = 50%, feeBps = 300).
contract HuiCircleCommissionTest is CircleScenario {
    function setUp() public override {
        super.setUp();
        _newCircle(_phiParams(), 480 * USDC);
    }

    function _phiParams() internal view returns (CircleParams memory p) {
        p = _params();
        p.commissionShareBps = 5000;
        p.feeBps = 300;
        p.termsHash = keccak256("phi-terms");
    }

    function _feePaidCount(Vm.Log[] memory logs) internal pure returns (uint256) {
        return _count(logs, IHuiCircle.FeePaid.selector);
    }

    // ------------------------------------------------------------------ views and bid cap

    function test_Views_MatchTable() public view {
        assertEq(c.statutoryMaxBid(1), 6_575_342);
        assertEq(c.maxBid(1), 3_287_671);
        assertEq(c.commissionRoom(1), 26_301_368);
    }

    function test_Views_PhiZero_MaxBidIsStatutory() public {
        // the shared worked-example circle (phi = 0) keeps the old cap
        _newCircle(_params(), 480 * USDC);
        assertEq(c.maxBid(1), 6_575_342);
        assertEq(c.maxBid(1), c.statutoryMaxBid(1));
    }

    function test_Reveal_BidAtCapIsAccepted() public {
        _commit(_M(4), 3_287_671);
        _toReveal();
        _reveal(_M(4), 3_287_671);
        assertEq(c.commitOf(1, _M(4)).bid, 3_287_671);
    }

    function test_Reveal_RevertWhen_OneUnitAboveCap() public {
        _commit(_M(4), 3_287_672);
        _toReveal();
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.BidTooHigh.selector, 3_287_672, 3_287_671));
        _reveal(_M(4), 3_287_672);
    }

    // ------------------------------------------------------------------ fee timing and size

    function _round1Phi() internal {
        _commit(_M(4), 3 * U);
        _toReveal();
        _reveal(_M(4), 3 * U);
        _settle();
    }

    function test_Round1_ThreePercentCeilingBinds_PaidAtOnce() public {
        uint256 before = usdc.balanceOf(organizer);
        vm.recordLogs();
        _round1Phi();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        RoundInfo memory ri = c.roundInfo(1);
        assertEq(ri.pot, 388 * U);
        assertEq(ri.fee, 11_640_000); // min(13.150684, 3% of 388)
        assertEq(ri.premium, 3_880_000);
        assertEq(ri.holdback, 80 * U);
        assertEq(ri.payout, 292_480_000);
        assertEq(usdc.balanceOf(organizer) - before, 11_640_000, "organizer paid in the settling transaction");
        assertEq(c.feeEscrow(1), 0);
        assertEq(c.totalFeeEscrow(), 0);
        assertEq(_feePaidCount(logs), 1);
        // INV-11: fee + bid * L_k <= room_k
        assertLe(ri.fee + ri.winningBid * 4, c.commissionRoom(1));
        _assertLedger();
        _assertConserved();
    }

    function test_Round2_PhiRoomBinds_PaidAtOnce() public {
        _round1Phi();
        _commit(_M(1), 2_400_000);
        _toReveal();
        _reveal(_M(1), 2_400_000);
        uint256 before = usdc.balanceOf(organizer);
        _settle();
        RoundInfo memory ri = c.roundInfo(2);
        assertEq(ri.winner, _M(1));
        assertEq(ri.pot, 392_800_000);
        assertEq(ri.fee, 7_397_259); // phi * room_2, below 3% of 392.8
        assertEq(ri.premium, 3_928_000);
        assertEq(ri.holdback, 60 * U);
        assertEq(ri.payout, 321_474_741);
        assertEq(usdc.balanceOf(organizer) - before, 7_397_259);
        assertLe(ri.fee + ri.winningBid * 3, c.commissionRoom(2));
        _assertLedger();
    }

    function test_NoBids_FeeStillFollowsRoom() public {
        // round 1: nobody bids, M1 wins with b = 0; the 3% ceiling (12) is below phi * room (13.150684)
        _settleRounds(1, 1);
        assertEq(c.roundInfo(1).fee, 12 * U);
        _settleRounds(2, 3);
        // round 4: two live members left, one payer: room = 1.643835, phi * room = 0.821917
        _settleRounds(4, 4);
        assertEq(c.roundInfo(4).fee, 821_917);
        // round 5: nobody pays, no room, no fee
        _settleRounds(5, 5);
        assertEq(c.roundInfo(5).fee, 0);
        _assertLedger();
    }

    function test_ShortfallRound_FeeWaitsInEscrow() public {
        _round1Phi();
        _commit(_M(1), 2_400_000);
        _toReveal();
        _reveal(_M(1), 2_400_000);
        _block(_M(4));
        uint256 before = usdc.balanceOf(organizer);
        vm.recordLogs();
        _settle();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(c.roundInfo(2).fee, 7_397_259);
        assertEq(c.feeEscrow(2), 7_397_259);
        assertEq(c.totalFeeEscrow(), 7_397_259);
        assertEq(usdc.balanceOf(organizer), before, "nothing paid in a round with a shortfall");
        assertEq(_feePaidCount(logs), 0);
        _assertLedger();

        // markDefault forfeits that escrow into the reserve (docs/03 6.8)
        vm.warp(_graceEnd(2) + 1);
        uint256 reserveBefore = c.reserve();
        c.markDefault(_M(4));
        assertEq(c.feeEscrow(2), 0);
        assertEq(c.reserve(), reserveBefore + 7_397_259);
        assertTrue(c.roundInfo(2).feeForfeited);
        _assertLedger();
    }

    function test_OrganizerBlocked_FeeBecomesClaimable_RoundStillSettles() public {
        usdc.setBlacklisted(organizer, true);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(organizer, 12 * U);
        _settleRounds(1, 1);
        assertEq(c.roundInfo(1).fee, 12 * U);
        assertEq(c.claimable(organizer), 12 * U);
        assertEq(c.totalClaimable(), 12 * U);
        _assertLedger();
        usdc.setBlacklisted(organizer, false);
        vm.prank(organizer);
        c.claim();
        assertEq(c.claimable(organizer), 0);
    }

    // ------------------------------------------------------------------ the organizer's own leg

    function test_OrganizerWins_NoFee() public {
        address org = actors[0];
        CircleParams memory p = _phiParams();
        p.organizerIsMember = true;
        vm.prank(org);
        HuiCircleHarness x = HuiCircleHarness(factory.createCircle(p));
        _fund(org, 480 * USDC);
        vm.startPrank(org);
        usdc.approve(address(x), 480 * USDC);
        x.depositBond(480 * USDC, PermitSig({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)}));
        vm.stopPrank();
        _joinN(x, 5); // actors[0] joins first: it is the organizer and member #0
        vm.prank(org);
        x.activate();
        assertEq(x.organizer(), org);
        vm.warp(x.deadline(1));
        uint256 before = usdc.balanceOf(org);
        x.settleRound();
        RoundInfo memory ri = x.roundInfo(1);
        assertEq(ri.winner, org);
        assertEq(ri.fee, 0, "no commission on the organizer's own leg");
        assertEq(ri.pot, 400 * U);
        assertEq(ri.payout, 400 * U - 4 * U - 80 * U);
        assertEq(usdc.balanceOf(org) - before, ri.payout);
        assertEq(x.totalFeeEscrow(), 0);
    }

    // ------------------------------------------------------------------ phi = 0 keeps the fixed fee

    function test_PhiZero_FixedFee_PaidAtOnce() public {
        _newCircle(_params(), 480 * USDC);
        uint256 before = usdc.balanceOf(organizer);
        _round1();
        RoundInfo memory ri = c.roundInfo(1);
        assertEq(ri.fee, 3_760_000);
        assertEq(ri.payout, 288_480_000);
        assertEq(usdc.balanceOf(organizer) - before, 3_760_000);
        assertEq(c.feeEscrow(1), 0);
    }
}
