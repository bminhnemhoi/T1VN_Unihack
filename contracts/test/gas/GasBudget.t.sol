// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";

import {CircleFixture} from "../utils/CircleFixture.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {HuiCircle} from "../../src/HuiCircle.sol";
import {HuiCircleLens} from "../../src/HuiCircleLens.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {ReputationRegistry} from "../../src/ReputationRegistry.sol";
import {CircleParams, CircleState, MemberAttestation, PermitSig} from "../../src/libraries/HuiTypes.sol";

/// @notice Gas budgets of docs/04 section 7.1, measured on a clone of the REAL `HuiCircle` (not the harness) created
/// by the factory, with the real `ReputationRegistry`. Each test prints its measurement (`forge test --match-path
/// "test/gas/*" -vv`).
/// @dev Method. The figure compared with a budget is the EXECUTION gas of the call, read with `gasleft()` around it
/// (what `forge snapshot` reports, which docs/04 names as the measuring tool). The accounts the call touches are
/// marked cold first with `vm.cool`. The 21,000 intrinsic gas of a transaction is NOT part of the compared figure
/// but every test also prints `tx total` (execution + 21,000) and flags it when that is above the budget. Decision A7
/// (docs/04 7.1): the budgets are EXECUTION gas, so that flag is information only.
///
/// Decisions A7 recorded in docs/04 7.1 and docs/05 section 9:
///  - `settleRound` N = 5 with four shortfalls in one round has its own budget, 800,000 (measured 746,000).
///  - `finalize` N = 30 with 29 unmarked defaulters (about 5.50 million) is outside the budget and only pinned as a
///    regression ceiling (`OBSERVED_*`); the keeper marks defaulters before calling `finalize`, which stays in budget.
/// The extreme `settleRound` N = 30 case (all 29 fail) is above the 3,000,000 table budget by documented decision
/// (docs/04 7.1 "Số đo thực"); it is asserted against the 5,000,000 cap.
contract GasBudgetTest is CircleFixture {
    // ---- docs/04 section 7.1
    uint256 internal constant BUDGET_SETTLE_N30 = 3_000_000;
    uint256 internal constant WARN_SETTLE_N30 = 2_500_000;
    uint256 internal constant BUDGET_SETTLE_N5 = 600_000;
    uint256 internal constant BUDGET_SETTLE_N5_WORST = 800_000; // 4 shortfalls, measured ~746,000 (A7: docs/04 7.1)
    uint256 internal constant BUDGET_FINALIZE_N30 = 2_500_000;
    uint256 internal constant BUDGET_JOIN = 250_000;
    uint256 internal constant BUDGET_COMMIT = 200_000; // decision Q5 (A5): keeps the reveal bond
    uint256 internal constant BUDGET_REVEAL = 100_000;
    uint256 internal constant BUDGET_CREATE = 500_000;
    // ---- docs/04 section 7.1 "Số đo thực" + docs/05 section 8.2: hard cap of relay and keeper for the extreme cases
    uint256 internal constant CAP_EXTREME = 5_000_000;
    uint256 internal constant TX_BASE = 21_000;
    // ---- outside the budget by decision (A7): keeper must `markDefault` before `finalize`; ceiling catches regressions
    uint256 internal constant OBSERVED_FINALIZE_29_UNMARKED = 5_600_000; // docs/04 7.1: not a budget, may exceed 5M

    ReputationRegistry internal registry;
    HuiCircle internal realImpl;

    function setUp() public override {
        super.setUp();
        registry = new ReputationRegistry(admin);
        realImpl = new HuiCircle(address(forwarder), address(new HuiCircleLens()));
        cfg.reputation = address(registry);
        factory = new HuiFactory(admin, address(realImpl), cfg);
        vm.prank(admin);
        registry.setFactory(address(factory));
    }

    // ================================================================== helpers

    function _n30Params() internal view returns (CircleParams memory p) {
        p = _params();
        p.memberCount = 30;
    }

    /// @dev N = 30, C = 100 USDC, bond (1 - alpha) * O_max = 18,000 USDC, all 30 joined and activated.
    function _active30() internal returns (HuiCircleHarness c) {
        c = _active(_n30Params(), 18_000 * USDC);
        assertEq(uint8(c.state()), uint8(CircleState.Active));
        assertEq(c.params().memberCount, 30);
    }

    function _cool(HuiCircleHarness c) internal {
        vm.cool(address(c));
        vm.cool(address(usdc));
        vm.cool(address(registry));
        vm.cool(address(factory));
    }

    /// @dev Execution gas of `data` sent to `target` as `from`, with the touched accounts cold. Keeps the state change.
    function _tx(HuiCircleHarness c, address from, address target, bytes memory data) internal returns (uint256 used) {
        _cool(c);
        vm.prank(from);
        uint256 before = gasleft();
        (bool ok,) = target.call(data);
        used = before - gasleft();
        assertTrue(ok, "measured call reverted");
    }

    /// @dev Prints a measurement and flags when the transaction total (with the 21,000 intrinsic gas) is above `budget`.
    function _report(string memory what, uint256 used, uint256 budget) internal pure {
        string memory line = string.concat(what, ": ", _s(used), " gas, budget ", _s(budget));
        if (used + TX_BASE > budget) {
            line = string.concat(line, " | tx total with 21.000 intrinsic: ", _s(used + TX_BASE), " ABOVE");
        }
        console.log(line);
    }

    function _s(uint256 v) internal pure returns (string memory) {
        bytes memory d = bytes(_digits(v));
        bytes memory out = new bytes(d.length + (d.length - 1) / 3);
        uint256 j = out.length;
        for (uint256 i = 0; i < d.length; i++) {
            if (i != 0 && i % 3 == 0) out[--j] = ".";
            out[--j] = d[d.length - 1 - i];
        }
        return string(out);
    }

    function _digits(uint256 v) internal pure returns (string memory) {
        return vm.toString(v);
    }

    function _settleNext(HuiCircleHarness c) internal {
        vm.warp(c.deadline(c.currentRound()));
        c.settleRound();
    }

    function _settleUpTo(HuiCircleHarness c, uint32 rounds) internal {
        while (c.settledRounds() < rounds) {
            _settleNext(c);
        }
    }

    function _revoke(HuiCircleHarness c, uint256 fromIdx, uint256 toIdx) internal {
        for (uint256 i = fromIdx; i <= toIdx; i++) {
            vm.prank(actors[i]);
            usdc.approve(address(c), 0);
        }
    }

    function _commitHash(HuiCircleHarness c, uint32 k, address m, uint256 bid, bytes32 salt)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(address(c), k, m, bid, salt));
    }

    // ================================================================== createCircle, join

    function test_Gas_createCircle_N30_withinBudget() public {
        CircleParams memory p = _n30Params();
        vm.cool(address(factory));
        vm.prank(organizer);
        uint256 before = gasleft();
        address created = factory.createCircle(p);
        uint256 used = before - gasleft();
        assertTrue(factory.isCircle(created));
        _report("createCircle N=30", used, BUDGET_CREATE);
        assertLe(used, BUDGET_CREATE, "createCircle over budget (docs/04 7.1)");
    }

    function _joinGas(HuiCircleHarness c, address member) internal returns (uint256) {
        _fund(member, 10_000 * USDC);
        MemberAttestation memory att = _attestation(member, address(c), uint64(_now() + 1 hours));
        bytes memory sig = _signAttestation(att, ATTESTER_KEY);
        PermitSig memory permit = _signPermit(member, address(c), c.requiredAllowance(), _now() + 1 hours);
        return _tx(c, member, address(c), abi.encodeCall(c.join, (att, sig, permit)));
    }

    function _now() internal view returns (uint256) {
        return vm.getBlockTimestamp();
    }

    function test_Gas_join_N30_firstAndLast_withinBudget() public {
        HuiCircleHarness c = _create(_n30Params());
        _depositBond(c, 18_000 * USDC);
        uint256 first = _joinGas(c, actors[0]);
        for (uint256 i = 1; i < 29; i++) {
            _join(c, actors[i]);
        }
        uint256 last = _joinGas(c, actors[29]);
        _report("join (first of 30)", first, BUDGET_JOIN);
        _report("join (30th of 30)", last, BUDGET_JOIN);
        assertLe(first, BUDGET_JOIN, "join (first) over budget (docs/04 7.1)");
        assertLe(last, BUDGET_JOIN, "join (last) over budget (docs/04 7.1)");
    }

    // ================================================================== commitBid, revealBid

    function _commitReveal(HuiCircleHarness c) internal {
        address m = actors[1];
        bytes32 salt = keccak256("salt");
        uint32 k = c.currentRound();
        bytes32 h = _commitHash(c, k, m, 3e6, salt);
        vm.warp(c.roundStart(k));
        uint256 first = _tx(c, m, address(c), abi.encodeCall(c.commitBid, (h)));
        // second commit in the same window overwrites: no new bond
        bytes32 h2 = _commitHash(c, k, m, 2e6, salt);
        uint256 overwrite = _tx(c, m, address(c), abi.encodeCall(c.commitBid, (h2)));
        vm.warp(c.roundStart(k) + c.params().commitWindow);
        uint256 reveal = _tx(c, m, address(c), abi.encodeCall(c.revealBid, (2e6, salt)));
        _report("commitBid (first of the round, pulls the bond)", first, BUDGET_COMMIT);
        _report("commitBid (overwrite)", overwrite, BUDGET_COMMIT);
        _report("revealBid (refunds the bond)", reveal, BUDGET_REVEAL);
        assertLe(first, BUDGET_COMMIT, "commitBid (first) over budget (docs/04 7.1, Q5)");
        assertLe(overwrite, BUDGET_COMMIT, "commitBid (overwrite) over budget");
        assertLe(reveal, BUDGET_REVEAL, "revealBid over budget (docs/04 7.1)");
    }

    function test_Gas_commitBid_revealBid_N5_withinBudget() public {
        _commitReveal(_workedExample());
    }

    function test_Gas_commitBid_revealBid_N30_withinBudget() public {
        _commitReveal(_active30());
    }

    /// @dev Through the ERC-2771 forwarder (the relayer path) the cost is higher by the forwarder overhead. Only the
    /// execution inside the circle is the budget; this prints the relayed figure and checks it against the relay cap
    /// of 3,000,000 (docs/05 section 8.2).
    function test_Gas_commitBid_throughForwarder_underRelayCap() public {
        HuiCircleHarness c = _workedExample();
        address m = actors[1];
        bytes32 h = _commitHash(c, 1, m, 3e6, keccak256("salt"));
        vm.warp(c.roundStart(1));
        _cool(c);
        vm.cool(address(forwarder));
        uint256 before = gasleft();
        _forward(m, address(c), abi.encodeCall(c.commitBid, (h)));
        uint256 used = before - gasleft();
        console.log(string.concat("commitBid relayed through the forwarder: ", _s(used), " gas (info)"));
        assertLe(used, 3_000_000, "relayed commitBid over the relay cap");
    }

    // ================================================================== settleRound N = 5

    function test_Gas_settleRound_N5_allPay_withinBudget() public {
        HuiCircleHarness c = _workedExample();
        // a real bidding round: M2 and M4 commit and reveal, M4 wins
        bytes32 s2 = keccak256("s2");
        bytes32 s4 = keccak256("s4");
        vm.prank(actors[1]);
        c.commitBid(_commitHash(c, 1, actors[1], 4e6, s2));
        vm.prank(actors[3]);
        c.commitBid(_commitHash(c, 1, actors[3], 6e6, s4));
        vm.warp(c.roundStart(1) + 90);
        vm.prank(actors[1]);
        c.revealBid(4e6, s2);
        vm.prank(actors[3]);
        c.revealBid(6e6, s4);
        vm.warp(c.deadline(1));
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.settleRound, ()));
        assertEq(c.roundInfo(1).winner, actors[3]);
        _report("settleRound N=5, everybody pays, with bids", used, BUDGET_SETTLE_N5);
        assertLe(used, BUDGET_SETTLE_N5, "settleRound N=5 over budget (docs/04 7.1)");
    }

    /// @dev The docs/03 section 8 branch: M4 wins round 1 (bids), then fails to pay round 2 (holdback and bond cascade).
    function test_Gas_settleRound_N5_oneShortfall_demoBranch_withinBudget() public {
        HuiCircleHarness c = _workedExample();
        bytes32 s4 = keccak256("s4");
        vm.prank(actors[3]);
        c.commitBid(_commitHash(c, 1, actors[3], 6e6, s4));
        vm.warp(c.roundStart(1) + 90);
        vm.prank(actors[3]);
        c.revealBid(6e6, s4);
        _settleNext(c);
        assertEq(c.roundInfo(1).winner, actors[3]);
        _revoke(c, 3, 3);
        vm.warp(c.deadline(2));
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.settleRound, ()));
        assertEq(c.shortfallOf(2, actors[3]).amount, 100e6, "M4 shortfall");
        _report("settleRound N=5, one shortfall (worked example branch)", used, BUDGET_SETTLE_N5);
        assertLe(used, BUDGET_SETTLE_N5, "settleRound N=5 with one shortfall over budget (docs/04 7.1)");
    }

    /// @dev Four of the four payers of round 2 fail at once: the worst demo case. Budget 800,000 (docs/04 7.1, A7),
    /// measured about 746,000.
    function test_Gas_settleRound_N5_fourShortfalls_withinWorstBudget() public {
        HuiCircleHarness c = _workedExample();
        _settleNext(c); // round 1: M1 wins
        _revoke(c, 0, 0); // M1 (already received, holdback 80)
        _revoke(c, 2, 4); // M3, M4, M5
        vm.warp(c.deadline(2));
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.settleRound, ()));
        assertEq(c.roundInfo(2).winner, actors[1]);
        assertGt(c.shortfallOf(2, actors[0]).amount, 0, "shortfalls were recorded");
        _report("settleRound N=5, four shortfalls (holdback and bond cascade)", used, BUDGET_SETTLE_N5_WORST);
        assertLe(used, BUDGET_SETTLE_N5_WORST, "settleRound N=5 with four shortfalls over budget (docs/04 7.1)");
    }

    // ================================================================== settleRound N = 30

    /// @dev The case docs/04 7.1 calls the worst: the last round, 29 transferFrom, 28 holdback releases, 29 registry
    /// writes.
    function test_Gas_settleRound_N30_lastRound_allPay_withinBudget() public {
        HuiCircleHarness c = _active30();
        _settleUpTo(c, 29);
        vm.warp(c.deadline(30));
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.settleRound, ()));
        assertEq(c.settledRounds(), 30);
        _report("settleRound N=30, last round, everybody pays", used, BUDGET_SETTLE_N30);
        if (used >= WARN_SETTLE_N30) console.log("WARNING: above the 2,500,000 warning threshold of docs/04 7.1");
        assertLe(used, BUDGET_SETTLE_N30, "settleRound N=30 over budget (docs/04 7.1)");
    }

    /// @dev Round 29 with three members short (the A3 measurement of docs/04: 1.68 million).
    function test_Gas_settleRound_N30_round29_threeShortfalls_withinBudget() public {
        HuiCircleHarness c = _active30();
        _settleUpTo(c, 28);
        _revoke(c, 0, 2); // M1, M2, M3 (received, with holdback) stop paying
        vm.warp(c.deadline(29));
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.settleRound, ()));
        assertEq(c.settledRounds(), 29);
        assertGt(c.shortfallOf(29, actors[0]).amount, 0);
        _report("settleRound N=30, round 29, three shortfalls", used, BUDGET_SETTLE_N30);
        assertLe(used, BUDGET_SETTLE_N30, "settleRound N=30 with 3 shortfalls over budget (docs/04 7.1)");
    }

    /// @dev Last round with ten members short.
    function test_Gas_settleRound_N30_lastRound_tenShortfalls_withinBudget() public {
        HuiCircleHarness c = _active30();
        _settleUpTo(c, 29);
        _revoke(c, 0, 9);
        vm.warp(c.deadline(30));
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.settleRound, ()));
        assertEq(c.settledRounds(), 30);
        _report("settleRound N=30, last round, ten shortfalls", used, BUDGET_SETTLE_N30);
        assertLe(used, BUDGET_SETTLE_N30, "settleRound N=30 with 10 shortfalls over budget (docs/04 7.1)");
    }

    /// @dev Documented extreme (docs/04 7.1 "Số đo thực"): all 29 payers of round 1 fail. Accepted above the table
    /// budget by decision; the cap that matters is the relay/keeper cap of 5,000,000.
    function test_Gas_settleRound_N30_round1_all29Shortfalls_underRelayCap() public {
        HuiCircleHarness c = _active30();
        _revoke(c, 1, 29);
        vm.warp(c.deadline(1));
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.settleRound, ()));
        assertEq(c.settledRounds(), 1);
        assertGt(c.shortfallOf(1, actors[29]).amount, 0);
        _report("settleRound N=30, round 1, ALL 29 fail (documented extreme)", used, CAP_EXTREME);
        if (used > BUDGET_SETTLE_N30) {
            console.log("NOTE: above the 3,000,000 table budget; accepted by docs/04 7.1, cap is 5,000,000");
        }
        assertLe(used, CAP_EXTREME, "extreme settleRound over the 5,000,000 relay/keeper cap");
    }

    // ================================================================== finalize N = 30

    function test_Gas_finalize_N30_clean_withinBudget() public {
        HuiCircleHarness c = _active30();
        _settleUpTo(c, 30);
        vm.warp(uint256(c.roundInfo(30).settledAt) + 121);
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.finalize, ()));
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        _report("finalize N=30, clean", used, BUDGET_FINALIZE_N30);
        assertLe(used, BUDGET_FINALIZE_N30, "finalize N=30 over budget (docs/04 7.1)");
    }

    /// @dev Finalize with a few members that defaulted and were marked in time by a keeper (the normal bad case).
    function test_Gas_finalize_N30_fiveMarkedDefaulters_withinBudget() public {
        HuiCircleHarness c = _active30();
        _settleUpTo(c, 29);
        _revoke(c, 0, 4);
        _settleNext(c); // round 30 with five shortfalls
        vm.warp(uint256(c.roundInfo(30).settledAt) + 121);
        for (uint256 i = 0; i < 5; i++) {
            c.markDefault(actors[i]);
        }
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.finalize, ()));
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        _report("finalize N=30, five marked defaulters", used, BUDGET_FINALIZE_N30);
        assertLe(used, BUDGET_FINALIZE_N30, "finalize N=30 with marked defaulters over budget (docs/04 7.1)");
    }

    /// @dev Documented extreme (docs/04 7.1, audit A4 M-03): 29 members short in the last round and nobody called
    /// `markDefault`, so `finalize` marks them all itself. Measured 5.50 million, OVER the 5,000,000 relay/keeper cap.
    /// Decision A7: not a budget; the keeper must `markDefault` first (docs/04 7.1, docs/05 section 9), see the next
    /// test. Pinned as a regression ceiling only.
    function test_Gas_finalize_N30_all29UnmarkedDefaulters_outsideBudget_pinned() public {
        HuiCircleHarness c = _active30();
        _settleUpTo(c, 29);
        _revoke(c, 0, 28);
        _settleNext(c); // round 30: M30 wins, the other 29 are short
        vm.warp(uint256(c.roundInfo(30).settledAt) + 121);
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.finalize, ()));
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        _report("finalize N=30, 29 unmarked defaulters (outside budget, keeper must mark first)", used, CAP_EXTREME);
        assertLe(used, OBSERVED_FINALIZE_29_UNMARKED, "finalize with 29 unmarked defaulters got more expensive");
    }

    /// @dev The keeper rule (A7): the same 29 defaulters, but `markDefault` was called for each one first. Then
    /// `finalize` stays inside the table budget and every `markDefault` is cheap enough for the 3,000,000 relay cap.
    function test_Gas_finalize_N30_all29MarkedFirst_withinBudget() public {
        HuiCircleHarness c = _active30();
        _settleUpTo(c, 29);
        _revoke(c, 0, 28);
        _settleNext(c);
        vm.warp(uint256(c.roundInfo(30).settledAt) + 121);
        uint256 worstMark;
        for (uint256 i = 0; i < 29; i++) {
            uint256 m = _tx(c, address(this), address(c), abi.encodeCall(c.markDefault, (actors[i])));
            if (m > worstMark) worstMark = m;
        }
        assertLe(worstMark, 3_000_000, "markDefault over the relay cap");
        uint256 used = _tx(c, address(this), address(c), abi.encodeCall(c.finalize, ()));
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        _report("finalize N=30, 29 defaulters marked first", used, BUDGET_FINALIZE_N30);
        assertLe(used, BUDGET_FINALIZE_N30, "finalize N=30 after marking over budget (docs/04 7.1)");
    }
}
