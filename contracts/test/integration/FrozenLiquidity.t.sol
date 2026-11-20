// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CircleScenario} from "../utils/CircleScenario.sol";
import {CircleState, MemberInfo} from "../../src/libraries/HuiTypes.sol";

/// @notice docs/03 section 7.3 and the edge-case table of section 9: members who default BEFORE they receive
/// (Frozen) only borrow the bond's liquidity, they cause no net loss. Two members freeze in the same round, the bond
/// fronts their shares while the circle runs, each Frozen member repays from its own pot (section 6.6), and at
/// `finalize` the organizer gets the whole bond back. Driven through the public entry points, checking the ledger
/// (INV-01) and USDC conservation after every step.
contract FrozenLiquidityTest is CircleScenario {
    uint256 internal constant BOND = 480 * U;

    /// @dev Rounds 1 and 2 nobody bids, so M1 then M2 win with b = 0. In round 2 the two given live members cannot
    /// pay; once their grace is over both are marked defaulted and become Frozen.
    function _freezeTwoInRound2(address a, address b) internal {
        _settle(); // round 1: M1
        _block(a);
        _block(b);
        _settle(); // round 2: M2, a and b short 100 each, covered by the bond (they have no holdback)
        assertEq(c.roundInfo(2).uncovered, 0, "bond covers both shortfalls");
        assertEq(c.bondRemaining(), BOND - 200 * U, "bond fronted 200");
        vm.warp(_graceEnd(2) + 1);
        c.markDefault(a);
        c.markDefault(b);
        assertTrue(c.memberInfo(a).defaulted && !c.memberInfo(a).received, "a Frozen");
        assertTrue(c.memberInfo(b).defaulted && !c.memberInfo(b).received, "b Frozen");
        _assertLedger();
        _assertConserved();
    }

    /// @dev A round may leave a small `uncovered` part only when its winner is itself a Frozen member (bond and
    /// reserve ran low while fronting); that part is paid to that winner when the debtor repays (section 6.8). Honest
    /// winners are always paid in full, and by the end every shortfall of both Frozen members is closed.
    function _assertHonestWinnersPaidAndAllShortfallsClosed(address a, address b) internal view {
        for (uint32 k = 1; k <= 5; k++) {
            address w = c.roundInfo(k).winner;
            if (w != a && w != b) assertEq(c.roundInfo(k).uncovered, 0, "no honest winner was short-paid");
            assertTrue(c.shortfallOf(k, a).amount == 0 || c.shortfallOf(k, a).resolved, "a: shortfall closed");
            assertTrue(c.shortfallOf(k, b).amount == 0 || c.shortfallOf(k, b).resolved, "b: shortfall closed");
        }
        assertEq(c.memberInfo(a).debt, 0);
        assertEq(c.memberInfo(b).debt, 0);
    }

    function test_TwoFrozenInOneRound_BondOnlyFrontsLiquidity_FinalizeReturnsAllOfIt() public {
        address m4 = _M(4);
        address m5 = _M(5);
        _freezeTwoInRound2(m4, m5);

        // Round 3: M3 is the only live member and wins. Frozen members are not pulled: 100 each again from the bond.
        _settle();
        assertEq(c.roundInfo(3).winner, _M(3));
        assertEq(c.memberInfo(m4).debt, 200 * U);
        assertEq(c.memberInfo(m5).debt, 200 * U);
        _assertLedger();

        // Round 4: no live member left, so the Frozen member with the smallest joinIndex (M4) wins, gets no
        // holdback and repays its whole debt from its pot before receiving the rest (section 6.6).
        uint256 m4Before = usdc.balanceOf(m4);
        _settle();
        assertEq(c.roundInfo(4).winner, m4, "smallest Frozen joinIndex wins");
        assertEq(c.roundInfo(4).holdback, 0, "Frozen winner has no holdback");
        assertEq(c.memberInfo(m4).debt, 0, "M4 repaid everything from its pot");
        assertGt(usdc.balanceOf(m4), m4Before, "and still received the rest");
        _assertLedger();
        _assertConserved();

        // M4 is now DefaultedDead and owes C per round; it pays round 5 on time.
        _unblock(m4);

        // Round 5: M5 (last Frozen) wins and repays from its pot too.
        _settle();
        assertEq(c.roundInfo(5).winner, m5);
        assertEq(c.memberInfo(m5).debt, 0, "M5 repaid everything from its pot");
        _assertHonestWinnersPaidAndAllShortfallsClosed(m4, m5);
        assertEq(c.bondRemaining(), BOND, "every unit the bond fronted came back");
        _assertLedger();

        // Finalize: the organizer gets the whole bond back; nobody is left owing anything.
        vm.warp(_graceEnd(5) + 1);
        uint256 orgBefore = usdc.balanceOf(organizer);
        c.finalize();
        assertEq(uint256(c.state()), uint256(CircleState.Completed));
        assertGe(usdc.balanceOf(organizer) - orgBefore, BOND, "organizer recovers at least the full bond");
        assertEq(c.bondRemaining(), 0);
        assertEq(c.reserve(), 0, "reserve fully shared");
        assertEq(usdc.balanceOf(address(c)), c.totalClaimable(), "nothing stuck in the circle");
        _assertLedger();
        _assertConserved();
    }

    /// @dev Same story for any pair of members who have not received by round 2 (M3, M4, M5), any order.
    function testFuzz_AnyTwoFrozen_NoNetLoss(uint8 seedA, uint8 seedB) public {
        uint256 i = 3 + (uint256(seedA) % 3);
        uint256 j = 3 + (uint256(seedB) % 3);
        vm.assume(i != j);
        address a = _M(i);
        address b = _M(j);
        _freezeTwoInRound2(a, b);

        for (uint32 k = 3; k <= 5; k++) {
            _settle();
            address w = c.roundInfo(k).winner;
            MemberInfo memory wi = c.memberInfo(w);
            if (wi.defaulted) {
                assertEq(wi.debt, 0, "a Frozen winner leaves with no debt");
                _unblock(w); // DefaultedDead from here on, pays on time
            }
            _assertLedger();
            _assertConserved();
        }
        _assertHonestWinnersPaidAndAllShortfallsClosed(a, b);
        assertEq(c.bondRemaining(), BOND, "bond fully restored");
        vm.warp(_graceEnd(5) + 1);
        c.finalize();
        assertEq(usdc.balanceOf(address(c)), c.totalClaimable(), "nothing stuck in the circle");
        _assertConserved();
    }
}
