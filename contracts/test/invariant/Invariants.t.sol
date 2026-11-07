// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {CircleFixture} from "../utils/CircleFixture.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {RecordingUSDC} from "../utils/RecordingUSDC.sol";
import {Handler, Wiring} from "./Handler.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";
import {CircleParams, CircleState, MemberInfo, RoundInfo, Shortfall} from "../../src/libraries/HuiTypes.sol";

/// @notice Invariant suite of docs/09 section 4 (INV-01..INV-09; INV-10 is the static `privacy` job of CI).
/// One circle of the docs/03 section 8 shape (N = 5, C = 100 USDC, alpha 20%, demo timings 180/90/60/120 s,
/// P = 30 days) is driven by a `Handler`; each `invariant_INVxx_*` function compares the contract with the ghost
/// variables of the Handler after every call.
abstract contract HuiInvariantsBase is StdInvariant, CircleFixture {
    uint256 internal constant N = 5;
    uint256 internal constant C = 100e6;
    uint256 internal constant ALPHA = 2000;

    Handler internal handler;
    HuiCircleHarness internal circle;
    RecordingUSDC internal rec;

    /// @dev Bond of the organizer, in USDC base units.
    function _bond() internal pure virtual returns (uint256);

    /// @dev Members that have joined when the Handler starts (`N` = all of them).
    function _preJoined() internal pure virtual returns (uint256) {
        return N;
    }

    /// @dev Activate the circle in `setUp` (otherwise the Handler has to do it).
    function _activateAtSetup() internal pure virtual returns (bool) {
        return true;
    }

    function _fullCoverage() internal pure virtual returns (bool) {
        return false;
    }

    function _label() internal pure virtual returns (string memory);

    /// @dev Selectors the fuzzer may call. Heavily used ones are listed more than once.
    function _selectors() internal pure virtual returns (bytes4[] memory);

    function setUp() public virtual override {
        super.setUp();
        // Swap the plain MockUSDC of the fixture for the recording one, before the factory snapshots its address.
        rec = new RecordingUSDC();
        usdc = rec;
        cfg.usdc = address(rec);
        factory = new HuiFactory(admin, address(impl), cfg);

        circle = _create(_params());
        _depositBond(circle, _bond());
        for (uint256 i = 0; i < _preJoined(); i++) {
            _join(circle, actors[i]);
            vm.prank(actors[i]);
            usdc.approve(address(circle), type(uint256).max); // a user may allow more than the permit
        }
        if (_activateAtSetup()) {
            vm.prank(organizer);
            circle.activate();
        }

        address[5] memory members;
        uint256[5] memory keys;
        for (uint256 i = 0; i < N; i++) {
            members[i] = actors[i];
            keys[i] = actorKey[actors[i]];
        }
        handler = new Handler(
            Wiring({
                circle: circle,
                usdc: rec,
                factory: factory,
                forwarder: forwarder,
                implementation: address(impl),
                admin: admin,
                organizer: organizer,
                members: members,
                keys: keys,
                attesterKey: ATTESTER_KEY,
                fullCoverage: _fullCoverage()
            })
        );

        targetContract(address(handler));
        targetSelector(FuzzSelector({addr: address(handler), selectors: _selectors()}));
    }

    // ================================================================== helpers

    function _members() internal view returns (address[5] memory m) {
        for (uint256 i = 0; i < N; i++) {
            m[i] = actors[i];
        }
    }

    function _settledOrPaused() internal view returns (bool) {
        CircleState s = circle.state();
        return s == CircleState.Active || s == CircleState.Paused || s == CircleState.Completed;
    }

    // ================================================================== INV-01 .. INV-09

    /// @notice INV-01: `usdc.balanceOf(circle) == bondRemaining + reserve + totalHoldback + totalFeeEscrow +
    /// revealBondsHeld + totalClaimable`, and the totals equal the sums of their parts.
    function invariant_INV01_ledger() public view {
        assertEq(
            usdc.balanceOf(address(circle)),
            circle.bondRemaining() + circle.reserve() + circle.totalHoldback() + circle.totalFeeEscrow()
                + circle.revealBondsHeld() + circle.totalClaimable(),
            "INV-01 ledger"
        );
        address[5] memory m = _members();
        uint256 holdback;
        uint256 claimable_ = circle.claimable(organizer);
        uint256 revealBonds;
        uint32 k = circle.currentRound();
        for (uint256 i = 0; i < N; i++) {
            holdback += circle.memberInfo(m[i]).holdback;
            claimable_ += circle.claimable(m[i]);
            // Reveal bonds are only ever held for the round in progress (refunded, forfeited or returned at settle).
            revealBonds += circle.commitOf(k, m[i]).bondHeld;
        }
        assertEq(holdback, circle.totalHoldback(), "sum of holdback");
        assertEq(claimable_, circle.totalClaimable(), "sum of claimable");
        assertEq(revealBonds, circle.revealBondsHeld(), "sum of reveal bonds held");
        uint256 escrow;
        for (uint32 r = 1; r <= N; r++) {
            escrow += circle.feeEscrow(r);
        }
        assertEq(escrow, circle.totalFeeEscrow(), "sum of fee escrow");
    }

    /// @notice INV-02: nobody wins twice, at most N rounds, and a Completed circle has exactly N winners.
    function invariant_INV02_oneWinEach() public view {
        address[5] memory m = _members();
        uint256 wins;
        uint256 received;
        for (uint256 i = 0; i < N; i++) {
            assertLe(handler.ghostWins(m[i]), 1, "INV-02 won twice");
            wins += handler.ghostWins(m[i]);
            if (circle.memberInfo(m[i]).received) received++;
        }
        uint32 settled = circle.settledRounds();
        assertLe(settled, N, "INV-02 more rounds than members");
        assertEq(wins, settled, "INV-02 one winner per settled round");
        assertEq(received, settled, "INV-02 received flags match settled rounds");
        for (uint32 r = 1; r <= settled; r++) {
            RoundInfo memory ri = circle.roundInfo(r);
            assertTrue(ri.settled && ri.winner != address(0), "INV-02 settled round has a winner");
            for (uint32 q = r + 1; q <= settled; q++) {
                assertTrue(ri.winner != circle.roundInfo(q).winner, "INV-02 same winner in two rounds");
            }
        }
        if (circle.state() == CircleState.Completed) {
            assertEq(settled, N, "INV-02 completed after N rounds");
            assertEq(wins, N, "INV-02 completed: N winners");
        }
    }

    /// @notice INV-03: no winning bid above `maxBid(k)` (read right before the settlement) or at/above C; no reveal
    /// of a bid above the cap succeeded.
    function invariant_INV03_bidCap() public view {
        uint32 settled = circle.settledRounds();
        for (uint32 k = 1; k <= settled; k++) {
            RoundInfo memory ri = circle.roundInfo(k);
            assertLe(ri.winningBid, handler.ghostMaxBidAtSettle(k), "INV-03 bid above maxBid");
            assertLt(ri.winningBid, C, "INV-03 bid not below C");
        }
        assertEq(handler.ghostBidCapBreach(), 0, "INV-03 a bid above the cap was revealed");
    }

    /// @notice INV-04: in no call was a member pulled for more than it owed (due, reveal bond, late payment with
    /// fee, repayment with fee). Measured with `RecordingUSDC`.
    function invariant_INV04_noOverPull() public view {
        assertEq(
            handler.ghostOverPull(),
            0,
            string.concat(
                "INV-04 over-pull of ",
                vm.toString(handler.ghostOverPullWho()),
                ": pulled ",
                vm.toString(handler.ghostOverPullPulled()),
                " allowed ",
                vm.toString(handler.ghostOverPullAllowed())
            )
        );
    }

    /// @notice INV-05: `payout + fee + premium + holdback + repaid == pot` in every settled round, and the pot is
    /// exactly what was pulled plus what the cascade covered; `uncovered` matches the `ShortfallCovered` events.
    function invariant_INV05_potSplit() public view {
        uint32 settled = circle.settledRounds();
        CircleParams memory p = circle.params();
        for (uint32 k = 1; k <= settled; k++) {
            RoundInfo memory ri = circle.roundInfo(k);
            assertEq(
                ri.pot,
                uint256(ri.payout) + ri.fee + ri.premium + ri.holdback + handler.ghostRepaidAtSettle(k),
                "INV-05"
            );
            assertEq(
                ri.pot,
                handler.ghostPulledAtSettle(k) + handler.ghostCoveredAtSettle(k),
                "INV-05 pot = pulled + covered"
            );
            assertEq(ri.uncovered, handler.ghostUncoveredAtSettle(k), "INV-05 uncovered");
            assertEq(ri.premium, HuiMath.bpsOf(ri.pot, p.reserveBps), "INV-05 premium");
            assertEq(ri.fee, p.commissionMode ? HuiMath.bpsOf(ri.pot, p.feeBps) : 0, "INV-05 fee");
            assertLe(ri.holdback, HuiMath.holdbackFor(p.alphaBps, N, k, C), "INV-05 holdback above H");
        }
    }

    /// @notice INV-06 (docs/03 section 7.2 wording): after m settled rounds every member that received and has not
    /// defaulted holds at most `alpha * (N - m) * C / 10_000` (+ N units of rounding), and exactly that (within N)
    /// when it has no open shortfall and kept the full H it was given when it won. With no shortfall ever, the sum
    /// of holdback is `alpha * O(m)`. After an emergency unwind everything was paid out, so only the bound is kept.
    function invariant_INV06_holdback() public view {
        uint256 m = circle.settledRounds();
        uint256 expected = HuiMath.holdbackFor(ALPHA, N, m, C);
        bool exactState = _settledOrPaused();
        address[5] memory mem = _members();
        for (uint256 i = 0; i < N; i++) {
            MemberInfo memory mi = circle.memberInfo(mem[i]);
            if (!mi.received || mi.defaulted) continue;
            assertLe(mi.holdback, expected + N, "INV-06 holdback above alpha*(N-m)*C");
            if (exactState && mi.debt == 0 && handler.ghostFullH(mem[i])) {
                assertApproxEqAbs(mi.holdback, expected, N, "INV-06 holdback equals alpha*(N-m)*C");
            }
        }
        if (exactState && !handler.ghostAnyShortfall()) {
            assertApproxEqAbs(
                circle.totalHoldback(), HuiMath.bpsOf(HuiMath.exposure(N, m, C), ALPHA), N, "INV-06 sum = alpha*O(m)"
            );
        }
    }

    /// @notice INV-07: the admin never receives USDC, the circle only pays members and the organizer, the factory
    /// and forwarder hold nothing and no privileged call (or forged or early request) ever succeeded.
    function invariant_INV07_noAdminPayout() public view {
        assertEq(handler.ghostAdminReceived(), 0, "INV-07 admin received USDC");
        assertEq(handler.ghostUnexpectedRecipient(), 0, "INV-07 USDC left to a stranger");
        assertEq(handler.ghostUnauthorizedSuccess(), 0, "INV-07 an unauthorized call succeeded");
        assertEq(usdc.balanceOf(admin), 0, "INV-07 admin balance");
        assertEq(usdc.balanceOf(address(factory)), 0, "INV-07 factory balance");
        assertEq(usdc.balanceOf(address(forwarder)), 0, "INV-07 forwarder balance");
        assertEq(usdc.balanceOf(handler.attacker()), 0, "INV-07 attacker balance");
    }

    /// @notice INV-09: no settlement before `deadline(k)` or out of order; `roundStart(k) >= settledAt(k - 1)`; a
    /// pause shifts the schedule by exactly its length; nothing but `claim` works while Paused; commits and reveals
    /// stay in their windows; the parameters never change.
    function invariant_INV09_schedule() public view {
        assertEq(handler.ghostSettledBeforeDeadline(), 0, "INV-09 settled before the deadline");
        assertEq(handler.ghostScheduleBreak(), 0, "INV-09 a pause did not shift the schedule by its length");
        assertEq(handler.ghostPausedBreach(), 0, "INV-09 a state change worked while Paused");
        assertEq(handler.ghostWindowBreach(), 0, "INV-09 a bid worked outside its window");
        assertEq(keccak256(abi.encode(circle.params())), handler.ghostParamsHash(), "INV-09 parameters changed");
        uint32 settled = circle.settledRounds();
        for (uint32 k = 1; k <= settled; k++) {
            RoundInfo memory ri = circle.roundInfo(k);
            assertTrue(ri.settled, "INV-09 rounds settle in order");
            if (k >= 2) {
                assertGe(ri.settledAt, circle.roundInfo(k - 1).settledAt, "INV-09 round k after round k-1");
            }
        }
        for (uint32 k = 2; k <= settled + 1 && k <= N; k++) {
            assertGe(circle.roundStart(k), circle.roundInfo(k - 1).settledAt, "INV-09 roundStart(k) >= settledAt(k-1)");
        }
    }

    // ================================================================== run statistics

    /// @dev Foundry reverts the EVM state between runs, so the counters live in the process environment. The last
    /// line printed in a campaign has the totals.
    function _bump(string memory name, uint256 by) internal returns (uint256 v) {
        string memory key = string.concat("HUI_INV_", _label(), "_", name);
        v = vm.envOr(key, uint256(0)) + by;
        vm.setEnv(key, vm.toString(v));
    }

    function afterInvariant() public {
        uint256 runs = _bump("RUNS", 1);
        CircleState s = circle.state();
        uint256 settled = circle.settledRounds();
        if (settled >= 1) _bump("R1", 1);
        if (settled >= 3) _bump("R3", 1);
        if (settled == N) _bump("R5", 1);
        if (s == CircleState.Completed) _bump("COMPLETED", 1);
        if (s == CircleState.Unwound) _bump("UNWOUND", 1);
        if (s == CircleState.Cancelled) _bump("CANCELLED", 1);
        if (s == CircleState.Paused) _bump("PAUSED", 1);
        if (handler.ghostAnyShortfall()) _bump("SHORTFALL", 1);
        if (handler.ghostAnyLate()) _bump("LATEPAID", 1);
        if (handler.ghostStoppedReceivers()) _bump("STOPPED", 1);
        _bump("DEFAULTS", handler.ghostDefaults());
        _bump("REPAID", handler.ghostRepaid());
        _bump("COMMITS", handler.ghostCommits());
        _bump("REVEALS", handler.ghostReveals());
        _bump("SKIPPED", handler.ghostSkippedReveals());
        _bump("SETTLES", handler.ghostSettles());
        string[] memory names = handler.names();
        for (uint256 i = 0; i < names.length; i++) {
            _bump(string.concat("CALL_", names[i]), handler.calls(names[i]));
        }
        console.log(
            string.concat(
                "[",
                _label(),
                "] runs ",
                vm.toString(runs),
                " settles ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_SETTLES"), uint256(0)))
            )
        );
        console.log(
            string.concat(
                "  >=1 round ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_R1"), uint256(0))),
                ", >=3 rounds ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_R3"), uint256(0))),
                ", 5 rounds ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_R5"), uint256(0)))
            )
        );
        console.log(
            string.concat(
                "  completed ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_COMPLETED"), uint256(0))),
                ", unwound ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_UNWOUND"), uint256(0))),
                ", cancelled ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_CANCELLED"), uint256(0))),
                ", paused-at-end ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_PAUSED"), uint256(0)))
            )
        );
        console.log(
            string.concat(
                "  runs with shortfall ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_SHORTFALL"), uint256(0))),
                ", payLate ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_LATEPAID"), uint256(0))),
                ", defaults ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_DEFAULTS"), uint256(0))),
                ", repayDebt ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_REPAID"), uint256(0))),
                ", receivers stopped ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_STOPPED"), uint256(0)))
            )
        );
        console.log(
            string.concat(
                "  commits ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_COMMITS"), uint256(0))),
                ", reveals ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_REVEALS"), uint256(0))),
                ", skipped reveals ",
                vm.toString(vm.envOr(string.concat("HUI_INV_", _label(), "_SKIPPED"), uint256(0)))
            )
        );
    }
}

