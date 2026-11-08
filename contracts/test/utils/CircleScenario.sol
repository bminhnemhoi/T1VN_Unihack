// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {CircleFixture} from "./CircleFixture.sol";
import {HuiCircleHarness} from "./HuiCircleHarness.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";
import {CircleParams, Shortfall} from "../../src/libraries/HuiTypes.sol";

/// @notice Shared driver for the C7 suites (late payment, finalize, emergency): the docs/03 section 8 circle
/// (N = 5, C = 100 USDC, alpha 20%, bond 480, fee 1%, reserve 1%, reveal bond 1 USDC, round 180 s, grace 120 s)
/// with helpers to bid, settle, block a wallet's allowance, and to check the ledger identity (INV-01).
/// `_M(1)..._M(5)` are the members in join order (M1..M5 of the spec).
abstract contract CircleScenario is CircleFixture {
    HuiCircleHarness internal c;
    uint256 internal t0;
    /// @dev Circles replaced by `_newCircle`; their USDC still counts when checking conservation.
    address[] internal _otherCircles;
    uint256 internal constant U = 1e6;
    uint256 internal constant GRACE = 120;
    uint256 internal constant ROUND = 180;

    function setUp() public virtual override {
        super.setUp();
        c = _workedExample();
        t0 = _now();
    }

    // ------------------------------------------------------------------ members and clock

    /// @dev `block.timestamp` can be cached by the via-IR optimizer across `vm.warp`; the cheatcode cannot.
    function _now() internal view returns (uint256) {
        return vm.getBlockTimestamp();
    }

    function _M(uint256 i) internal view returns (address) {
        return actors[i - 1];
    }

    function _toReveal() internal {
        vm.warp(c.roundStart(c.currentRound()) + 90);
    }

    function _toDeadline() internal {
        vm.warp(c.deadline(c.currentRound()));
    }

    /// @dev End of the grace period of round `r` when the circle was never paused: settledAt + G.
    function _graceEnd(uint32 r) internal view returns (uint256) {
        return uint256(c.roundInfo(r).settledAt) + GRACE;
    }

    // ------------------------------------------------------------------ bidding and settling

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

    function _settle() internal {
        _toDeadline();
        c.settleRound();
    }

    /// @dev Settle rounds `from..to` with nobody bidding (winner = smallest live joinIndex, b = 0).
    function _settleRounds(uint32 from, uint32 to) internal {
        for (uint32 k = from; k <= to; k++) {
            assertEq(c.currentRound(), k, "scenario out of sync");
            _settle();
        }
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

    /// @dev docs/03 section 8 round 1: M2 bids 4, M4 bids 6, M4 wins (pot 376, M4 nets 288.48, holds back 80).
    function _round1() internal {
        _commit(_M(2), 4 * U);
        _commit(_M(4), 6 * U);
        _toReveal();
        _reveal(_M(2), 4 * U);
        _reveal(_M(4), 6 * U);
        _settle();
    }

    /// @dev docs/03 section 8 round 2 bids: M1 and M2 both bid 3, M1 commits first and wins. Call after `_round1`.
    function _round2Bids() internal {
        _commit(_M(1), 3 * U);
        _commit(_M(2), 3 * U);
        _toReveal();
        _reveal(_M(1), 3 * U);
        _reveal(_M(2), 3 * U);
    }

    /// @dev Rounds 1 and 2 of the worked example with M4 unable to pay in round 2: M4's shortfall of 100 is covered
    /// 80 from its holdback and 20 from the bond (bond 460). M4's allowance stays revoked.
    function _m4FailsRound2() internal {
        _round1();
        _round2Bids();
        _block(_M(4));
        _settle();
    }

    function _newCircle(CircleParams memory p, uint256 bond) internal {
        _otherCircles.push(address(c));
        c = _active(p, bond);
        t0 = _now();
    }

    // ------------------------------------------------------------------ expectations

    /// @dev docs/03 section 2.5 for the demo clock (P = 30 days, D = 180 s): fee on `amount` after `elapsed` seconds.
    function _lateFee(uint256 amount, uint256 elapsed) internal view returns (uint256) {
        return HuiMath.lateFee(amount, c.lateRateBps(), elapsed, 30 days, 180);
    }

    /// @dev Late fee charged by `payLate` / `repayDebt` for the open parts of `sf` after `elapsed` seconds: one
    /// rounded-down fee per part (docs/03 section 6.8).
    function _feeOfParts(Shortfall memory sf, uint256 elapsed) internal view returns (uint256) {
        return _lateFee(sf.uncovered, elapsed) + _lateFee(sf.fromReserve, elapsed) + _lateFee(sf.fromBond, elapsed)
            + _lateFee(sf.fromHoldback, elapsed);
    }

    function _openPrincipal(Shortfall memory sf) internal pure returns (uint256) {
        return uint256(sf.uncovered) + sf.fromReserve + sf.fromBond + sf.fromHoldback;
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

    /// @dev Every wallet that can ever hold USDC in these tests, the circle included.
    function _sumBalances() internal view returns (uint256 sum) {
        for (uint256 i = 0; i < actors.length; i++) {
            sum += usdc.balanceOf(actors[i]);
        }
        sum += usdc.balanceOf(organizer) + usdc.balanceOf(admin) + usdc.balanceOf(address(factory))
        + usdc.balanceOf(address(c));
        for (uint256 i = 0; i < _otherCircles.length; i++) {
            sum += usdc.balanceOf(_otherCircles[i]);
        }
    }

    /// @dev No USDC was created or lost and none reached the admin or the factory (INV-07 flavour).
    function _assertConserved() internal view virtual {
        assertEq(_sumBalances(), usdc.totalSupply(), "USDC conserved");
        assertEq(usdc.balanceOf(admin), 0, "admin never receives USDC");
        assertEq(usdc.balanceOf(address(factory)), 0, "factory never receives USDC");
    }

    // ------------------------------------------------------------------ logs

    /// @dev Number of logs in `logs` whose topic0 is `sig`.
    function _count(Vm.Log[] memory logs, bytes32 sig) internal pure returns (uint256 n) {
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length != 0 && logs[i].topics[0] == sig) n++;
        }
    }
}
