// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {CircleFixture} from "../utils/CircleFixture.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {
    CircleMode,
    CircleParams,
    CircleState,
    FactoryConfig,
    MemberAttestation,
    MemberInfo,
    PermitSig
} from "../../src/libraries/HuiTypes.sol";

/// @notice C4: Forming flow of HuiCircle (docs/03 section 5.1). Every revert path, window edge and ledger check.
contract HuiCircleFormingTest is CircleFixture {
    HuiCircleHarness internal c;
    PermitSig internal noPermit = PermitSig({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)});

    function setUp() public override {
        super.setUp();
        c = _create(_params());
    }

    // ------------------------------------------------------------------ helpers

    /// @dev INV-01 with the terms that exist so far (no holdback, fee escrow yet).
    function _assertLedger() internal view {
        assertEq(
            usdc.balanceOf(address(c)),
            c.bondRemaining() + c.reserve() + c.revealBondsHeld() + c.totalClaimable(),
            "INV-01 ledger"
        );
    }

    function _members() internal view returns (address[] memory) {
        return c.members();
    }

    function _joinWith(address member, MemberAttestation memory att, bytes memory sig) internal {
        PermitSig memory permit = _signPermit(member, address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(member);
        c.join(att, sig, permit);
    }

    function _validAtt(address member) internal view returns (MemberAttestation memory att, bytes memory sig) {
        att = _attestation(member, address(c), uint64(block.timestamp + 1 hours));
        sig = _signAttestation(att, ATTESTER_KEY);
    }

    // ================================================================== initialization

    function test_Initial_State() public view {
        assertEq(uint8(c.state()), uint8(CircleState.Forming));
        assertEq(c.organizer(), organizer);
        assertEq(address(c.factory()), address(factory));
        assertEq(c.attester(), attester);
        assertEq(c.minCoverageBps(), 5000);
        assertEq(c.startTime(), 0);
        assertEq(_members().length, 0);
    }

    function test_Initialize_CannotRunTwice() public {
        FactoryConfig memory f = factory.config();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        c.initialize(organizer, _params(), f);
    }

    function test_Implementation_CannotBeInitialized() public {
        FactoryConfig memory f = factory.config();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        impl.initialize(organizer, _params(), f);
    }

    function test_Views_RequiredAllowanceAndCoverage() public {
        // (N - 1) * (C + 1% C) = 4 * 101 USDC
        assertEq(c.revealBond(), 1 * USDC);
        assertEq(c.requiredAllowance(), 404 * USDC);
        assertEq(c.maxExposure(), 600 * USDC);
        assertEq(c.guaranteedCoverageBps(), 2000, "alpha only without bond");
        _depositBond(c, 480 * USDC);
        assertEq(c.guaranteedCoverageBps(), 10_000, "docs/03 section 8: CI = 100%");
        assertEq(c.coverageIndexBps(), 10_000);
    }

    // ================================================================== depositBond

    function test_DepositBond_Accumulates() public {
        _depositBond(c, 300 * USDC);
        _depositBond(c, 180 * USDC);
        assertEq(c.bondDeposited(), 480 * USDC);
        assertEq(c.bondRemaining(), 480 * USDC);
        assertEq(usdc.balanceOf(address(c)), 480 * USDC);
        _assertLedger();
    }

    function test_DepositBond_EmitsEvent() public {
        _fund(organizer, 100 * USDC);
        vm.startPrank(organizer);
        usdc.approve(address(c), 100 * USDC);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.BondDeposited(organizer, 100 * USDC, 100 * USDC);
        c.depositBond(100 * USDC, noPermit);
        vm.stopPrank();
    }

    function test_DepositBond_WithPermit() public {
        // An actor with a known key organizes this circle so it can sign a permit.
        address org = actors[0];
        vm.prank(org);
        HuiCircleHarness c2 = HuiCircleHarness(factory.createCircle(_params()));
        _fund(org, 480 * USDC);
        PermitSig memory permit = _signPermit(org, address(c2), 480 * USDC, block.timestamp + 1 hours);
        vm.prank(org);
        c2.depositBond(480 * USDC, permit);
        assertEq(c2.bondRemaining(), 480 * USDC);
        assertEq(usdc.allowance(org, address(c2)), 0, "allowance fully consumed");
    }

    function test_DepositBond_PermitFrontRunStillWorks() public {
        address org = actors[0];
        vm.prank(org);
        HuiCircleHarness c2 = HuiCircleHarness(factory.createCircle(_params()));
        _fund(org, 100 * USDC);
        PermitSig memory permit = _signPermit(org, address(c2), 100 * USDC, block.timestamp + 1 hours);
        // Somebody else submits the permit first; the later call inside depositBond reverts and is tolerated.
        usdc.permit(org, address(c2), permit.value, permit.deadline, permit.v, permit.r, permit.s);
        vm.prank(org);
        c2.depositBond(100 * USDC, permit);
        assertEq(c2.bondRemaining(), 100 * USDC);
    }

    function test_DepositBond_RevertsWithoutAllowance() public {
        _fund(organizer, 100 * USDC);
        vm.prank(organizer);
        vm.expectRevert();
        c.depositBond(100 * USDC, noPermit);
        assertEq(c.bondRemaining(), 0);
    }

    function test_DepositBond_OnlyOrganizer() public {
        vm.prank(actors[1]);
        vm.expectRevert(IHuiCircle.NotOrganizer.selector);
        c.depositBond(1, noPermit);
    }

    function test_DepositBond_WrongStateAfterActivation() public {
        HuiCircleHarness a = _workedExample();
        _fund(organizer, 1 * USDC);
        vm.startPrank(organizer);
        usdc.approve(address(a), 1 * USDC);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Forming, CircleState.Active));
        a.depositBond(1 * USDC, noPermit);
        vm.stopPrank();
    }

    function test_DepositBond_WhilePaused() public {
        c.exposed_setState(CircleState.Paused);
        vm.prank(organizer);
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.depositBond(1, noPermit);
    }

    // ================================================================== join

    function test_Join_HappyPath() public {
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        _fund(actors[0], 1000 * USDC);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.MemberJoined(actors[0], 0, att.attestationId);
        _joinWith(actors[0], att, sig);

        MemberInfo memory mi = c.memberInfo(actors[0]);
        assertTrue(mi.joined);
        assertEq(mi.joinIndex, 0);
        assertFalse(mi.received);
        assertTrue(c.usedAttestation(att.attestationId));
        assertEq(usdc.allowance(actors[0], address(c)), c.requiredAllowance());
        assertEq(usdc.balanceOf(address(c)), 0, "joining moves no money");
    }

    function test_Join_AssignsIndexesInOrder() public {
        _joinN(c, 5);
        address[] memory m = _members();
        for (uint256 i = 0; i < 5; i++) {
            assertEq(m[i], actors[i]);
            assertEq(c.memberInfo(actors[i]).joinIndex, i);
        }
    }

    function test_Join_ViaForwarder() public {
        // _msgSender() must resolve to the signer when the call arrives through the trusted forwarder.
        address m = actors[0];
        (MemberAttestation memory att, bytes memory sig) = _validAtt(m);
        PermitSig memory permit = _signPermit(m, address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        _forward(m, address(c), abi.encodeCall(IHuiCircle.join, (att, sig, permit)));
        assertTrue(c.memberInfo(m).joined);
        assertEq(_members()[0], m);
    }

    function test_Join_RevertsWhenAttestationMemberDiffers() public {
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[1]);
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.BadAttestation.selector);
        c.join(att, sig, permit);
    }

    function test_Join_RevertsWhenAttestationCircleDiffers() public {
        HuiCircleHarness other = _create(_params());
        MemberAttestation memory att = _attestation(actors[0], address(other), uint64(block.timestamp + 1 hours));
        bytes memory sig = _signAttestation(att, ATTESTER_KEY);
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.BadAttestation.selector);
        c.join(att, sig, permit);
    }

    function test_Join_RevertsOnWrongSigner() public {
        MemberAttestation memory att = _attestation(actors[0], address(c), uint64(block.timestamp + 1 hours));
        bytes memory sig = _signAttestation(att, 0xBAD);
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.BadAttestation.selector);
        c.join(att, sig, permit);
    }

    function test_Join_RevertsOnMalformedSignature() public {
        (MemberAttestation memory att,) = _validAtt(actors[0]);
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.BadAttestation.selector);
        c.join(att, hex"1234", permit);
    }

    function test_Join_RevertsWhenAttestationFieldsTampered() public {
        // Signature covers expiry and id: changing either after signing breaks it.
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        att.expiry += 1;
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.BadAttestation.selector);
        c.join(att, sig, permit);
    }

    function test_Join_SignatureBoundToCloneDomain() public {
        // A signature made for another clone's domain does not verify here even with att.circle = this clone.
        HuiCircleHarness other = _create(_params());
        MemberAttestation memory att = _attestation(actors[0], address(c), uint64(block.timestamp + 1 hours));
        MemberAttestation memory forOther = att;
        forOther.circle = address(other);
        bytes memory sig = _signAttestation(forOther, ATTESTER_KEY); // domain of `other`
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.BadAttestation.selector);
        c.join(att, sig, permit);
    }

    function test_Join_ExpiryBoundary() public {
        uint64 expiry = uint64(block.timestamp + 100);
        MemberAttestation memory att = _attestation(actors[0], address(c), expiry);
        bytes memory sig = _signAttestation(att, ATTESTER_KEY);
        vm.warp(expiry); // expiry == now is still valid
        _joinWith(actors[0], att, sig);
        assertTrue(c.memberInfo(actors[0]).joined);

        MemberAttestation memory att2 = _attestation(actors[1], address(c), expiry);
        bytes memory sig2 = _signAttestation(att2, ATTESTER_KEY);
        vm.warp(uint256(expiry) + 1);
        PermitSig memory permit = _signPermit(actors[1], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[1]);
        vm.expectRevert(IHuiCircle.AttestationExpired.selector);
        c.join(att2, sig2, permit);
    }

    function test_Join_RevertsWhenAlreadyMember() public {
        _join(c, actors[0]);
        // A second, different attestation id for the same wallet: not used yet, but the wallet is already in.
        MemberAttestation memory att = _attestation(actors[0], address(c), uint64(block.timestamp + 1 hours));
        att.attestationId = keccak256("second id");
        bytes memory sig = _signAttestation(att, ATTESTER_KEY);
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.AlreadyMember.selector);
        c.join(att, sig, permit);
    }

    function test_Join_RevertsWhenAttestationReusedByAnotherWallet() public {
        // The same attestation id cannot back two seats even if the attester signed both.
        _join(c, actors[0]);
        MemberAttestation memory att = _attestation(actors[1], address(c), uint64(block.timestamp + 1 hours));
        att.attestationId = _attestationId(actors[0], address(c));
        bytes memory sig = _signAttestation(att, ATTESTER_KEY);
        PermitSig memory permit = _signPermit(actors[1], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[1]);
        vm.expectRevert(IHuiCircle.AttestationUsed.selector);
        c.join(att, sig, permit);
    }

    function test_Join_RevertsWhenFull() public {
        _joinN(c, 5);
        _fund(actors[5], 1000 * USDC);
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[5]);
        PermitSig memory permit = _signPermit(actors[5], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[5]);
        vm.expectRevert(IHuiCircle.CircleFull.selector);
        c.join(att, sig, permit);
    }

    function test_Join_DeadlineBoundary() public {
        uint64 dl = c.params().joinDeadline;
        vm.warp(dl); // still open at the deadline second
        _join(c, actors[0]);

        vm.warp(uint256(dl) + 1);
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[1]);
        PermitSig memory permit = _signPermit(actors[1], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[1]);
        vm.expectRevert(IHuiCircle.JoinClosed.selector);
        c.join(att, sig, permit);
    }

    function test_Join_RevertsWithoutAllowance() public {
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        uint256 needed = c.requiredAllowance();
        vm.prank(actors[0]);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.InsufficientAllowance.selector, needed, uint256(0)));
        c.join(att, sig, noPermit);
    }

    function test_Join_RevertsWhenPermitValueTooLow() public {
        // The circle ignores the stated value and asks the permit for exactly requiredAllowance, so a signature for
        // less than that fails inside the try and the allowance check then rejects.
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        PermitSig memory permit = _signPermit(actors[0], address(c), 100 * USDC, block.timestamp + 1 hours);
        uint256 needed = c.requiredAllowance();
        vm.prank(actors[0]);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.InsufficientAllowance.selector, needed, uint256(0)));
        c.join(att, sig, permit);
    }

    function test_Join_ExpiredPermitFallsBackToAllowance() public {
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp - 1);
        uint256 needed = c.requiredAllowance();
        vm.prank(actors[0]);
        usdc.approve(address(c), needed);
        vm.prank(actors[0]);
        c.join(att, sig, permit);
        assertTrue(c.memberInfo(actors[0]).joined);
    }

    function test_Join_PermitFrontRunStillJoins() public {
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        // An attacker submits the permit first, so the permit inside join reverts on the used nonce.
        usdc.permit(actors[0], address(c), permit.value, permit.deadline, permit.v, permit.r, permit.s);
        vm.prank(actors[0]);
        c.join(att, sig, permit);
        assertTrue(c.memberInfo(actors[0]).joined);
    }

    function test_Join_WrongStateWhenActive() public {
        HuiCircleHarness a = _workedExample();
        (MemberAttestation memory att, bytes memory sig) = _attestationFor(a, actors[6]);
        vm.prank(actors[6]);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Forming, CircleState.Active));
        a.join(att, sig, noPermit);
    }

    function test_Join_WhilePaused() public {
        c.exposed_setState(CircleState.Paused);
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.join(att, sig, noPermit);
    }

    function _attestationFor(HuiCircleHarness circle, address member)
        internal
        view
        returns (MemberAttestation memory att, bytes memory sig)
    {
        att = _attestation(member, address(circle), uint64(block.timestamp + 1 hours));
        sig = _signAttestation(att, ATTESTER_KEY);
    }

    // ================================================================== leave

    function test_Leave_CompactsJoinIndexKeepingOrder() public {
        _joinN(c, 5);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.MemberLeft(actors[1]);
        vm.prank(actors[1]);
        c.leave();

        address[] memory m = _members();
        assertEq(m.length, 4);
        assertEq(m[0], actors[0]);
        assertEq(m[1], actors[2]);
        assertEq(m[2], actors[3]);
        assertEq(m[3], actors[4]);
        for (uint256 i = 0; i < 4; i++) {
            assertEq(c.memberInfo(m[i]).joinIndex, i, "contiguous from 0");
        }
        assertFalse(c.memberInfo(actors[1]).joined);
    }

    function test_Leave_FirstAndLast() public {
        _joinN(c, 3);
        vm.prank(actors[0]);
        c.leave();
        vm.prank(actors[2]);
        c.leave();
        address[] memory m = _members();
        assertEq(m.length, 1);
        assertEq(m[0], actors[1]);
        assertEq(c.memberInfo(actors[1]).joinIndex, 0);
    }

    function test_Leave_OnlyMember() public {
        _join(c, actors[0]);
        vm.prank(actors[0]);
        c.leave();
        assertEq(_members().length, 0);
    }

    function test_Leave_RevertsForNonMember() public {
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotMember.selector);
        c.leave();
    }

    function test_Leave_CannotRejoinSameCircle() public {
        _join(c, actors[0]);
        vm.prank(actors[0]);
        c.leave();
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        PermitSig memory permit = _signPermit(actors[0], address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.AttestationUsed.selector);
        c.join(att, sig, permit);
    }

    function test_Leave_FreesSeatForSomeoneElse() public {
        _joinN(c, 5);
        vm.prank(actors[2]);
        c.leave();
        _join(c, actors[5]);
        assertEq(_members().length, 5);
        assertEq(_members()[4], actors[5]);
        assertEq(c.memberInfo(actors[5]).joinIndex, 4);
    }

    function test_Leave_WrongStateWhenActive() public {
        HuiCircleHarness a = _workedExample();
        vm.prank(actors[0]);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Forming, CircleState.Active));
        a.leave();
    }

    function test_Leave_HoldsNoMoney() public {
        _joinN(c, 2);
        vm.prank(actors[0]);
        c.leave();
        assertEq(usdc.balanceOf(address(c)), 0);
        _assertLedger();
    }

    // ================================================================== activate

    function test_Activate_HappyPath() public {
        _depositBond(c, 480 * USDC);
        _joinN(c, 5);
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleActivated(uint64(block.timestamp), 10_000);
        vm.prank(organizer);
        c.activate();

        assertEq(uint8(c.state()), uint8(CircleState.Active));
        assertEq(c.startTime(), block.timestamp);
        assertEq(factory.activeCirclesOf(organizer), 1);
        assertEq(c.currentRound(), 1);
        _assertLedger();
    }

    function test_Activate_OnlyOrganizer() public {
        _depositBond(c, 480 * USDC);
        _joinN(c, 5);
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotOrganizer.selector);
        c.activate();
    }

    function test_Activate_RevertsWhenNotFull() public {
        _depositBond(c, 480 * USDC);
        _joinN(c, 4);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.CircleNotFull.selector, uint8(4), uint8(5)));
        c.activate();
    }

    function test_Activate_CoverageBoundary() public {
        _joinN(c, 5);
        // CI = 2000 + B * 10000 / 600 USDC; 5000 needs B = 180 USDC exactly.
        _depositBond(c, 180 * USDC - 1);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.CoverageTooLow.selector, uint256(4999), uint256(5000)));
        c.activate();

        _depositBond(c, 1);
        vm.prank(organizer);
        c.activate();
        assertEq(uint8(c.state()), uint8(CircleState.Active));
    }

    function test_Activate_RevertsWithoutBond() public {
        _joinN(c, 5);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.CoverageTooLow.selector, uint256(2000), uint256(5000)));
        c.activate();
    }

    function test_Activate_DeadlineBoundary() public {
        _depositBond(c, 480 * USDC);
        _joinN(c, 5);
        uint64 dl = c.params().joinDeadline;
        vm.warp(uint256(dl) + 1);
        vm.prank(organizer);
        vm.expectRevert(IHuiCircle.JoinClosed.selector);
        c.activate();
        // At the deadline second itself it still works.
        vm.warp(dl);
        vm.prank(organizer);
        c.activate();
    }

    function test_Activate_CannotRunTwice() public {
        HuiCircleHarness a = _workedExample();
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Forming, CircleState.Active));
        a.activate();
        assertEq(factory.activeCirclesOf(organizer), 1, "counted once");
    }

    function test_Activate_ParametersUnchanged() public {
        bytes memory before = abi.encode(c.params());
        _depositBond(c, 480 * USDC);
        _joinN(c, 5);
        vm.prank(organizer);
        c.activate();
        assertEq(abi.encode(c.params()), before);
    }

    function test_Activate_WhilePaused() public {
        c.exposed_setState(CircleState.Paused);
        vm.prank(organizer);
        vm.expectRevert(IHuiCircle.CircleIsPaused.selector);
        c.activate();
    }

    // ================================================================== cancel and withdrawBond

    function test_Cancel_TooEarlyUntilAfterDeadline() public {
        uint64 dl = c.params().joinDeadline;
        vm.warp(dl);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.TooEarly.selector, dl + 1));
        c.cancel();

        vm.warp(uint256(dl) + 1);
        vm.expectEmit(false, false, false, true, address(c));
        emit IHuiCircle.CircleCancelled();
        vm.prank(actors[9]); // anybody
        c.cancel();
        assertEq(uint8(c.state()), uint8(CircleState.Cancelled));
        assertEq(factory.activeCirclesOf(organizer), 0);
    }

    function test_Cancel_WrongStateWhenActive() public {
        HuiCircleHarness a = _workedExample();
        vm.warp(block.timestamp + 30 days);
        vm.expectRevert(abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Forming, CircleState.Active));
        a.cancel();
    }

    function test_Cancel_TwiceReverts() public {
        vm.warp(uint256(c.params().joinDeadline) + 1);
        c.cancel();
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Forming, CircleState.Cancelled)
        );
        c.cancel();
    }

    function test_Cancelled_BlocksJoinAndDeposit() public {
        vm.warp(uint256(c.params().joinDeadline) + 1);
        c.cancel();
        (MemberAttestation memory att, bytes memory sig) = _validAtt(actors[0]);
        vm.prank(actors[0]);
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Forming, CircleState.Cancelled)
        );
        c.join(att, sig, noPermit);
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Forming, CircleState.Cancelled)
        );
        c.depositBond(1, noPermit);
    }

    function test_WithdrawBond_ReturnsWholeBondOnce() public {
        _depositBond(c, 480 * USDC);
        _joinN(c, 3);
        vm.warp(uint256(c.params().joinDeadline) + 1);
        c.cancel();

        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.BondWithdrawn(organizer, 480 * USDC);
        vm.prank(organizer);
        c.withdrawBond();
        assertEq(usdc.balanceOf(organizer), 480 * USDC);
        assertEq(c.bondRemaining(), 0);
        assertEq(usdc.balanceOf(address(c)), 0);
        _assertLedger();

        vm.prank(organizer);
        vm.expectRevert(IHuiCircle.NothingToWithdraw.selector);
        c.withdrawBond();
    }

    function test_WithdrawBond_RevertsBeforeCancel() public {
        _depositBond(c, 480 * USDC);
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(IHuiCircle.WrongState.selector, CircleState.Cancelled, CircleState.Forming)
        );
        c.withdrawBond();
    }

    function test_WithdrawBond_OnlyOrganizer() public {
        vm.prank(actors[0]);
        vm.expectRevert(IHuiCircle.NotOrganizer.selector);
        c.withdrawBond();
    }

    function test_WithdrawBond_NothingWhenNoBond() public {
        vm.warp(uint256(c.params().joinDeadline) + 1);
        c.cancel();
        vm.prank(organizer);
        vm.expectRevert(IHuiCircle.NothingToWithdraw.selector);
        c.withdrawBond();
    }

    function test_WithdrawBond_BlockedOrganizerGetsClaimable() public {
        _depositBond(c, 480 * USDC);
        vm.warp(uint256(c.params().joinDeadline) + 1);
        c.cancel();
        usdc.setBlacklisted(organizer, true);

        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.PaymentDeferred(organizer, 480 * USDC);
        vm.prank(organizer);
        c.withdrawBond();
        assertEq(c.claimable(organizer), 480 * USDC);
        assertEq(c.totalClaimable(), 480 * USDC);
        assertEq(c.bondRemaining(), 0);
        _assertLedger();

        // Still blocked: claim reverts and keeps the record; once unblocked it pays.
        vm.prank(organizer);
        vm.expectRevert();
        c.claim();
        assertEq(c.claimable(organizer), 480 * USDC);

        usdc.setBlacklisted(organizer, false);
        vm.expectEmit(true, false, false, true, address(c));
        emit IHuiCircle.Claimed(organizer, 480 * USDC);
        vm.prank(organizer);
        c.claim();
        assertEq(usdc.balanceOf(organizer), 480 * USDC);
        assertEq(c.totalClaimable(), 0);
        _assertLedger();

        vm.prank(organizer);
        vm.expectRevert(IHuiCircle.NothingToClaim.selector);
        c.claim();
    }

    // ================================================================== fuzz

    /// @dev Any subset leaving keeps joinIndex contiguous from 0 and the survivors in their original order.
    function testFuzz_Leave_KeepsOrderAndContiguity(uint8 joined, uint32 leaveMask) public {
        joined = uint8(bound(joined, 1, 5));
        _joinN(c, joined);
        address[] memory expected = new address[](joined);
        uint256 n;
        for (uint256 i = 0; i < joined; i++) {
            if (leaveMask & (1 << i) != 0) {
                vm.prank(actors[i]);
                c.leave();
            } else {
                expected[n++] = actors[i];
            }
        }
        address[] memory got = _members();
        assertEq(got.length, n);
        for (uint256 i = 0; i < n; i++) {
            assertEq(got[i], expected[i]);
            assertEq(c.memberInfo(got[i]).joinIndex, i);
        }
    }

    /// @dev Activation succeeds exactly when alpha + bond * 10_000 / O_max >= 5000.
    function testFuzz_Activate_CoverageThreshold(uint256 bond) public {
        bond = bound(bond, 0, 700 * USDC);
        _joinN(c, 5);
        if (bond > 0) _depositBond(c, bond);
        uint256 ci = 2000 + (bond * 10_000) / (600 * USDC);
        vm.prank(organizer);
        if (ci < 5000) {
            vm.expectRevert(abi.encodeWithSelector(IHuiCircle.CoverageTooLow.selector, ci, uint256(5000)));
            c.activate();
        } else {
            c.activate();
            assertEq(uint8(c.state()), uint8(CircleState.Active));
        }
    }
}