/// @notice docs/09 section 4.1: CI = 80% (alpha 20%, bond 0.6 * O_max = 360 USDC), every kind of default, late
/// payment, blocked wallets, pause, unwind and attacks.
contract HuiInvariants is HuiInvariantsBase {
    function _bond() internal pure virtual override returns (uint256) {
        return 360e6;
    }

    function _label() internal pure virtual override returns (string memory) {
        return "HuiInvariants";
    }

    function _selectors() internal pure virtual override returns (bytes4[] memory s) {
        s = new bytes4[](36);
        uint256 n;
        s[n++] = Handler.bidRound.selector;
        s[n++] = Handler.bidRound.selector;
        s[n++] = Handler.bidRound.selector;
        s[n++] = Handler.bidRound.selector;
        s[n++] = Handler.warp.selector;
        s[n++] = Handler.commit.selector;
        s[n++] = Handler.commit.selector;
        s[n++] = Handler.reveal.selector;
        s[n++] = Handler.reveal.selector;
        s[n++] = Handler.settle.selector;
        s[n++] = Handler.advanceRound.selector;
        s[n++] = Handler.advanceRound.selector;
        s[n++] = Handler.advanceRound.selector;
        s[n++] = Handler.advanceRound.selector;
        s[n++] = Handler.payLate.selector;
        s[n++] = Handler.payLate.selector;
        s[n++] = Handler.repayDebt.selector;
        s[n++] = Handler.claim.selector;
        s[n++] = Handler.markDefault.selector;
        s[n++] = Handler.finalize.selector;
        s[n++] = Handler.pauseCircle.selector;
        s[n++] = Handler.unpauseCircle.selector;
        s[n++] = Handler.unwind.selector;
        s[n++] = Handler.drainWallet.selector;
        s[n++] = Handler.drainWallet.selector;
        s[n++] = Handler.revokeAllowance.selector;
        s[n++] = Handler.refund.selector;
        s[n++] = Handler.refund.selector;
        s[n++] = Handler.toggleBlacklist.selector;
        s[n++] = Handler.attackPrivileged.selector;
        s[n++] = Handler.attackForgedRequest.selector;
        s[n++] = Handler.attackSpoofSender.selector;
        s[n++] = Handler.attackMulticall.selector;
        s[n++] = Handler.warp.selector;
        s[n++] = Handler.markDefault.selector;
        s[n++] = Handler.payLate.selector;
    }
}

