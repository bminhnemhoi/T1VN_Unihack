// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {BaseTest} from "../utils/BaseTest.sol";
import {StubCircle} from "../utils/StubCircle.sol";
import {HuiCircle} from "../../src/HuiCircle.sol";
import {HuiCircleLens} from "../../src/HuiCircleLens.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {IHuiFactory} from "../../src/interfaces/IHuiFactory.sol";
import {CircleMode, CircleParams, CircleState, FactoryConfig} from "../../src/libraries/HuiTypes.sol";

contract HuiFactoryTest is BaseTest {
    HuiCircle internal impl;
    HuiCircleLens internal lens;
    HuiFactory internal factory;
    FactoryConfig internal cfg;

    address internal reputation = makeAddr("reputation");
    address internal attester = makeAddr("attester");
    address internal stranger = makeAddr("stranger");

    function setUp() public override {
        super.setUp();
        vm.etch(reputation, hex"00"); // the factory requires code at the registry address (audit I-03)
        cfg = FactoryConfig({
            usdc: address(usdc),
            forwarder: address(forwarder),
            reputation: reputation,
            attester: attester,
            maxCapBps: 2000,
            lateRateBps: 1000,
            minCoverageBps: 5000,
            maxFeeBps: 300,
            maxReserveBps: 300,
            minMembers: 3,
            maxMembers: 30,
            maxContribution: uint96(10_000 * USDC)
        });
        lens = new HuiCircleLens();
        impl = new HuiCircle(address(forwarder), address(lens));
        factory = new HuiFactory(admin, address(impl), cfg);
    }

    /// @dev Worked-example circle of docs/03 section 8, with a valid join deadline.
    function _params() internal view returns (CircleParams memory p) {
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
            label: bytes32("demo")
        });
    }

    function _create(CircleParams memory p) internal returns (address circle) {
        vm.prank(organizer);
        circle = factory.createCircle(p);
    }

    function _expectInvalid(CircleParams memory p, uint8 code) internal {
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.InvalidParams.selector, code));
        factory.createCircle(p);
    }

    // ================================================================ constructor

    function test_Constructor_StoresState() public view {
        assertEq(factory.admin(), admin);
        assertEq(factory.implementation(), address(impl));
        assertEq(factory.trustedForwarder(), address(forwarder));
        FactoryConfig memory c = factory.config();
        assertEq(c.usdc, address(usdc));
        assertEq(c.forwarder, address(forwarder));
        assertEq(c.reputation, reputation);
        assertEq(c.attester, attester);
        assertEq(c.maxCapBps, 2000);
        assertEq(c.lateRateBps, 1000);
        assertEq(c.minCoverageBps, 5000);
        assertEq(c.maxFeeBps, 300);
        assertEq(c.maxReserveBps, 300);
        assertEq(c.minMembers, 3);
        assertEq(c.maxMembers, 30);
        assertEq(c.maxContribution, 10_000 * USDC);
        assertEq(factory.allCircles().length, 0);
    }

    function test_Constructor_EmitsConfigUpdated() public {
        vm.expectEmit(false, false, false, true); // emitter is unknown before deploy; topic and data are checked
        emit IHuiFactory.ConfigUpdated(cfg);
        new HuiFactory(admin, address(impl), cfg);
    }

    function test_Constructor_RevertsOnZeroAdminOrImplementation() public {
        vm.expectRevert(HuiFactory.ZeroAddress.selector);
        new HuiFactory(address(0), address(impl), cfg);
        vm.expectRevert(HuiFactory.ZeroAddress.selector);
        new HuiFactory(admin, address(0), cfg);
    }

    function test_Constructor_RevertsOnZeroConfigAddresses() public {
        FactoryConfig memory c = cfg;
        c.usdc = address(0);
        vm.expectRevert(HuiFactory.ZeroAddress.selector);
        new HuiFactory(admin, address(impl), c);

        c = cfg;
        c.reputation = address(0);
        vm.expectRevert(HuiFactory.ZeroAddress.selector);
        new HuiFactory(admin, address(impl), c);

        c = cfg;
        c.attester = address(0);
        vm.expectRevert(HuiFactory.ZeroAddress.selector);
        new HuiFactory(admin, address(impl), c);
    }

    function test_Constructor_RevertsOnZeroForwarder() public {
        FactoryConfig memory c = cfg;
        c.forwarder = address(0);
        vm.expectRevert(HuiFactory.ZeroAddress.selector);
        new HuiFactory(admin, address(impl), c);
    }

    // ================================================================ createCircle: happy path

    function test_CreateCircle_RegistersAndInitializes() public {
        CircleParams memory p = _params();

        vm.expectEmit(false, true, false, true); // circle address unknown beforehand
        emit IHuiFactory.CircleCreated(
            address(0), organizer, CircleMode.Bidding, 5, uint96(100 * USDC), bytes32("demo")
        );
        address circle = _create(p);

        assertTrue(factory.isCircle(circle));
        assertFalse(factory.isCircle(stranger));
        assertEq(factory.allCircles().length, 1);
        assertEq(factory.allCircles()[0], circle);
        assertEq(factory.circlesOf(organizer).length, 1);
        assertEq(factory.circlesOf(organizer)[0], circle);
        assertEq(factory.circlesOf(stranger).length, 0);
        assertEq(factory.activeCirclesOf(organizer), 0);

        HuiCircle c = HuiCircle(circle);
        assertEq(address(c.factory()), address(factory));
        assertEq(c.organizer(), organizer);
        assertEq(address(c.usdc()), address(usdc));
        assertEq(c.reputation(), reputation);
        assertEq(c.attester(), attester);
        assertEq(c.lateRateBps(), 1000);
        assertEq(c.minCoverageBps(), 5000);
        assertEq(uint8(c.state()), uint8(CircleState.Forming));
        assertEq(c.trustedForwarder(), address(forwarder));

        CircleParams memory got = IHuiCircle(address(c)).params();
        assertEq(uint8(got.mode), uint8(p.mode));
        assertEq(got.memberCount, p.memberCount);
        assertEq(got.contribution, p.contribution);
        assertEq(got.periodSeconds, p.periodSeconds);
        assertEq(got.roundDuration, p.roundDuration);
        assertEq(got.commitWindow, p.commitWindow);
        assertEq(got.revealWindow, p.revealWindow);
        assertEq(got.graceSeconds, p.graceSeconds);
        assertEq(got.alphaBps, p.alphaBps);
        assertEq(got.commissionMode, p.commissionMode);
        assertEq(got.feeBps, p.feeBps);
        assertEq(got.reserveBps, p.reserveBps);
        assertEq(got.revealBondBps, p.revealBondBps);
        assertEq(got.capBps, p.capBps);
        assertEq(got.joinDeadline, p.joinDeadline);
        assertEq(got.organizerIsMember, p.organizerIsMember);
        assertEq(got.label, p.label);
    }

    function test_CreateCircle_IsEip1167Clone() public {
        address circle = _create(_params());
        bytes memory code = circle.code;
        assertEq(code.length, 45);
        // 363d3d373d3d3d363d73 <impl> 5af43d82803e903d91602b57fd5bf3
        bytes memory expected =
            abi.encodePacked(hex"363d3d373d3d3d363d73", address(impl), hex"5af43d82803e903d91602b57fd5bf3");
        assertEq(keccak256(code), keccak256(expected));
    }

    function test_CreateCircle_CloneCannotBeReinitialized() public {
        address circle = _create(_params());
        FactoryConfig memory c = factory.config();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        HuiCircle(circle).initialize(stranger, _params(), c);
    }

    function test_Implementation_CannotBeInitialized() public {
        FactoryConfig memory c = factory.config();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        impl.initialize(stranger, _params(), c);
    }

    function test_CreateCircle_MultipleCirclesAndOrganizers() public {
        address a = _create(_params());
        address b = _create(_params());
        vm.prank(stranger);
        address c = factory.createCircle(_params());

        assertTrue(a != b && b != c && a != c);
        address[] memory all = factory.allCircles();
        assertEq(all.length, 3);
        assertEq(factory.circlesOf(organizer).length, 2);
        assertEq(factory.circlesOf(stranger).length, 1);
        assertEq(HuiCircle(c).organizer(), stranger);
    }

    function test_CreateCircle_ViaForwarder_OrganizerIsSigner() public {
        address signer = actors[0];
        bytes memory data = abi.encodeCall(IHuiFactory.createCircle, (_params()));
        _forward(signer, address(factory), data);

        address[] memory mine = factory.circlesOf(signer);
        assertEq(mine.length, 1);
        assertEq(HuiCircle(mine[0]).organizer(), signer);
        assertEq(factory.circlesOf(address(this)).length, 0); // relayer is not the organizer
        assertEq(factory.circlesOf(address(forwarder)).length, 0);
    }

    function test_CreateCircle_GasBudget() public {
        CircleParams memory p = _params();
        vm.prank(organizer);
        uint256 g = gasleft();
        factory.createCircle(p);
        uint256 used = g - gasleft();
        emit log_named_uint("createCircle gas", used);
        assertLe(used, 500_000); // docs/04 section 7.1
    }

    // ================================================================ createCircle: boundaries accepted

    function test_CreateCircle_AcceptsBoundaryValues() public {
        CircleParams memory p = _params();
        p.memberCount = 3;
        _create(p);
        p.memberCount = 30;
        _create(p);

        p = _params();
        p.contribution = uint96(1 * USDC);
        _create(p);
        p.contribution = uint96(10_000 * USDC);
        _create(p);

        p = _params();
        p.periodSeconds = 1 days;
        _create(p);
        p.periodSeconds = 31 days;
        _create(p);

        p = _params();
        p.roundDuration = 120;
        p.commitWindow = 60;
        p.revealWindow = 60; // sum == roundDuration
        p.graceSeconds = 119; // strictly below roundDuration
        _create(p);
        p.commitWindow = 30;
        p.revealWindow = 30;
        _create(p);

        p = _params();
        p.graceSeconds = 60;
        _create(p);

        p = _params();
        p.alphaBps = 0;
        _create(p);
        p.alphaBps = 10_000;
        _create(p);

        p = _params();
        p.feeBps = 300;
        p.reserveBps = 300;
        p.revealBondBps = 500;
        _create(p);

        p = _params();
        p.capBps = 0;
        _create(p);

        p = _params();
        p.joinDeadline = uint64(block.timestamp + 1);
        _create(p);
    }

    function test_CreateCircle_FixedModeWithZeroWindows() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 0;
        p.revealWindow = 0;
        address circle = _create(p);
        assertEq(uint8(IHuiCircle(circle).params().mode), uint8(CircleMode.Fixed));
    }

    function test_CreateCircle_NonCommissionWithZeroFee() public {
        CircleParams memory p = _params();
        p.commissionMode = false;
        p.feeBps = 0;
        _create(p);
    }

    // ================================================================ createCircle: InvalidParams 1..13

    function test_InvalidParams_1_MemberCount() public {
        CircleParams memory p = _params();
        p.memberCount = 2;
        _expectInvalid(p, 1);
        p.memberCount = 0;
        _expectInvalid(p, 1);
        p.memberCount = 31;
        _expectInvalid(p, 1);
    }

    function test_InvalidParams_1_RespectsConfigRange() public {
        FactoryConfig memory c = cfg;
        c.minMembers = 5;
        c.maxMembers = 10;
        vm.prank(admin);
        factory.setConfig(c);

        CircleParams memory p = _params();
        p.memberCount = 4;
        _expectInvalid(p, 1);
        p.memberCount = 11;
        _expectInvalid(p, 1);
        p.memberCount = 5;
        _create(p);
        p.memberCount = 10;
        _create(p);
    }

    function test_InvalidParams_2_Contribution() public {
        CircleParams memory p = _params();
        p.contribution = 0;
        _expectInvalid(p, 2);
        p.contribution = uint96(10_000 * USDC + 1); // above maxContribution
        _expectInvalid(p, 2);
        p.contribution = uint96(1 * USDC - 1); // docs/03 section 3.1: at least 1 USDC
        _expectInvalid(p, 2);
    }

    function test_InvalidParams_3_PeriodSeconds() public {
        CircleParams memory p = _params();
        p.periodSeconds = 1 days - 1;
        _expectInvalid(p, 3);
        p.periodSeconds = 0;
        _expectInvalid(p, 3);
        p.periodSeconds = 31 days + 1;
        _expectInvalid(p, 3);
    }

    function test_InvalidParams_4_RoundDuration() public {
        CircleParams memory p = _params();
        p.roundDuration = 119;
        _expectInvalid(p, 4);
        p.roundDuration = 0;
        _expectInvalid(p, 4);
    }

    function test_InvalidParams_5_BiddingWindows() public {
        CircleParams memory p = _params();
        p.commitWindow = 29;
        _expectInvalid(p, 5);

        p = _params();
        p.revealWindow = 29;
        _expectInvalid(p, 5);

        p = _params();
        p.commitWindow = 0;
        p.revealWindow = 0; // Bidding needs real windows
        _expectInvalid(p, 5);

        p = _params();
        p.commitWindow = 100;
        p.revealWindow = 81; // 181 > roundDuration 180
        _expectInvalid(p, 5);
    }

    function test_InvalidParams_5_WindowSumDoesNotOverflow() public {
        CircleParams memory p = _params();
        p.commitWindow = type(uint32).max;
        p.revealWindow = type(uint32).max;
        _expectInvalid(p, 5);
    }

    function test_InvalidParams_6_FixedWithWindows() public {
        CircleParams memory p = _params();
        p.mode = CircleMode.Fixed;
        p.commitWindow = 1;
        p.revealWindow = 0;
        _expectInvalid(p, 6);

        p.commitWindow = 0;
        p.revealWindow = 1;
        _expectInvalid(p, 6);

        p.commitWindow = 90;
        p.revealWindow = 60;
        _expectInvalid(p, 6);
    }

    function test_InvalidParams_7_GraceSeconds() public {
        CircleParams memory p = _params();
        p.graceSeconds = 59;
        _expectInvalid(p, 7);
        p.graceSeconds = 0;
        _expectInvalid(p, 7);
    }

    function test_InvalidParams_8_AlphaBps() public {
        CircleParams memory p = _params();
        p.alphaBps = 10_001;
        _expectInvalid(p, 8);
        p.alphaBps = type(uint16).max;
        _expectInvalid(p, 8);
    }

    function test_InvalidParams_9_FeeBps() public {
        CircleParams memory p = _params();
        p.feeBps = 301; // above maxFeeBps
        _expectInvalid(p, 9);

        p = _params();
        p.commissionMode = false;
        p.feeBps = 1; // fee without commission mode
        _expectInvalid(p, 9);
    }

    function test_InvalidParams_10_ReserveBps() public {
        CircleParams memory p = _params();
        p.reserveBps = 301;
        _expectInvalid(p, 10);
    }

    function test_InvalidParams_11_RevealBondBps() public {
        CircleParams memory p = _params();
        p.revealBondBps = 501;
        _expectInvalid(p, 11);
    }

    function test_InvalidParams_12_CapBps() public {
        CircleParams memory p = _params();
        p.capBps = 2001;
        _expectInvalid(p, 12);
    }

    function test_InvalidParams_13_JoinDeadline() public {
        CircleParams memory p = _params();
        p.joinDeadline = uint64(block.timestamp); // not strictly in the future
        _expectInvalid(p, 13);
        p.joinDeadline = 0;
        _expectInvalid(p, 13);
        vm.warp(block.timestamp + 10 days);
        p.joinDeadline = uint64(block.timestamp - 1);
        _expectInvalid(p, 13);
    }

    function test_InvalidParams_14_GraceMustBeShorterThanTheRound() public {
        // audit M-02: a late payment of round k must run out of grace before round k + 1 can settle
        CircleParams memory p = _params();
        p.graceSeconds = p.roundDuration; // 180 == 180
        _expectInvalid(p, 14);
        p.graceSeconds = p.roundDuration + 1;
        _expectInvalid(p, 14);
        p.graceSeconds = 172_800; // the real-life default needs a real-life round (30 days)
        _expectInvalid(p, 14);

        // one second shorter is fine, also at the smallest legal round
        p = _params();
        p.graceSeconds = p.roundDuration - 1;
        _create(p);
        p = _params();
        p.roundDuration = 120;
        p.commitWindow = 60;
        p.revealWindow = 60;
        p.graceSeconds = 119;
        _create(p);
        p.graceSeconds = 120;
        _expectInvalid(p, 14);

        p = _params();
        p.roundDuration = 30 days;
        p.commitWindow = 28 days;
        p.revealWindow = 1 days;
        p.graceSeconds = 172_800;
        _create(p); // docs/03 section 3.1 real-life defaults
    }

    function test_InvalidParams_14_IsCheckedAfter13() public {
        CircleParams memory p = _params();
        p.joinDeadline = uint64(block.timestamp); // code 13
        p.graceSeconds = p.roundDuration; // code 14
        _expectInvalid(p, 13);
    }

    function test_InvalidParams_FirstFailureInTableOrderWins() public {
        CircleParams memory p = _params();
        p.memberCount = 2; // code 1
        p.alphaBps = 10_001; // code 8
        _expectInvalid(p, 1);
    }

    function test_InvalidParams_NothingRegisteredOnRevert() public {
        CircleParams memory p = _params();
        p.alphaBps = 10_001;
        _expectInvalid(p, 8);
        assertEq(factory.allCircles().length, 0);
        assertEq(factory.circlesOf(organizer).length, 0);
    }

    function testFuzz_CreateCircle_ValidSpaceAlwaysSucceeds(
        uint8 n,
        uint96 c,
        uint32 period,
        uint32 round,
        uint32 commitW,
        uint32 grace,
        uint16 alpha,
        uint16 fee,
        uint16 reserveBps,
        uint16 bond,
        uint16 cap
    ) public {
        CircleParams memory p = _params();
        p.memberCount = uint8(bound(n, 3, 30));
        p.contribution = uint96(bound(c, 1 * USDC, 10_000 * USDC));
        p.periodSeconds = uint32(bound(period, 1 days, 31 days));
        p.roundDuration = uint32(bound(round, 120, 31 days));
        p.commitWindow = uint32(bound(commitW, 30, p.roundDuration - 30));
        p.revealWindow = uint32(bound(uint256(p.roundDuration) - p.commitWindow, 30, p.roundDuration - p.commitWindow));
        p.graceSeconds = uint32(bound(grace, 60, p.roundDuration - 1));
        p.alphaBps = uint16(bound(alpha, 0, 10_000));
        p.feeBps = uint16(bound(fee, 0, 300));
        p.reserveBps = uint16(bound(reserveBps, 0, 300));
        p.revealBondBps = uint16(bound(bond, 0, 500));
        p.capBps = uint16(bound(cap, 0, 2000));
        address circle = _create(p);
        assertTrue(factory.isCircle(circle));
    }

    function testFuzz_CreateCircle_MemberCountOutsideRangeReverts(uint8 n) public {
        vm.assume(n < 3 || n > 30);
        CircleParams memory p = _params();
        p.memberCount = n;
        _expectInvalid(p, 1);
    }

    // ================================================================ setConfig

    function test_SetConfig_OnlyAdmin() public {
        FactoryConfig memory c = cfg;
        c.lateRateBps = 500;
        vm.prank(stranger);
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        factory.setConfig(c);

        vm.prank(organizer);
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        factory.setConfig(c);
    }

    function test_SetConfig_UpdatesAndEmits() public {
        FactoryConfig memory c = cfg;
        c.lateRateBps = 500;
        c.minCoverageBps = 6000;
        c.attester = makeAddr("attester2");

        vm.expectEmit(address(factory));
        emit IHuiFactory.ConfigUpdated(c);
        vm.prank(admin);
        factory.setConfig(c);

        FactoryConfig memory got = factory.config();
        assertEq(got.lateRateBps, 500);
        assertEq(got.minCoverageBps, 6000);
        assertEq(got.attester, c.attester);
    }

    function test_SetConfig_AppliesOnlyToCirclesCreatedAfter() public {
        address oldCircle = _create(_params());

        FactoryConfig memory c = cfg;
        c.lateRateBps = 500;
        c.minCoverageBps = 6000;
        vm.prank(admin);
        factory.setConfig(c);

        address newCircle = _create(_params());

        assertEq(HuiCircle(oldCircle).lateRateBps(), 1000);
        assertEq(HuiCircle(oldCircle).minCoverageBps(), 5000);
        assertEq(HuiCircle(newCircle).lateRateBps(), 500);
        assertEq(HuiCircle(newCircle).minCoverageBps(), 6000);
    }

    function test_SetConfig_AffectsValidationOfNewCircles() public {
        FactoryConfig memory c = cfg;
        c.maxCapBps = 1000;
        vm.prank(admin);
        factory.setConfig(c);

        CircleParams memory p = _params(); // capBps 2000 > 1000
        _expectInvalid(p, 12);
    }

    function test_SetConfig_RevertsOnForwarderChange() public {
        FactoryConfig memory c = cfg;
        c.forwarder = makeAddr("otherForwarder");
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);
    }

    function test_SetConfig_RevertsOnZeroAddresses() public {
        FactoryConfig memory c = cfg;
        c.usdc = address(0);
        vm.prank(admin);
        vm.expectRevert(HuiFactory.ZeroAddress.selector);
        factory.setConfig(c);
    }

    function test_SetConfig_RevertsOnBpsAbove10000() public {
        FactoryConfig memory c = cfg;
        c.lateRateBps = 10_001;
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);

        c = cfg;
        c.maxCapBps = 10_001;
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);
    }

    function test_SetConfig_RevertsAboveSpecHardCaps() public {
        FactoryConfig memory c = factory.config();
        c.maxFeeBps = 301;
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);

        c = factory.config();
        c.maxReserveBps = 301;
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);

        c = factory.config();
        c.maxCapBps = 2001;
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);

        c = factory.config();
        c.lateRateBps = 1001;
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);
    }

    function test_Constructor_RevertsAboveSpecHardCaps() public {
        FactoryConfig memory c = cfg;
        c.maxFeeBps = 10_000;
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        new HuiFactory(admin, address(impl), c);
    }

    function test_Constructor_RevertsWhenReputationHasNoCode() public {
        // Circles call the registry inside `try`; a codeless address would make every call silently "succeed".
        FactoryConfig memory c = cfg;
        c.reputation = makeAddr("eoaRegistry");
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        new HuiFactory(admin, address(impl), c);
    }

    function test_SetConfig_RevertsWhenReputationHasNoCode() public {
        FactoryConfig memory c = cfg;
        c.reputation = makeAddr("eoaRegistry");
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);

        c.reputation = address(0); // zero stays its own error
        vm.prank(admin);
        vm.expectRevert(HuiFactory.ZeroAddress.selector);
        factory.setConfig(c);

        c.reputation = address(this); // any contract is accepted
        vm.prank(admin);
        factory.setConfig(c);
        assertEq(factory.config().reputation, address(this));
    }

    function test_Constructor_RevertsOnImplementationForwarderMismatch() public {
        HuiCircle other = new HuiCircle(makeAddr("otherForwarder"), address(lens));
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        new HuiFactory(admin, address(other), cfg);
    }

    function test_SetConfig_RevertsOnBadMemberBounds() public {
        FactoryConfig memory c = cfg;
        c.maxMembers = 31; // loop bound
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);

        c = cfg;
        c.minMembers = 2;
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);

        c = cfg;
        c.minMembers = 10;
        c.maxMembers = 9;
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);
    }

    function test_SetConfig_RevertsWhenMaxContributionBelowMinimum() public {
        FactoryConfig memory c = cfg;
        c.maxContribution = uint96(1 * USDC - 1);
        vm.prank(admin);
        vm.expectRevert(HuiFactory.InvalidConfig.selector);
        factory.setConfig(c);
    }

    // ================================================================ onActivated / onFinished

    function _stubFactory() internal returns (HuiFactory f, StubCircle stubImpl) {
        stubImpl = new StubCircle(address(forwarder));
        f = new HuiFactory(admin, address(stubImpl), cfg);
    }

    function _createStub(HuiFactory f) internal returns (StubCircle) {
        vm.prank(organizer);
        return StubCircle(f.createCircle(_params()));
    }

    function test_ActiveCircles_IncrementAndDecrement() public {
        (HuiFactory f,) = _stubFactory();
        StubCircle a = _createStub(f);
        StubCircle b = _createStub(f);

        assertEq(f.activeCirclesOf(organizer), 0);
        a.notifyActivated();
        assertEq(f.activeCirclesOf(organizer), 1);
        b.notifyActivated();
        assertEq(f.activeCirclesOf(organizer), 2);
        a.notifyFinished();
        assertEq(f.activeCirclesOf(organizer), 1);
        b.notifyFinished();
        assertEq(f.activeCirclesOf(organizer), 0);
    }

    function test_OnActivated_RevertsForNonCircle() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.NotCircle.selector, stranger));
        factory.onActivated(organizer);

        vm.prank(admin); // even the admin is not a circle
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.NotCircle.selector, admin));
        factory.onFinished(organizer);
    }

    function test_OnFinished_RevertsBeforeOnActivated() public {
        (HuiFactory f,) = _stubFactory();
        StubCircle a = _createStub(f);
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.NotActivated.selector, address(a)));
        a.notifyFinished();
        assertEq(f.activeCirclesOf(organizer), 0);
    }

    function test_OnFinished_TwiceRevertsAndDoesNotTouchTheCounter() public {
        (HuiFactory f,) = _stubFactory();
        StubCircle a = _createStub(f);
        StubCircle b = _createStub(f);
        a.notifyActivated();
        b.notifyActivated();
        assertEq(f.activeCirclesOf(organizer), 2);
        a.notifyFinished();
        assertEq(f.activeCirclesOf(organizer), 1);
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.NotActivated.selector, address(a)));
        a.notifyFinished(); // would otherwise eat the slot of circle b
        assertEq(f.activeCirclesOf(organizer), 1);
        b.notifyFinished();
        assertEq(f.activeCirclesOf(organizer), 0);
    }

    function test_OnActivated_TwiceFromTheSameCircleReverts() public {
        (HuiFactory f,) = _stubFactory();
        StubCircle a = _createStub(f);
        a.notifyActivated();
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.AlreadyActivated.selector, address(a)));
        a.notifyActivated();
        assertEq(f.activeCirclesOf(organizer), 1, "counted once");
    }

    function test_OnActivated_EachCircleCountsOnce_PerOrganizer() public {
        (HuiFactory f,) = _stubFactory();
        address other = makeAddr("otherOrganizer");
        StubCircle a = _createStub(f);
        vm.prank(other);
        StubCircle b = StubCircle(f.createCircle(_params()));
        a.notifyActivated();
        b.notifyActivated();
        assertEq(f.activeCirclesOf(organizer), 1);
        assertEq(f.activeCirclesOf(other), 1);
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.AlreadyActivated.selector, address(b)));
        b.notifyActivated();
        assertEq(f.activeCirclesOf(other), 1);
    }

    function test_ActiveCircles_CircleOfAnotherFactoryCannotCall() public {
        (HuiFactory other,) = _stubFactory();
        StubCircle foreign = _createStub(other);
        vm.prank(address(foreign));
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.NotCircle.selector, address(foreign)));
        factory.onActivated(organizer);
    }

    // ================================================================ pause / unpause / unwind

    function test_PauseUnpauseUnwind_AdminDelegatesToCircle() public {
        (HuiFactory f,) = _stubFactory();
        StubCircle c = _createStub(f);

        vm.startPrank(admin);
        vm.expectEmit(address(f));
        emit IHuiFactory.CirclePausedByAdmin(address(c));
        f.pauseCircle(address(c));

        vm.expectEmit(address(f));
        emit IHuiFactory.CircleUnpausedByAdmin(address(c));
        f.unpauseCircle(address(c));

        f.unwindCircle(address(c));
        vm.stopPrank();

        assertEq(c.pauseCalls(), 1);
        assertEq(c.unpauseCalls(), 1);
        assertEq(c.unwindCalls(), 1);
    }

    function test_PauseUnpauseUnwind_OnlyAdmin() public {
        (HuiFactory f,) = _stubFactory();
        StubCircle c = _createStub(f);

        vm.startPrank(organizer); // not even the organizer
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        f.pauseCircle(address(c));
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        f.unpauseCircle(address(c));
        vm.expectRevert(HuiFactory.NotAdmin.selector);
        f.unwindCircle(address(c));
        vm.stopPrank();

        assertEq(c.pauseCalls(), 0);
        assertEq(c.unpauseCalls(), 0);
        assertEq(c.unwindCalls(), 0);
    }

    function test_PauseUnpauseUnwind_RevertForUnknownCircle() public {
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.NotCircle.selector, stranger));
        factory.pauseCircle(stranger);
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.NotCircle.selector, stranger));
        factory.unpauseCircle(stranger);
        vm.expectRevert(abi.encodeWithSelector(HuiFactory.NotCircle.selector, stranger));
        factory.unwindCircle(stranger);
        vm.stopPrank();
    }

    function test_Unwind_PropagatesCircleRevertTooEarly() public {
        (HuiFactory f,) = _stubFactory();
        StubCircle c = _createStub(f);
        c.setUnwindReverts(true);

        vm.prank(admin);
        vm.expectRevert(IHuiCircle.UnwindTooEarly.selector);
        f.unwindCircle(address(c));
    }

    function test_Admin_CannotMoveFunds_NoSuchFunction() public view {
        // The factory exposes no function that takes or sends tokens; it must never hold any.
        assertEq(usdc.balanceOf(address(factory)), 0);
        assertEq(address(factory).balance, 0);
    }

    // ================================================================ no multicall (ADR-06)

    function test_NoMulticallSelector() public {
        (bool ok,) = address(factory).call(abi.encodeWithSignature("multicall(bytes[])", new bytes[](0)));
        assertFalse(ok);
    }
}
