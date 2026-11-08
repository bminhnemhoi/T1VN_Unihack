// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {stdError} from "forge-std/StdError.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {HuiCircle} from "../../src/HuiCircle.sol";
import {HuiCircleLens} from "../../src/HuiCircleLens.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {ReputationRegistry} from "../../src/ReputationRegistry.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";
import {
    Commit,
    CircleParams,
    CircleState,
    FactoryConfig,
    MemberInfo,
    RoundInfo,
    RoundPhase,
    Shortfall
} from "../../src/libraries/HuiTypes.sol";

/// @notice The EIP-170 lens (task A4): `HuiCircle` serves the read-only functions of docs/05 section 3.2 through
/// `fallback()` -> DELEGATECALL to an immutable `HuiCircleLens`. These tests run on a REAL `HuiCircle` created by a
/// factory (`real`), driven in lockstep with a harness circle (`c`, which inherits the views directly) so that every
/// moved view can be compared with the direct implementation, and with hand-computed values.
contract HuiCircleLensTest is CircleScenario {
    HuiCircleLens internal lens;
    HuiCircle internal realImpl;
    HuiFactory internal realFactory;
    ReputationRegistry internal registry;
    HuiCircleHarness internal real; // address of a real HuiCircle clone, typed with the harness ABI for convenience

    address internal stranger = makeAddr("stranger");

    function setUp() public override {
        super.setUp(); // `c` = harness circle (reference), active at t0, no time has passed
        registry = new ReputationRegistry(admin);
        lens = new HuiCircleLens();
        realImpl = new HuiCircle(address(forwarder), address(lens));
        FactoryConfig memory cfg2 = cfg;
        cfg2.reputation = address(registry);
        realFactory = new HuiFactory(admin, address(realImpl), cfg2);
        vm.prank(admin);
        registry.setFactory(address(realFactory));

        // same parameters, same timestamp: identical schedule
        vm.prank(organizer);
        real = HuiCircleHarness(realFactory.createCircle(_params()));
        _depositBond(real, 480 * U);
        _joinN(real, 5);
        vm.prank(organizer);
        real.activate();
        assertEq(real.startTime(), c.startTime());
    }

    // ------------------------------------------------------------------ lockstep helpers

    function _both() internal view returns (HuiCircleHarness[2] memory xs) {
        xs[0] = c;
        xs[1] = real;
    }

    function _commitOn(HuiCircleHarness x, address m, uint256 bid) internal {
        bytes32 h = keccak256(abi.encode(address(x), x.currentRound(), m, bid, _salt(m)));
        vm.prank(m);
        x.commitBid(h);
    }

    function _commitBoth(address m, uint256 bid) internal {
        HuiCircleHarness[2] memory xs = _both();
        for (uint256 i = 0; i < 2; i++) {
            _commitOn(xs[i], m, bid);
        }
    }

    function _revealBoth(address m, uint256 bid) internal {
        HuiCircleHarness[2] memory xs = _both();
        for (uint256 i = 0; i < 2; i++) {
            vm.prank(m);
            xs[i].revealBid(bid, _salt(m));
        }
    }

    function _blockBoth(address m) internal {
        HuiCircleHarness[2] memory xs = _both();
        for (uint256 i = 0; i < 2; i++) {
            vm.prank(m);
            usdc.approve(address(xs[i]), 0);
        }
    }

    function _settleBoth() internal {
        vm.warp(c.deadline(c.currentRound()));
        c.settleRound();
        real.settleRound();
    }

    function _same(bytes memory a, bytes memory b, string memory what) internal pure {
        assertEq(keccak256(a), keccak256(b), what);
    }

    /// @dev Every view moved to the lens, compared between the real circle (fallback) and the harness (direct).
    function _assertParity() internal view {
        _same(abi.encode(real.params()), abi.encode(c.params()), "params");
        _same(abi.encode(real.members()), abi.encode(c.members()), "members");
        assertEq(uint8(real.phase()), uint8(c.phase()), "phase");
        assertEq(real.maxExposure(), c.maxExposure(), "maxExposure");
        assertEq(real.coverageIndexBps(), c.coverageIndexBps(), "coverageIndexBps");
        for (uint32 k = 1; k <= 5; k++) {
            assertEq(real.roundStart(k), c.roundStart(k), "roundStart");
            assertEq(real.deadline(k), c.deadline(k), "deadline");
            assertEq(real.maxBid(k), c.maxBid(k), "maxBid");
            assertEq(real.exposure(k), c.exposure(k), "exposure");
            _same(abi.encode(real.roundInfo(k)), abi.encode(c.roundInfo(k)), "roundInfo");
        }
        address[7] memory who = [_M(1), _M(2), _M(3), _M(4), _M(5), organizer, stranger];
        for (uint256 i = 0; i < who.length; i++) {
            _same(abi.encode(real.memberInfo(who[i])), abi.encode(c.memberInfo(who[i])), "memberInfo");
            for (uint32 k = 1; k <= 3; k++) {
                _same(abi.encode(real.shortfallOf(k, who[i])), abi.encode(c.shortfallOf(k, who[i])), "shortfallOf");
                assertEq(real.lateFeeOf(who[i], k), c.lateFeeOf(who[i], k), "lateFeeOf");
                assertEq(real.dueOf(who[i], k, 3 * U), c.dueOf(who[i], k, 3 * U), "dueOf");
                Commit memory a = real.commitOf(k, who[i]);
                Commit memory b = c.commitOf(k, who[i]);
                assertEq(a.commitIndex, b.commitIndex, "commitIndex");
                assertEq(a.revealed, b.revealed, "revealed");
                assertEq(a.bid, b.bid, "bid");
                assertEq(a.bondHeld, b.bondHeld, "bondHeld");
            }
        }
        // functions kept on the circle itself
        assertEq(real.currentRound(), c.currentRound());
        assertEq(real.revealBond(), c.revealBond());
        assertEq(real.requiredAllowance(), c.requiredAllowance());
        assertEq(real.guaranteedCoverageBps(), c.guaranteedCoverageBps());
    }

    // ================================================================== parity on a driven circle

    function test_Lens_ParityAfterActivation_AndExpectedValues() public view {
        _assertParity();
        CircleParams memory p = real.params();
        assertEq(uint8(p.mode), 1);
        assertEq(p.memberCount, 5);
        assertEq(p.contribution, 100 * U);
        assertEq(p.periodSeconds, 30 days);
        assertEq(p.roundDuration, 180);
        assertEq(p.commitWindow, 90);
        assertEq(p.revealWindow, 60);
        assertEq(p.graceSeconds, 120);
        assertEq(p.alphaBps, 2000);
        assertEq(p.label, bytes32("demo"));
        address[] memory ms = real.members();
        assertEq(ms.length, 5);
        for (uint256 i = 0; i < 5; i++) {
            assertEq(ms[i], actors[i]);
        }
        assertEq(real.memberInfo(_M(3)).joinIndex, 2);
        assertTrue(real.memberInfo(_M(3)).joined);
        assertEq(uint8(real.phase()), uint8(RoundPhase.Commit));
        assertEq(real.roundStart(1), real.startTime());
        assertEq(real.deadline(1), real.startTime() + 180);
        assertEq(real.exposure(2), 600 * U, "O(2) = 2 * 3 * 100");
        assertEq(real.exposure(0), 0);
        assertEq(real.maxExposure(), 600 * U);
        assertEq(real.maxBid(1), 6_575_342, "docs/03 section 8 row k = 1");
        // Before round 1 five members are live, so a later round is priced with 4 payers, not with N - k.
        for (uint32 k = 2; k <= 4; k++) {
            assertEq(real.maxBid(k), HuiMath.maxBid(2000, 5, k, 100 * U, 30 days, 4));
        }
        assertEq(real.maxBid(2), 3_698_630);
        assertEq(real.coverageIndexBps(), 10_000, "20% + 480/600");
        assertEq(real.guaranteedCoverageBps(), 10_000);
        assertEq(real.dueOf(_M(2), 1, 6 * U), 94 * U);
        assertEq(real.dueOf(stranger, 1, 6 * U), 0);
        assertEq(real.revealBond(), 1 * U);
        assertEq(real.requiredAllowance(), 4 * 101 * U);
    }

    function test_Lens_ParityThroughBidsSettlementAndAShortfall() public {
        // round 1: M2 bids 4, M4 bids 6
        _commitBoth(_M(2), 4 * U);
        _commitBoth(_M(4), 6 * U);
        _assertParity();
        assertEq(real.commitOf(1, _M(4)).commitIndex, 2);
        assertEq(real.commitOf(1, _M(4)).bondHeld, 1 * U);
        assertEq(
            real.commitOf(1, _M(4)).hash, keccak256(abi.encode(address(real), uint32(1), _M(4), 6 * U, _salt(_M(4))))
        );
        assertEq(uint8(real.phase()), uint8(RoundPhase.Commit));

        vm.warp(c.roundStart(1) + 90);
        assertEq(uint8(real.phase()), uint8(RoundPhase.Reveal));
        _revealBoth(_M(2), 4 * U);
        _revealBoth(_M(4), 6 * U);
        assertTrue(real.commitOf(1, _M(4)).revealed);
        assertEq(real.commitOf(1, _M(4)).bid, 6 * U);
        _assertParity();

        vm.warp(c.roundStart(1) + 150);
        assertEq(uint8(real.phase()), uint8(RoundPhase.AwaitingSettle));
        _settleBoth();
        _assertParity();
        RoundInfo memory r1 = real.roundInfo(1);
        assertEq(r1.winner, _M(4));
        assertEq(r1.winningBid, 6 * U);
        assertEq(r1.pot, 376 * U);
        assertEq(r1.payout, 288_480_000);
        assertEq(r1.holdback, 80 * U);
        assertTrue(r1.settled);
        assertEq(real.roundStart(2), r1.settledAt);
        assertEq(real.deadline(2), r1.settledAt + 180);
        assertEq(real.maxBid(2), 4_931_506, "3 payers = N - k");
        assertEq(real.dueOf(_M(4), 2, 3 * U), 100 * U, "received: C");
        assertEq(real.dueOf(_M(2), 2, 3 * U), 97 * U, "live: C - b");
        assertEq(real.memberInfo(_M(4)).holdback, 80 * U);

        // round 2 with a shortfall of M4
        _commitBoth(_M(1), 3 * U);
        _commitBoth(_M(2), 3 * U);
        vm.warp(c.roundStart(2) + 90);
        _revealBoth(_M(1), 3 * U);
        _revealBoth(_M(2), 3 * U);
        _blockBoth(_M(4));
        _settleBoth();
        _assertParity();
        RoundInfo memory r2 = real.roundInfo(2);
        assertEq(r2.winner, _M(1));
        assertEq(r2.payout, 323_180_000);
        Shortfall memory sf = real.shortfallOf(2, _M(4));
        assertEq(sf.amount, 100 * U);
        assertEq(sf.fromHoldback, 80 * U);
        assertEq(sf.fromBond, 20 * U);
        assertFalse(sf.resolved);
        MemberInfo memory m4 = real.memberInfo(_M(4));
        assertTrue(m4.received);
        assertEq(m4.receivedRound, 1);
        assertEq(m4.debt, 100 * U);
        assertEq(m4.lateCount, 1);
        assertEq(real.maxBid(3), 3_287_671, "live = 3, payers = 2 = N - k");
        // bond 460, reserve 3.76 + 3.91
        assertEq(real.coverageIndexBps(), 9794, "2000 + (460 + 7.67) * 10_000 / 600");
        assertEq(real.guaranteedCoverageBps(), 9666, "2000 + 460 * 10_000 / 600");

        // late fee grows with the clock, exactly as the harness computes it
        vm.warp(r2.settledAt + 30);
        assertEq(
            real.lateFeeOf(_M(4), 2),
            HuiMath.lateFee(20 * U, 1000, 30, 30 days, 180) + HuiMath.lateFee(80 * U, 1000, 30, 30 days, 180)
        );
        assertGt(real.lateFeeOf(_M(4), 2), 0);
        assertEq(real.lateFeeOf(_M(1), 2), 0);
        _assertParity();

        // the real circle talked to the real registry through the factory
        assertEq(registry.reputationOf(_M(4)).late, 1);
        assertEq(registry.reputationOf(_M(1)).onTime, 1);
        assertEq(registry.reputationOf(_M(2)).onTime, 2);
        _assertLedger(real);
    }

    function test_Lens_ParityWhilePausedAndAfterPauseShift() public {
        _settleBoth();
        vm.warp(c.deadline(2) - 100);
        vm.prank(admin);
        factory.pauseCircle(address(c));
        vm.prank(admin);
        realFactory.pauseCircle(address(real));
        assertEq(uint8(real.state()), uint8(CircleState.Paused));
        assertEq(uint8(real.phase()), uint8(c.phase()), "views keep working while paused");
        vm.warp(_now() + 700);
        vm.prank(admin);
        factory.unpauseCircle(address(c));
        vm.prank(admin);
        realFactory.unpauseCircle(address(real));
        assertEq(real.pausedTotal(), 700);
        _assertParity();
        assertEq(real.roundStart(2), c.roundStart(2));
    }

    // ================================================================== fallback behaviour

    function test_Fallback_UnknownSelectorReverts() public {
        (bool ok, bytes memory ret) = address(real).call(abi.encodeWithSignature("doesNotExist()"));
        assertFalse(ok);
        assertEq(ret.length, 0, "the lens has no fallback, so there is nothing to bubble up");
        (ok,) = address(real).call(hex"deadbeef");
        assertFalse(ok);
        (ok,) = address(real).call(hex"00");
        assertFalse(ok, "short calldata does not fall into a no-op");
        (ok,) = address(real).call("");
        assertFalse(ok, "empty calldata neither");
    }

    function test_Fallback_PlainEtherIsRejected() public {
        vm.deal(address(this), 3 ether);
        (bool ok,) = address(real).call{value: 1 ether}("");
        assertFalse(ok, "no receive()");
        (ok,) = address(real).call{value: 1 ether}(abi.encodeWithSelector(real.params.selector));
        assertFalse(ok, "fallback is not payable, also for a known lens selector");
        (ok,) = address(real).call{value: 1 ether}(hex"deadbeef");
        assertFalse(ok);
        assertEq(address(real).balance, 0);
    }

    function test_Fallback_BubblesUpTheLensRevertData() public {
        vm.expectRevert(stdError.arithmeticError);
        real.exposure(6); // k > N: HuiMath underflow inside the delegated view
    }

    function test_Fallback_ViewsReadTheCirclesOwnStorageNotTheLens() public view {
        assertEq(real.members().length, 5);
        assertEq(lens.members().length, 0);
        assertEq(real.params().memberCount, 5);
        assertEq(lens.params().memberCount, 0);
    }

    // ================================================================== constructor and size

    function test_Constructor_RevertsWithoutALens() public {
        vm.expectRevert(HuiCircle.LensNotDeployed.selector);
        new HuiCircle(address(forwarder), address(0));
        vm.expectRevert(HuiCircle.LensNotDeployed.selector);
        new HuiCircle(address(forwarder), makeAddr("eoa"));
    }

    function test_Constructor_StoresLensAndForwarder_ImplementationIsInert() public {
        assertEq(realImpl.lens(), address(lens));
        assertEq(real.trustedForwarder(), address(forwarder));
        // the clone shares the implementation's immutable lens
        assertEq(HuiCircle(address(real)).lens(), address(lens));
        // the implementation itself cannot be initialized (docs/05: _disableInitializers)
        CircleParams memory p = _params();
        FactoryConfig memory conf = realFactory.config();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        realImpl.initialize(organizer, p, conf);
    }

    function test_ImplementationFitsEip170() public view {
        assertLt(address(realImpl).code.length, 24_576, "HuiCircle runtime size, EIP-170");
        assertLt(address(lens).code.length, 24_576, "HuiCircleLens runtime size");
        assertEq(address(real).code.length, 45, "EIP-1167 clone");
    }

    // ================================================================== the lens contract itself is inert

    function test_Lens_DirectCallsJustReadEmptyStorage() public view {
        assertEq(lens.members().length, 0);
        assertEq(lens.params().memberCount, 0);
        assertEq(lens.params().contribution, 0);
        assertEq(lens.memberInfo(_M(1)).debt, 0);
        assertFalse(lens.memberInfo(_M(1)).joined);
        assertEq(uint8(lens.phase()), uint8(RoundPhase.NotStarted));
        assertEq(lens.roundStart(1), 0);
        assertEq(lens.deadline(1), 0);
        assertEq(lens.maxBid(1), 0);
        assertEq(lens.maxExposure(), 0);
        assertEq(lens.coverageIndexBps(), 10_000, "O_max = 0: full coverage by definition of HuiMath");
        assertEq(lens.lateFeeOf(_M(1), 1), 0);
        assertEq(lens.dueOf(_M(1), 1, 0), 0);
        assertEq(lens.roundInfo(1).pot, 0);
        assertEq(lens.shortfallOf(1, _M(1)).amount, 0);
        assertEq(lens.commitOf(1, _M(1)).commitIndex, 0);
    }

    function test_Lens_DirectCallsRevertOnOutOfDomainInputs() public {
        vm.expectRevert(stdError.arithmeticError);
        lens.exposure(1); // k > N = 0
    }

    function test_Lens_HasNoWriteEntryPointsAndNoFallback() public {
        // the circle's state-changing selectors do not exist on the lens, and it has no fallback or receive
        bytes4[8] memory sels = [
            HuiCircle.settleRound.selector,
            HuiCircle.claim.selector,
            HuiCircle.finalize.selector,
            HuiCircle.activate.selector,
            HuiCircle.pause.selector,
            HuiCircle.unpause.selector,
            HuiCircle.emergencyUnwind.selector,
            HuiCircle.leave.selector
        ];
        for (uint256 i = 0; i < sels.length; i++) {
            (bool ok,) = address(lens).call(abi.encodeWithSelector(sels[i]));
            assertFalse(ok);
        }
        vm.deal(address(this), 1 ether);
        (bool sent,) = address(lens).call{value: 1 wei}("");
        assertFalse(sent);
        assertEq(address(lens).balance, 0);
        assertEq(usdc.balanceOf(address(lens)), 0);
    }

    function test_Lens_CannotBeInitialized() public {
        // `initialize` is not defined on the lens; and its own _disableInitializers closed the door in any case
        (bool ok,) = address(lens)
            .call(abi.encodeWithSelector(HuiCircle.initialize.selector, organizer, _params(), realFactory.config()));
        assertFalse(ok);
    }
}