/// @notice docs/09 section 4.1, INV-08: bond (1 - alpha) * O_max = 480 USDC (coverage index 100%). Only members that
/// already received stop paying, all of them in the same moment (`Handler.stopReceivers`); everyone else pays on time.
contract HuiInvariantsFullCoverage is HuiInvariantsBase {
    function _bond() internal pure virtual override returns (uint256) {
        return 480e6;
    }

    function _fullCoverage() internal pure virtual override returns (bool) {
        return true;
    }

    function _label() internal pure virtual override returns (string memory) {
        return "HuiInvariantsFullCoverage";
    }

    function _selectors() internal pure virtual override returns (bytes4[] memory s) {
        s = new bytes4[](26);
        uint256 n;
        s[n++] = Handler.bidRound.selector;
        s[n++] = Handler.bidRound.selector;
        s[n++] = Handler.bidRound.selector;
        s[n++] = Handler.bidRound.selector;
        s[n++] = Handler.warp.selector;
        s[n++] = Handler.commit.selector;
        s[n++] = Handler.commit.selector;
        s[n++] = Handler.reveal.selector;
        s[n++] = Handler.reveal.selector;
        s[n++] = Handler.settle.selector;
        s[n++] = Handler.advanceRound.selector;
        s[n++] = Handler.advanceRound.selector;
        s[n++] = Handler.advanceRound.selector;
        s[n++] = Handler.advanceRound.selector;
        s[n++] = Handler.payLate.selector;
        s[n++] = Handler.repayDebt.selector;
        s[n++] = Handler.claim.selector;
        s[n++] = Handler.markDefault.selector;
        s[n++] = Handler.finalize.selector;
        s[n++] = Handler.pauseCircle.selector;
        s[n++] = Handler.unpauseCircle.selector;
        s[n++] = Handler.stopReceivers.selector;
        s[n++] = Handler.stopReceivers.selector;
        s[n++] = Handler.attackPrivileged.selector;
        s[n++] = Handler.attackForgedRequest.selector;
        s[n++] = Handler.attackMulticall.selector;
    }

    /// @notice INV-08, bounded form of docs/03 section 7.3 (the case the spec proves): with coverage index 100% and
    /// only already-received members ceasing to pay, all of them at the same moment, no round has `uncovered > 0`.
    /// @dev PENDING coordinator/user decision: docs/03 section 7.2 words INV-08 without "at the same moment". If the
    /// defaulters stop one after the other the unpaid contributions reach N(N-1)/2 * C > O_max and `uncovered` is
    /// positive (pinned by `test_INV08_SpecGap_...` in test/unit/HuiCircleLate.t.sol). This function must not be
    /// widened to that case until the spec says what is guaranteed there.
    function invariant_INV08_fullCoverage() public view {
        assertEq(
            HuiMath.coverageIndexBps(ALPHA, circle.bondDeposited(), 0, N, C), 10_000, "setup: coverage index is 100%"
        );
        uint32 settled = circle.settledRounds();
        uint256 totalUncovered;
        for (uint32 k = 1; k <= settled; k++) {
            totalUncovered += circle.roundInfo(k).uncovered;
        }
        assertEq(totalUncovered, 0, "INV-08 a winner was short-changed");
    }
}

