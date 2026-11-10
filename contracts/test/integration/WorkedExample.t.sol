// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {ReputationRegistry} from "../../src/ReputationRegistry.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {Reputation} from "../../src/interfaces/IReputationRegistry.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";
import {
    CircleParams,
    CircleState,
    CoverSource,
    MemberInfo,
    RoundInfo,
    Shortfall
} from "../../src/libraries/HuiTypes.sol";

/// @notice docs/03 section 8 and docs/09 section 5: the worked example, every number of both branches, with the real
/// `ReputationRegistry` and the real `ERC2771Forwarder` fixture. One base, four concrete runs: C = 100 USDC and the
/// scaled C = 10 USDC of the Fuji demo (every amount divided by 10), each with the real timings (P = D = 30 days,
/// commit 28 days, reveal 1 day, grace 48 hours) and the demo timings (D = 180 s, windows 90 / 60 s, grace 120 s).
/// @dev Amounts in this file are written in micro-USDC AT C = 100 (as in the docs) and scaled by `_v`, which reverts
/// if the scaling is not exact. The ledger identity (INV-01) and USDC conservation are checked after every step.
/// Nobody bids in rounds 3 to 5, so the winner is the smallest live `joinIndex` (docs/09 section 5).
abstract contract WorkedExampleBase is CircleScenario {
    ReputationRegistry internal registry;
    /// @dev C in base units.
    uint256 internal cU;
    uint256[5] internal _bal;
    uint256 internal _inflow;
    uint256 internal _outflow;
    address internal stranger = makeAddr("stranger");

    function _cUsdc() internal pure virtual returns (uint256);

    function _realTimings() internal pure virtual returns (bool);

    function setUp() public virtual override {
        super.setUp(); // a C = 100 demo circle on the fixture factory; kept only in the conservation accounting
        cU = _cUsdc() * U;
        registry = new ReputationRegistry(admin);
        cfg.reputation = address(registry);
        factory = new HuiFactory(admin, address(impl), cfg);
        vm.prank(admin);
        registry.setFactory(address(factory));

        CircleParams memory p = _params();
        p.contribution = uint96(cU);
        if (_realTimings()) {
            p.roundDuration = 30 days;
            p.commitWindow = 28 days;
            p.revealWindow = 1 days;
            p.graceSeconds = 2 days;
        }
        _newCircle(p, _v(480 * U));
    }

    // ------------------------------------------------------------------ scaling and timing helpers

    /// @dev `at100` micro-USDC at C = 100 scaled to the C of this run; reverts if the result is not exact.
    function _v(uint256 at100) internal view returns (uint256 r) {
        r = at100 * cU;
        require(r % (100 * U) == 0, "scale inexact");
        r /= 100 * U;
    }

    /// @dev docs/03 section 8 table of `maxBid(k)` with L_k = N - k, floor, at C = 100 and C = 10.
    function _maxBidDocs(uint32 k) internal pure returns (uint256) {
        uint256[5] memory c100 = [uint256(6_575_342), 4_931_506, 3_287_671, 1_643_835, 0];
        uint256[5] memory c10 = [uint256(657_534), 493_150, 328_767, 164_383, 0];
        return _cUsdc() == 100 ? c100[k - 1] : c10[k - 1];
    }

    /// @dev Late fee M4 owes for one nominal day on the 80 + 20 parts of its round 2 shortfall, rounded down per part
    /// (docs/03 section 6.8). The docs write the whole-amount value 0.027397 at C = 100.
    function _lateFeeM4() internal pure returns (uint256) {
        return _cUsdc() == 100 ? 27_396 : 2_738;
    }

    /// @dev One nominal day in seconds at the clock of this run (86_400 real, 6 at the demo clock).
    function _oneDay() internal view returns (uint256) {
        CircleParams memory p = c.params();
        return uint256(1 days) * p.roundDuration / p.periodSeconds;
    }

    function _graceEndW(uint32 r) internal view returns (uint256) {
        return uint256(c.roundInfo(r).settledAt) + c.params().graceSeconds;
    }

    function _toRevealW() internal {
        vm.warp(c.roundStart(c.currentRound()) + c.params().commitWindow);
    }

    function _snap() internal {
        for (uint256 i = 0; i < 5; i++) {
            _bal[i] = usdc.balanceOf(_M(i + 1));
        }
    }

    /// @dev Balance change of M`i` since `_snap`.
    function _d(uint256 i) internal view returns (int256) {
        return int256(usdc.balanceOf(_M(i))) - int256(_bal[i - 1]);
    }

    function _step() internal view {
        _assertLedger();
        _assertConserved();
    }

    function _expectPull(uint32 k, address m, uint256 amt) internal {
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ContributionPulled(k, m, _v(amt));
    }

    function _expectSettled(
        uint32 k,
        address w,
        uint256 bid,
        uint256 pot,
        uint256 payout,
        uint256 h,
        uint256 fee,
        uint256 prem
    ) internal {
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.RoundSettled(k, w, _v(bid), _v(pot), _v(payout), _v(h), _v(fee), _v(prem), 0);
    }

    function _hadShortfall(uint32 k) internal view returns (bool) {
        for (uint256 i = 1; i <= 5; i++) {
            if (c.shortfallOf(k, _M(i)).amount != 0) return true;
        }
        return false;
    }

    /// @dev Every number of the round record, INV-03 (bid within the docs table and below C), INV-05, and the
    /// scenario's "nobody is short-changed" (INV-08).
    function _assertRound(
        uint32 k,
        address w,
        uint256 bid,
        uint256 pot,
        uint256 fee,
        uint256 prem,
        uint256 h,
        uint256 payout
    ) internal view {
        RoundInfo memory ri = c.roundInfo(k);
        assertTrue(ri.settled, "settled");
        assertEq(ri.winner, w, "winner");
        assertEq(ri.winningBid, _v(bid), "bid");
        assertEq(ri.pot, _v(pot), "pot");
        assertEq(ri.fee, _v(fee), "fee");
        assertEq(ri.premium, _v(prem), "premium");
        assertEq(ri.holdback, _v(h), "H");
        assertEq(ri.payout, _v(payout), "payout");
        assertEq(ri.uncovered, 0, "INV-08 uncovered");
        assertEq(uint256(ri.payout) + ri.fee + ri.premium + ri.holdback, ri.pot, "INV-05");
        assertLe(ri.winningBid, _maxBidDocs(k), "INV-03 cap");
        assertLt(ri.winningBid, cU, "INV-03 b < C");
        // v1.2: a round without any shortfall paid its fee to the organizer at once; the others hold it in escrow.
        assertEq(c.feeEscrow(k), (ri.feeForfeited || !_hadShortfall(k)) ? 0 : ri.fee, "fee escrow of the round");
        assertEq(c.currentRound(), k == 5 ? 5 : k + 1);
        assertEq(c.settledRounds(), k);
    }

    // ------------------------------------------------------------------ before round 1

    function _checkSetup() internal view {
        assertEq(uint8(c.state()), uint8(CircleState.Active));
        assertEq(c.requiredAllowance(), _v(404 * U), "allowance = (N-1)(C + revealBond)");
        assertEq(c.revealBond(), _v(1 * U), "reveal bond 1% of C");
        assertEq(c.guaranteedCoverageBps(), 10_000, "CI = 20% + 480/600 = 100%");
        assertEq(c.coverageIndexBps(), 10_000);
        assertEq(c.maxExposure(), _v(600 * U), "O_max");
        assertEq(c.exposure(1), _v(400 * U));
        assertEq(c.exposure(2), _v(600 * U));
        assertEq(c.exposure(3), _v(600 * U));
        assertEq(c.exposure(4), _v(400 * U));
        assertEq(c.bondRemaining(), _v(480 * U));
        assertEq(c.liveCount(), 5);
        address[] memory ms = c.members();
        assertEq(ms.length, 5);
        for (uint256 i = 1; i <= 5; i++) {
            assertEq(ms[i - 1], _M(i), "join order");
            assertEq(c.memberInfo(_M(i)).joinIndex, i - 1);
        }
        for (uint32 k = 1; k <= 5; k++) {
            assertEq(HuiMath.maxBid(2000, 5, k, cU, 30 days, 5 - k), _maxBidDocs(k), "maxBid table (docs/03 section 8)");
        }
        assertEq(c.maxBid(1), _maxBidDocs(1), "view follows the live count before the first commit");
        assertEq(factory.activeCirclesOf(organizer), 1);
        _step();
    }

    // ------------------------------------------------------------------ round 1: M2 bids 4, M4 bids 6

    function _wxRound1() internal {
        _commit(_M(2), _v(4 * U));
        _commit(_M(4), _v(6 * U));
        assertEq(c.revealBondsHeld(), 2 * _v(1 * U));
        _step();
        _toRevealW();
        _reveal(_M(2), _v(4 * U));
        _reveal(_M(4), _v(6 * U));
        assertEq(c.revealBondsHeld(), 0, "bonds returned on reveal");
        _step();

        _snap();
        _toDeadline();
        _expectPull(1, _M(1), 94 * U);
        _expectPull(1, _M(2), 94 * U);
        _expectPull(1, _M(3), 94 * U);
        _expectPull(1, _M(5), 94 * U);
        _expectSettled(1, _M(4), 6 * U, 376 * U, 288_480_000, 80 * U, 3_760_000, 3_760_000);
        c.settleRound();

        _assertRound(1, _M(4), 6 * U, 376 * U, 3_760_000, 3_760_000, 80 * U, 288_480_000);
        assertEq(_d(4), int256(_v(288_480_000)), "M4 receives 288.48");
        assertEq(_d(1), -int256(_v(94 * U)));
        assertEq(_d(2), -int256(_v(94 * U)));
        assertEq(_d(3), -int256(_v(94 * U)));
        assertEq(_d(5), -int256(_v(94 * U)));
        assertEq(c.memberInfo(_M(4)).holdback, _v(80 * U), "H = 20% x 4 x C");
        assertEq(c.totalHoldback(), _v(80 * U));
        assertEq(c.reserve(), _v(3_760_000));
        assertEq(c.totalFeeEscrow(), 0, "round 1 had no shortfall: the fee went to the organizer at once");
        assertEq(usdc.balanceOf(organizer), _v(3_760_000), "organizer holds the fee of round 1");
        assertEq(c.bondRemaining(), _v(480 * U));
        assertEq(usdc.balanceOf(address(c)), _v(480 * U + 80 * U + 3_760_000));
        _step();
    }

    // ------------------------------------------------------------------ round 2: M1 wins with 3, M4 cannot pay

    function _wxRound2() internal {
        assertEq(c.maxBid(2), _maxBidDocs(2));
        _commit(_M(1), _v(3 * U));
        _commit(_M(2), _v(3 * U));
        assertLt(c.commitOf(2, _M(1)).commitIndex, c.commitOf(2, _M(2)).commitIndex, "M1 commits first");
        assertEq(c.maxBid(2), _maxBidDocs(2), "cap locked at the first commit");
        _toRevealW();
        _reveal(_M(1), _v(3 * U));
        _reveal(_M(2), _v(3 * U));
        _step();

        _block(_M(4));
        _snap();
        _toDeadline();
        _expectPull(2, _M(2), 97 * U);
        _expectPull(2, _M(3), 97 * U);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ContributionShortfall(2, _M(4), _v(100 * U));
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallCovered(2, _M(4), CoverSource.Holdback, _v(80 * U));
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallCovered(2, _M(4), CoverSource.Bond, _v(20 * U));
        _expectPull(2, _M(5), 97 * U);
        _expectSettled(2, _M(1), 3 * U, 391 * U, 323_180_000, 60 * U, 3_910_000, 3_910_000);
        c.settleRound();

        _assertRound(2, _M(1), 3 * U, 391 * U, 3_910_000, 3_910_000, 60 * U, 323_180_000);
        assertEq(_d(1), int256(_v(323_180_000)), "M1 receives 323.18");
        assertEq(_d(2), -int256(_v(97 * U)));
        assertEq(_d(3), -int256(_v(97 * U)));
        assertEq(_d(4), 0, "M4 pulled nothing");
        assertEq(_d(5), -int256(_v(97 * U)));

        Shortfall memory sf = c.shortfallOf(2, _M(4));
        assertEq(sf.amount, _v(100 * U));
        assertEq(sf.fromHoldback, _v(80 * U), "80 from M4's own holdback");
        assertEq(sf.fromBond, _v(20 * U), "20 from the bond");
        assertEq(sf.fromReserve, 0);
        assertEq(sf.uncovered, 0);
        assertEq(sf.since, c.roundInfo(2).settledAt);
        assertFalse(sf.resolved);
        MemberInfo memory m4 = c.memberInfo(_M(4));
        assertEq(m4.holdback, 0);
        assertEq(m4.debt, _v(100 * U));
        assertEq(m4.lateCount, 1);
        assertTrue(m4.received);
        assertFalse(m4.defaulted);

        assertEq(c.bondRemaining(), _v(460 * U), "bond 480 - 20");
        assertEq(c.reserve(), _v(7_670_000), "3.76 + 3.91");
        assertEq(c.totalFeeEscrow(), _v(3_910_000));
        assertEq(c.memberInfo(_M(1)).holdback, _v(60 * U), "H = 20% x 3 x C");
        assertEq(c.totalHoldback(), _v(60 * U));
        assertEq(registry.reputationOf(_M(4)).late, 1);
        _step();
    }

    // ------------------------------------------------------------------ rounds 3-5, nobody bids

    /// @dev One no-bid round of docs/09 section 5: pull 400 (300 when the defaulted M4 is covered by the bond), fee 4,
    /// premium 4, H = 20 (5 - k) C / 100, payout 392 - H, and 20 released to every dead member who paid.
    function _noBidRound(uint32 k, bool m4Defaulted) internal {
        address w = k == 3 ? _M(2) : (k == 4 ? _M(3) : _M(5));
        uint256 h = 20 * U * (5 - k);
        assertEq(c.maxBid(k), _maxBidDocs(k), "cap = N - k payers");
        bool[5] memory dead;
        for (uint256 i = 1; i <= 5; i++) {
            MemberInfo memory mi = c.memberInfo(_M(i));
            dead[i - 1] = mi.received && !mi.defaulted;
        }
        _snap();
        uint256 bondBefore = c.bondRemaining();
        uint256 reserveBefore = c.reserve();
        _toDeadline();
        for (uint256 i = 1; i <= 5; i++) {
            address m = _M(i);
            if (m == w) continue;
            if (m4Defaulted && i == 4) {
                vm.expectEmit(true, true, false, true, address(c));
                emit IHuiCircle.ContributionShortfall(k, m, _v(100 * U));
                vm.expectEmit(true, true, false, true, address(c));
                emit IHuiCircle.ShortfallCovered(k, m, CoverSource.Bond, _v(100 * U));
                continue;
            }
            _expectPull(k, m, 100 * U);
            if (dead[i - 1]) {
                vm.expectEmit(true, true, false, true, address(c));
                emit IHuiCircle.HoldbackReleased(m, k, _v(20 * U));
            }
        }
        _expectSettled(k, w, 0, 400 * U, 392 * U - h, h, 4 * U, 4 * U);
        _drain();
        c.settleRound();
        uint256 released = _count(_drain(), IHuiCircle.HoldbackReleased.selector);

        _assertRound(k, w, 0, 400 * U, 4 * U, 4 * U, h, 392 * U - h);
        uint256 holders;
        for (uint256 i = 1; i <= 5; i++) {
            address m = _M(i);
            MemberInfo memory mi = c.memberInfo(m);
            if (m == w) {
                assertEq(_d(i), int256(_v(392 * U - h)), "winner payout");
            } else if (m4Defaulted && i == 4) {
                assertEq(_d(i), 0, "defaulted M4 pays nothing");
            } else if (dead[i - 1]) {
                assertEq(_d(i), -int256(_v(80 * U)), "dead member: pays 100, gets 20 back");
            } else {
                assertEq(_d(i), -int256(_v(100 * U)), "live member pays C");
            }
            // INV-06 with equality: every dead non-defaulted member holds alpha (N - m) C.
            if (mi.received && !mi.defaulted) {
                assertEq(mi.holdback, _v(20 * U * (5 - k)), "INV-06 holdback = alpha (N - m) C");
                holders++;
            }
        }
        assertEq(released, m4Defaulted ? k - 2 : k - 1, "one release per dead member who paid");
        assertEq(c.totalHoldback(), holders * _v(20 * U * (5 - k)));
        if (!m4Defaulted) {
            assertEq(c.totalHoldback(), 2000 * c.exposure(k) / 10_000, "total holdback = alpha O(m)");
        }
        assertEq(c.reserve(), reserveBefore + _v(4 * U));
        if (m4Defaulted) {
            assertEq(c.bondRemaining(), bondBefore - _v(100 * U), "the bond covers M4's 100");
            Shortfall memory sf = c.shortfallOf(k, _M(4));
            assertEq(sf.amount, _v(100 * U));
            assertEq(sf.fromBond, _v(100 * U));
            assertEq(sf.uncovered, 0);
        } else {
            assertEq(c.bondRemaining(), bondBefore);
        }
        _step();
    }

    // ------------------------------------------------------------------ in / out of the whole circle

    /// @dev Reads the logs recorded since the last drain, adds the USDC moved into and out of the circle to the
    /// running totals, and returns them. Recording is started once, at the top of each branch test.
    function _drain() internal returns (Vm.Log[] memory logs) {
        logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("Transfer(address,address,uint256)");
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != address(usdc) || logs[i].topics[0] != sig) continue;
            address from = address(uint160(uint256(logs[i].topics[1])));
            address to = address(uint160(uint256(logs[i].topics[2])));
            uint256 amt = abi.decode(logs[i].data, (uint256));
            if (to == address(c)) _inflow += amt;
            if (from == address(c)) _outflow += amt;
        }
    }

    /// @dev Total in (the bond, deposited before recording, included) and out of the circle.
    function _inOut() internal returns (uint256 inflow, uint256 outflow) {
        _drain();
        return (_inflow + _v(480 * U), _outflow);
    }

    function _assertEverybodyReceivedOnce() internal view {
        uint8[5] memory expectedRound = [uint8(2), 3, 4, 1, 5]; // M1..M5
        for (uint256 i = 1; i <= 5; i++) {
            MemberInfo memory mi = c.memberInfo(_M(i));
            assertTrue(mi.received, "INV-02 everybody received");
            assertEq(mi.receivedRound, expectedRound[i - 1], "INV-02 one winner per round");
        }
        for (uint32 k = 1; k <= 5; k++) {
            assertTrue(c.roundInfo(k).settled);
        }
    }

    // ================================================================== Branch A: M4 pays late inside the grace

    function test_WorkedExample_BranchA_PayLate() public {
        vm.recordLogs();
        _checkSetup();
        _wxRound1();
        _wxRound2();

        // --- payLate(2) after one nominal day
        uint256 fee = _lateFeeM4();
        {
            // The fee is one rounded-down fee per part (80 and 20), and equals the docs' 0.027397 within a unit each.
            uint256 perPart = HuiMath.lateFee(_v(80 * U), 1000, _oneDay(), 30 days, c.params().roundDuration)
                + HuiMath.lateFee(_v(20 * U), 1000, _oneDay(), 30 days, c.params().roundDuration);
            assertEq(perPart, fee, "late fee per part");
            uint256 docsValue = cU / 3650; // C x 10% x 1/365 (docs/03 section 8)
            assertLe(fee, docsValue);
            assertGe(fee + 2, docsValue, "within rounding of 0.027397 x C / 100");
        }
        vm.warp(uint256(c.roundInfo(2).settledAt) + _oneDay());
        _unblock(_M(4));
        _snap();
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, _M(4), CoverSource.Bond, _v(20 * U));
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.ShortfallRestored(2, _M(4), CoverSource.Holdback, _v(80 * U));
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.LatePaid(2, _M(4), _v(100 * U), fee);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.HoldbackReleased(_M(4), 2, _v(20 * U));
        vm.prank(_M(4));
        c.payLate(2);

        assertEq(_d(4), -int256(_v(100 * U) + fee) + int256(_v(20 * U)), "M4 pays 100 + fee, gets 20 released");
        assertEq(c.bondRemaining(), _v(480 * U), "bond back to 480");
        assertEq(c.memberInfo(_M(4)).holdback, _v(60 * U), "80 restored, 20 released: as if paid on time");
        assertEq(c.memberInfo(_M(1)).holdback, _v(60 * U));
        assertEq(c.totalHoldback(), _v(120 * U), "60 + 60 = alpha O(2)");
        assertEq(c.totalHoldback(), 2000 * c.exposure(2) / 10_000, "INV-06 restored");
        assertEq(c.reserve(), _v(7_670_000) + fee, "7.67 + late fee");
        assertEq(c.memberInfo(_M(4)).debt, 0);
        Shortfall memory sf = c.shortfallOf(2, _M(4));
        assertTrue(sf.resolved);
        assertEq(uint256(sf.uncovered) + sf.fromReserve + sf.fromBond + sf.fromHoldback, 0);
        assertEq(sf.amount, _v(100 * U), "original amount is kept");
        assertEq(registry.reputationOf(_M(4)).late, 1, "lateness was recorded when the round settled");
        assertEq(registry.reputationOf(_M(4)).defaults, 0);
        _step();

        vm.expectRevert(IHuiCircle.NoShortfall.selector);
        vm.prank(_M(4));
        c.payLate(2); // the 20 cannot be released twice

        // --- rounds 3-5
        _noBidRound(3, false);
        _noBidRound(4, false);
        _noBidRound(5, false);
        assertEq(c.totalHoldback(), 0);
        assertEq(c.bondRemaining(), _v(480 * U));
        assertEq(c.reserve(), _v(7_670_000) + fee + _v(12 * U));
        // v1.2: rounds 1, 3, 4, 5 had no shortfall and paid 3.76 + 12 to the organizer at once; round 2 waits in escrow.
        assertEq(c.totalFeeEscrow(), _v(3_910_000), "only the fee of round 2 (3.91) is still in escrow");
        assertEq(usdc.balanceOf(organizer), _v(3_760_000) + _v(12 * U), "organizer already holds the fees of rounds 1, 3, 4, 5");
        _assertEverybodyReceivedOnce();

        // --- finalize
        uint256 reserveFinal = _v(19_670_000) + fee;
        // ADR-24 / vector V1: weights M1 4, M2 4, M3 4, M4 3 (late once), M5 4; sum 19; dust to M1.
        uint256[5] memory wt = [uint256(4), 4, 4, 3, 4];
        uint256[5] memory shares;
        uint256 paidOut;
        for (uint256 i = 0; i < 5; i++) {
            shares[i] = reserveFinal * wt[i] / 19;
            paidOut += shares[i];
        }
        shares[0] += reserveFinal - paidOut;
        uint256 orgBefore = usdc.balanceOf(organizer);
        _snap();
        vm.warp(_graceEndW(5) + 1);
        _drain();
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleFinalized(_v(480 * U), _v(3_910_000), reserveFinal);
        vm.prank(stranger);
        c.finalize();
        assertEq(_count(_drain(), IHuiCircle.HoldbackReleased.selector), 0, "finalize pays 0 holdback");

        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        assertEq(usdc.balanceOf(organizer) - orgBefore, _v(480 * U) + _v(3_910_000), "bond 480 + escrowed fee 3.91");
        for (uint256 i = 1; i <= 5; i++) {
            assertEq(_d(i), int256(shares[i - 1]), "reserve shared by on-time weight, dust to M1");
            Reputation memory r = registry.reputationOf(_M(i));
            assertEq(r.completed, 1);
            assertEq(r.defaults, 0);
        }
        assertEq(registry.reputationOf(_M(4)).late, 1);
        assertEq(usdc.balanceOf(address(c)), 0, "contract empties");
        assertEq(c.bondRemaining() + c.reserve() + c.totalHoldback() + c.totalFeeEscrow() + c.totalClaimable(), 0);
        assertEq(factory.activeCirclesOf(organizer), 0);
        _step();

        (uint256 inflow, uint256 outflow) = _inOut();
        assertEq(inflow, outflow, "in == out");
        // docs/09: in = 2,447.027397 (round-up of the fee); here the fee is the per-part one. 4 reveal bonds pass through.
        assertEq(inflow, _v(2_447 * U) + fee + 4 * _v(1 * U), "2,447 + late fee + 4 reveal bonds");
    }

    // ================================================================== Branch B: M4 never pays

    function test_WorkedExample_BranchB_MarkDefault() public {
        vm.recordLogs();
        _checkSetup();
        _wxRound1();
        _wxRound2();

        // --- markDefault after the grace period
        uint256 ge = _graceEndW(2);
        vm.warp(ge);
        vm.expectRevert(IHuiCircle.GraceNotOver.selector);
        c.markDefault(_M(4));
        vm.warp(ge + 1);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.FeeForfeited(2, _v(3_910_000));
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.MemberDefaulted(_M(4), 2, false);
        vm.prank(stranger);
        c.markDefault(_M(4));

        assertEq(c.reserve(), _v(11_580_000), "7.67 + forfeited 3.91");
        assertEq(c.feeEscrow(2), 0);
        assertTrue(c.roundInfo(2).feeForfeited);
        assertEq(c.totalFeeEscrow(), 0, "round 1 was paid at once, round 2 was forfeited");
        MemberInfo memory m4 = c.memberInfo(_M(4));
        assertTrue(m4.defaulted);
        assertTrue(m4.received, "DefaultedDead");
        assertEq(registry.reputationOf(_M(4)).defaults, 1);
        assertEq(c.bondRemaining(), _v(460 * U));
        _step();
        vm.expectRevert(IHuiCircle.AlreadyDefaulted.selector);
        c.markDefault(_M(4));

        // --- rounds 3-5: the bond pays M4's 100 each time, bond 460 -> 360 -> 260 -> 160
        _noBidRound(3, true);
        assertEq(c.bondRemaining(), _v(360 * U));
        _noBidRound(4, true);
        assertEq(c.bondRemaining(), _v(260 * U));
        _noBidRound(5, true);
        assertEq(c.bondRemaining(), _v(160 * U));
        assertEq(c.reserve(), _v(23_580_000), "11.58 + 3 x 4");
        assertEq(c.totalFeeEscrow(), _v(12 * U), "fees of rounds 3, 4, 5 (M4's shortfalls); round 1 was paid at once");
        assertEq(c.totalHoldback(), 0);
        _assertEverybodyReceivedOnce();

        // --- M4 caused 4 x 100 = 400: 80 from its own holdback, 320 from the bond; nobody short-changed
        uint256 fromHoldback;
        uint256 fromBond;
        uint256 total;
        for (uint32 r = 1; r <= 5; r++) {
            Shortfall memory sf = c.shortfallOf(r, _M(4));
            fromHoldback += sf.fromHoldback;
            fromBond += sf.fromBond;
            total += sf.amount;
            assertEq(sf.uncovered, 0, "uncovered == 0 every round");
        }
        assertEq(total, _v(400 * U));
        assertEq(fromHoldback, _v(80 * U));
        assertEq(fromBond, _v(320 * U));
        assertEq(c.memberInfo(_M(4)).debt, _v(400 * U));

        // --- finalize
        uint256 orgBefore = usdc.balanceOf(organizer);
        _snap();
        vm.warp(_graceEndW(5) + 1);
        _drain();
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleFinalized(_v(160 * U), _v(12 * U), _v(23_580_000));
        vm.prank(stranger);
        c.finalize();
        assertEq(_count(_drain(), IHuiCircle.HoldbackReleased.selector), 0);

        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        assertEq(usdc.balanceOf(organizer) - orgBefore, _v(160 * U) + _v(12 * U), "bond 160 + escrowed fees 12");
        for (uint256 i = 1; i <= 5; i++) {
            assertEq(_d(i), i == 4 ? int256(0) : int256(_v(5_895_000)), "5.895 each to M1, M2, M3, M5");
            Reputation memory r = registry.reputationOf(_M(i));
            assertEq(r.completed, i == 4 ? 0 : 1);
            assertEq(r.defaults, i == 4 ? 1 : 0);
        }
        assertEq(registry.reputationOf(_M(4)).late, 1);
        // Own-holdback part of M4's debt is forgiven at finalize (docs/03 section 5.3 step 2); the rest stays owed.
        assertEq(c.shortfallOf(2, _M(4)).fromHoldback, 0);
        assertEq(c.shortfallOf(2, _M(4)).fromBond, _v(20 * U));
        assertEq(c.memberInfo(_M(4)).debt, _v(320 * U));
        assertEq(usdc.balanceOf(address(c)), 0);
        assertEq(c.bondRemaining() + c.reserve() + c.totalHoldback() + c.totalFeeEscrow() + c.totalClaimable(), 0);
        assertEq(factory.activeCirclesOf(organizer), 0);
        _step();

        (uint256 inflow, uint256 outflow) = _inOut();
        assertEq(inflow, outflow, "in == out");
        assertEq(inflow, _v(2_047 * U) + 4 * _v(1 * U), "2,047 + 4 reveal bonds");
    }
}

contract WorkedExampleC100RealTimingTest is WorkedExampleBase {
    function _cUsdc() internal pure override returns (uint256) {
        return 100;
    }

    function _realTimings() internal pure override returns (bool) {
        return true;
    }
}

contract WorkedExampleC100DemoTimingTest is WorkedExampleBase {
    function _cUsdc() internal pure override returns (uint256) {
        return 100;
    }

    function _realTimings() internal pure override returns (bool) {
        return false;
    }
}

/// @dev The Fuji demo circle: C = 10 USDC, bond 48, M4 receives 28.848, M1 32.318, bond 16 in branch B.
contract WorkedExampleC10RealTimingTest is WorkedExampleBase {
    function _cUsdc() internal pure override returns (uint256) {
        return 10;
    }

    function _realTimings() internal pure override returns (bool) {
        return true;
    }
}

contract WorkedExampleC10DemoTimingTest is WorkedExampleBase {
    function _cUsdc() internal pure override returns (uint256) {
        return 10;
    }

    function _realTimings() internal pure override returns (bool) {
        return false;
    }
}
