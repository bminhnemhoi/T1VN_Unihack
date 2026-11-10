// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "../utils/BaseTest.sol";
import {StubCircle} from "../utils/StubCircle.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {ReputationRegistry} from "../../src/ReputationRegistry.sol";
import {IReputationRegistry, Reputation} from "../../src/interfaces/IReputationRegistry.sol";
import {CircleMode, CircleParams, FactoryConfig} from "../../src/libraries/HuiTypes.sol";

/// @notice ReputationRegistry (docs/05 section 3.3): admin-once `setFactory`, circle-only writers, counters and
/// events. A real HuiFactory over a StubCircle implementation provides `isCircle`; the stub address is pranked as
/// the caller because the stub itself has no registry hooks.
contract ReputationRegistryTest is BaseTest {
    ReputationRegistry internal registry;
    HuiFactory internal factory;
    StubCircle internal circle;
    StubCircle internal otherCircle;

    address internal stranger = makeAddr("stranger");
    address internal member = makeAddr("member");
    address internal member2 = makeAddr("member2");

    function setUp() public override {
        super.setUp();
        registry = new ReputationRegistry(admin);
        (factory, circle) = _factoryWithCircle(registry);
        vm.prank(admin);
        registry.setFactory(address(factory));
    }

    // ------------------------------------------------------------------ helpers

    function _config(ReputationRegistry reg) internal returns (FactoryConfig memory) {
        return FactoryConfig({
            usdc: address(usdc),
            forwarder: address(forwarder),
            reputation: address(reg),
            attester: makeAddr("attester"),
            maxCapBps: 2000,
            lateRateBps: 1000,
            minCoverageBps: 5000,
            maxFeeBps: 300,
            maxReserveBps: 300,
            minMembers: 3,
            maxMembers: 30,
            maxContribution: uint96(10_000 * USDC)
        });
    }

    function _circleParams() internal view returns (CircleParams memory p) {
        p = CircleParams({
            mode: CircleMode.Bidding,
            memberCount: 5,
            contribution: uint96(100 * USDC),
            periodSeconds: 30 days,
            roundDuration: 180,
            commitWindow: 90,
            revealWindow: 60,
            graceSeconds: 120,
            alphaBps: 2000,
            commissionMode: true,
            feeBps: 100,
            reserveBps: 100,
            revealBondBps: 100,
            capBps: 2000,
            joinDeadline: uint64(block.timestamp + 7 days),
            organizerIsMember: false,
            label: bytes32("rep"),
            commissionShareBps: 0,
            termsHash: keccak256("huisafe-test-terms")
        });
    }

    function _factoryWithCircle(ReputationRegistry reg) internal returns (HuiFactory f, StubCircle c) {
        StubCircle stubImpl = new StubCircle(address(forwarder));
        f = new HuiFactory(admin, address(stubImpl), _config(reg));
        vm.prank(organizer);
        c = StubCircle(f.createCircle(_circleParams()));
    }

    function _recordAll(address caller, address m) internal {
        vm.startPrank(caller);
        registry.recordOnTime(m);
        registry.recordLate(m);
        registry.recordDefault(m);
        registry.recordRepaid(m);
        registry.recordCompleted(m);
        vm.stopPrank();
    }

    // ================================================================== constructor and setFactory

    function test_Constructor_StoresAdmin_FactoryUnset() public {
        assertEq(registry.admin(), admin);
        assertEq(registry.factory(), address(factory));
        ReputationRegistry fresh = new ReputationRegistry(admin);
        assertEq(fresh.factory(), address(0));
    }

    function test_Constructor_RevertsOnZeroAdmin() public {
        vm.expectRevert(ReputationRegistry.ZeroAddress.selector);
        new ReputationRegistry(address(0));
    }

    function test_SetFactory_OnlyAdmin() public {
        ReputationRegistry fresh = new ReputationRegistry(admin);
        vm.prank(stranger);
        vm.expectRevert(ReputationRegistry.NotAdmin.selector);
        fresh.setFactory(address(factory));
        assertEq(fresh.factory(), address(0));
    }

    function test_SetFactory_RevertsOnZeroAddress() public {
        ReputationRegistry fresh = new ReputationRegistry(admin);
        vm.prank(admin);
        vm.expectRevert(ReputationRegistry.ZeroAddress.selector);
        fresh.setFactory(address(0));
        assertEq(fresh.factory(), address(0), "a rejected call must not consume the one-shot");
    }

    function test_SetFactory_EmitsAndStores() public {
        ReputationRegistry fresh = new ReputationRegistry(admin);
        vm.expectEmit(address(fresh));
        emit IReputationRegistry.FactorySet(address(factory));
        vm.prank(admin);
        fresh.setFactory(address(factory));
        assertEq(fresh.factory(), address(factory));
    }

    function test_SetFactory_OnlyOnce() public {
        // Already set in setUp: a second call reverts, with the same or another address.
        vm.startPrank(admin);
        vm.expectRevert(ReputationRegistry.FactoryAlreadySet.selector);
        registry.setFactory(address(factory));
        vm.expectRevert(ReputationRegistry.FactoryAlreadySet.selector);
        registry.setFactory(makeAddr("otherFactory"));
        vm.stopPrank();
        assertEq(registry.factory(), address(factory));
    }

    function test_SetFactory_NonAdminCheckedBeforeAlreadySet() public {
        vm.prank(stranger);
        vm.expectRevert(ReputationRegistry.NotAdmin.selector);
        registry.setFactory(makeAddr("x"));
    }

    // ================================================================== access control

    function test_Record_RevertsBeforeSetFactory() public {
        ReputationRegistry fresh = new ReputationRegistry(admin);
        vm.startPrank(address(circle));
        vm.expectRevert(ReputationRegistry.FactoryNotSet.selector);
        fresh.recordOnTime(member);
        vm.expectRevert(ReputationRegistry.FactoryNotSet.selector);
        fresh.recordLate(member);
        vm.expectRevert(ReputationRegistry.FactoryNotSet.selector);
        fresh.recordDefault(member);
        vm.expectRevert(ReputationRegistry.FactoryNotSet.selector);
        fresh.recordRepaid(member);
        vm.expectRevert(ReputationRegistry.FactoryNotSet.selector);
        fresh.recordCompleted(member);
        vm.stopPrank();
        Reputation memory r = fresh.reputationOf(member);
        assertEq(r.onTime + r.late + r.defaults + r.repaid + r.completed, 0);
    }

    function test_Record_RevertsForNonCircle() public {
        address[3] memory callers = [stranger, admin, organizer];
        for (uint256 i = 0; i < callers.length; i++) {
            vm.startPrank(callers[i]);
            bytes memory err = abi.encodeWithSelector(ReputationRegistry.NotCircle.selector, callers[i]);
            vm.expectRevert(err);
            registry.recordOnTime(member);
            vm.expectRevert(err);
            registry.recordLate(member);
            vm.expectRevert(err);
            registry.recordDefault(member);
            vm.expectRevert(err);
            registry.recordRepaid(member);
            vm.expectRevert(err);
            registry.recordCompleted(member);
            vm.stopPrank();
        }
        Reputation memory r = registry.reputationOf(member);
        assertEq(r.onTime + r.late + r.defaults + r.repaid + r.completed, 0);
    }

    function test_Record_RevertsForCircleOfAnotherFactory() public {
        ReputationRegistry other = new ReputationRegistry(admin);
        (, StubCircle foreign) = _factoryWithCircle(other);
        // `foreign` is a circle, but of a factory this registry does not know.
        vm.prank(address(foreign));
        vm.expectRevert(abi.encodeWithSelector(ReputationRegistry.NotCircle.selector, address(foreign)));
        registry.recordOnTime(member);
    }

    function test_Record_RevertsForTheFactoryItself() public {
        vm.prank(address(factory));
        vm.expectRevert(abi.encodeWithSelector(ReputationRegistry.NotCircle.selector, address(factory)));
        registry.recordCompleted(member);
    }

    // ================================================================== counters and events

    function test_Record_EachKindIncrementsOnlyItsCounterAndEmits() public {
        address c = address(circle);
        bytes4[5] memory sel = [
            IReputationRegistry.recordOnTime.selector,
            IReputationRegistry.recordLate.selector,
            IReputationRegistry.recordDefault.selector,
            IReputationRegistry.recordRepaid.selector,
            IReputationRegistry.recordCompleted.selector
        ];
        bytes32[5] memory kind =
            [bytes32("onTime"), bytes32("late"), bytes32("default"), bytes32("repaid"), bytes32("completed")];
        for (uint256 i = 0; i < 5; i++) {
            Reputation memory before = registry.reputationOf(member);
            vm.expectEmit(true, true, false, true, address(registry));
            emit IReputationRegistry.ReputationUpdated(member, c, kind[i]);
            vm.prank(c);
            (bool ok,) = address(registry).call(abi.encodeWithSelector(sel[i], member));
            assertTrue(ok);
            Reputation memory afterRep = registry.reputationOf(member);
            assertEq(afterRep.onTime, before.onTime + (i == 0 ? 1 : 0), "onTime");
            assertEq(afterRep.late, before.late + (i == 1 ? 1 : 0), "late");
            assertEq(afterRep.defaults, before.defaults + (i == 2 ? 1 : 0), "defaults");
            assertEq(afterRep.repaid, before.repaid + (i == 3 ? 1 : 0), "repaid");
            assertEq(afterRep.completed, before.completed + (i == 4 ? 1 : 0), "completed");
        }
    }

    function test_Record_CountersArePerMember() public {
        _recordAll(address(circle), member);
        Reputation memory a = registry.reputationOf(member);
        Reputation memory b = registry.reputationOf(member2);
        assertEq(a.onTime, 1);
        assertEq(a.late, 1);
        assertEq(a.defaults, 1);
        assertEq(a.repaid, 1);
        assertEq(a.completed, 1);
        assertEq(b.onTime + b.late + b.defaults + b.repaid + b.completed, 0);
    }

    function test_Record_AccumulatesAcrossCircles() public {
        // A second circle of the same factory writes to the same wallet history.
        vm.prank(organizer);
        StubCircle second = StubCircle(factory.createCircle(_circleParams()));
        vm.prank(address(circle));
        registry.recordLate(member);
        vm.prank(address(second));
        registry.recordLate(member);
        assertEq(registry.reputationOf(member).late, 2);
    }

    function test_ReputationOf_UnknownWalletIsAllZero() public view {
        Reputation memory r = registry.reputationOf(stranger);
        assertEq(uint256(r.completed) + r.onTime + r.late + r.defaults + r.repaid, 0);
    }

    function testFuzz_Record_CountersMatchCallHistory(uint8[40] calldata ops) public {
        uint32[5] memory expected;
        for (uint256 i = 0; i < ops.length; i++) {
            uint8 op = ops[i] % 5;
            expected[op] += 1;
            vm.startPrank(address(circle));
            if (op == 0) registry.recordOnTime(member);
            else if (op == 1) registry.recordLate(member);
            else if (op == 2) registry.recordDefault(member);
            else if (op == 3) registry.recordRepaid(member);
            else registry.recordCompleted(member);
            vm.stopPrank();
        }
        Reputation memory r = registry.reputationOf(member);
        assertEq(r.onTime, expected[0]);
        assertEq(r.late, expected[1]);
        assertEq(r.defaults, expected[2]);
        assertEq(r.repaid, expected[3]);
        assertEq(r.completed, expected[4]);
    }
}