/// @notice The Forming phase under fuzzing: two members and a 200 USDC bond at the start (coverage 53%), the Handler
/// joins and leaves members, adds bond, activates or cancels, then the run continues through the same actions as
/// `HuiInvariants`. Same invariants.
contract HuiInvariantsForming is HuiInvariants {
    function _bond() internal pure override returns (uint256) {
        return 200e6;
    }

    function _preJoined() internal pure override returns (uint256) {
        return 2;
    }

    function _activateAtSetup() internal pure override returns (bool) {
        return false;
    }

    function _label() internal pure override returns (string memory) {
        return "HuiInvariantsForming";
    }

    function _selectors() internal pure override returns (bytes4[] memory s) {
        bytes4[] memory base = super._selectors();
        s = new bytes4[](base.length + 12);
        for (uint256 i = 0; i < base.length; i++) {
            s[i] = base[i];
        }
        uint256 n = base.length;
        s[n++] = Handler.joinCircle.selector;
        s[n++] = Handler.joinCircle.selector;
        s[n++] = Handler.joinCircle.selector;
        s[n++] = Handler.leaveCircle.selector;
        s[n++] = Handler.depositMore.selector;
        s[n++] = Handler.depositMore.selector;
        s[n++] = Handler.activateCircle.selector;
        s[n++] = Handler.activateCircle.selector;
        s[n++] = Handler.activateCircle.selector;
        s[n++] = Handler.cancelCircle.selector;
        s[n++] = Handler.withdrawBondAction.selector;
        s[n++] = Handler.joinCircle.selector;
    }
}
