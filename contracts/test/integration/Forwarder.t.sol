// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {Errors} from "@openzeppelin/contracts/utils/Errors.sol";

import {CircleScenario} from "../utils/CircleScenario.sol";
import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {IHuiFactory} from "../../src/interfaces/IHuiFactory.sol";
import {CircleParams, CircleState, MemberAttestation, PermitSig} from "../../src/libraries/HuiTypes.sol";

/// @notice ERC-2771 end to end with the REAL OpenZeppelin `ERC2771Forwarder` (docs/03 section 10, ADR-06): C7 and
/// C4 functions invoked through a signed `ForwardRequest` resolve `_msgSender()` to the signer, the relayer (this
/// test contract) never becomes a party, and a forged, tampered, replayed, expired or mis-targeted request fails.
contract ForwarderIntegrationTest is CircleScenario {
    address internal stranger = makeAddr("stranger");
    uint256 internal constant ONE_HOUR = 1 hours;

    // ------------------------------------------------------------------ signing helpers

    /// @dev A request of `from` to `to`, signed with `key` (which may deliberately not be `from`'s key).
    function _signed(uint256 key, address from, address to, bytes memory data, uint48 deadline)
        internal
        view
        returns (ERC2771Forwarder.ForwardRequestData memory req)
    {
        req = ERC2771Forwarder.ForwardRequestData({
            from: from, to: to, value: 0, gas: 3_000_000, deadline: deadline, data: data, signature: ""
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, _forwardDigest(req));
        req.signature = abi.encodePacked(r, s, v);
    }

    function _deadline() internal view returns (uint48) {
        return uint48(_now() + ONE_HOUR);
    }

    /// @dev Sign as `from` itself and submit (the test contract is the relayer).
    function _relay(address from, address to, bytes memory data) internal {
        forwarder.execute(_signed(actorKey[from], from, to, data, _deadline()));
    }

    function _lateM4Setup() internal {
        _m4FailsRound2();
        _unblock(_M(4));
        vm.warp(uint256(c.roundInfo(2).settledAt) + 6);
    }

    // ================================================================== Forming: join, createCircle

    function test_Forwarder_Join_MsgSenderIsTheSigner_RelayerPaysNothing() public {
        HuiCircleHarness f = _create(_params());
        address member = actors[0];
        _fund(member, 10_000 * U);
        MemberAttestation memory att = _attestation(member, address(f), uint64(_now() + ONE_HOUR));
        bytes memory sig = _signAttestation(att, ATTESTER_KEY);
        PermitSig memory permit = _signPermit(member, address(f), f.requiredAllowance(), _now() + ONE_HOUR);
        assertTrue(f.isTrustedForwarder(address(forwarder)));

        vm.expectEmit(true, false, false, true, address(f));
        emit IHuiCircle.MemberJoined(member, 0, att.attestationId);
        _relay(member, address(f), abi.encodeCall(IHuiCircle.join, (att, sig, permit)));

        assertTrue(f.memberInfo(member).joined, "the signer joined");
        assertFalse(f.memberInfo(address(this)).joined, "the relayer is not a member");
        assertFalse(f.memberInfo(address(forwarder)).joined, "neither is the forwarder");
        assertEq(usdc.allowance(member, address(f)), f.requiredAllowance());
        assertEq(forwarder.nonces(member), 1);
    }

    /// @dev Member B's signed request cannot carry member A's attestation: `_msgSender()` is B, so the attestation
    /// is for someone else. The forwarder hides the inner reason (`FailedCall`); the direct call shows it.
    function test_Forwarder_AttestationOfAnotherMember_FailsBecauseSenderIsTheSigner() public {
        HuiCircleHarness f = _create(_params());
        address a = actors[0];
        address b = actors[1];
        _fund(b, 10_000 * U);
        MemberAttestation memory att = _attestation(a, address(f), uint64(_now() + ONE_HOUR));
        bytes memory sig = _signAttestation(att, ATTESTER_KEY);
        PermitSig memory permit = _signPermit(b, address(f), f.requiredAllowance(), _now() + ONE_HOUR);
        bytes memory data = abi.encodeCall(IHuiCircle.join, (att, sig, permit));

        vm.prank(b);
        vm.expectRevert(IHuiCircle.BadAttestation.selector);
        f.join(att, sig, permit);

        ERC2771Forwarder.ForwardRequestData memory req = _signed(actorKey[b], b, address(f), data, _deadline());
        vm.expectRevert(Errors.FailedCall.selector);
        forwarder.execute(req);
        assertFalse(f.memberInfo(a).joined);
        assertFalse(f.memberInfo(b).joined);
        assertEq(forwarder.nonces(b), 0, "a reverted request does not consume the nonce");
    }

    function test_Forwarder_CreateCircle_OrganizerIsTheSigner() public {
        address signer = actors[3];
        CircleParams memory p = _params();
        bytes memory data = abi.encodeCall(IHuiFactory.createCircle, (p));
        forwarder.execute(_signed(actorKey[signer], signer, address(factory), data, _deadline()));
        address[] memory made = factory.circlesOf(signer);
        assertEq(made.length, 1, "registered under the signer");
        assertEq(HuiCircleHarness(made[0]).organizer(), signer);
        assertEq(factory.circlesOf(address(this)).length, 0, "not under the relayer");
        assertEq(factory.circlesOf(address(forwarder)).length, 0);
    }

    // ================================================================== Active: commit, reveal, payLate, markDefault

    function test_Forwarder_CommitAndRevealBid_ChargeAndCreditTheSigner() public {
        address m = _M(2);
        bytes32 h = keccak256(abi.encode(address(c), uint32(1), m, 5 * U, _salt(m)));
        uint256 balBefore = usdc.balanceOf(m);

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.BidCommitted(1, m, h, 1);
        _relay(m, address(c), abi.encodeCall(IHuiCircle.commitBid, (h)));
        assertEq(c.commitOf(1, m).hash, h);
        assertEq(balBefore - usdc.balanceOf(m), 1 * U, "the signer paid the reveal bond");
        assertEq(usdc.balanceOf(address(this)), 0, "the relayer paid nothing");
        assertEq(c.revealBondsHeld(), 1 * U);

        _toReveal();
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.BidRevealed(1, m, 5 * U);
        _relay(m, address(c), abi.encodeCall(IHuiCircle.revealBid, (5 * U, _salt(m))));
        assertEq(usdc.balanceOf(m), balBefore, "bond refunded to the signer");
        _assertLedger();

        _settle(); // the only bidder wins
        assertEq(c.roundInfo(1).winner, m);
        assertEq(c.roundInfo(1).winningBid, 5 * U);
        _assertLedger();
        _assertConserved();
    }

    function test_Forwarder_PayLate_TheSignerPays_NotTheRelayer() public {
        _lateM4Setup();
        uint256 m4Before = usdc.balanceOf(_M(4));
        uint256 relayerBefore = usdc.balanceOf(address(this));

        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.LatePaid(2, _M(4), 100 * U, 27_396);
        _relay(_M(4), address(c), abi.encodeCall(IHuiCircle.payLate, (2)));

        assertEq(m4Before - usdc.balanceOf(_M(4)), 100 * U + 27_396 - 20 * U, "M4 paid 100 + fee, got 20 released");
        assertEq(usdc.balanceOf(address(this)), relayerBefore, "relayer untouched");
        assertEq(usdc.balanceOf(address(forwarder)), 0);
        assertTrue(c.shortfallOf(2, _M(4)).resolved);
        assertEq(c.memberInfo(_M(4)).holdback, 60 * U);
        _assertLedger();
        _assertConserved();
    }

    /// @dev `markDefault` is open to anyone: the signer is a non-member, and the forwarder does not change that.
    function test_Forwarder_MarkDefault_AnyWalletCanSign() public {
        _m4FailsRound2();
        vm.warp(_graceEnd(2) + 1);
        address anyone = actors[20];
        assertFalse(c.memberInfo(anyone).joined);
        vm.expectEmit(true, true, false, true, address(c));
        emit IHuiCircle.MemberDefaulted(_M(4), 2, false);
        _relay(anyone, address(c), abi.encodeCall(IHuiCircle.markDefault, (_M(4))));
        assertTrue(c.memberInfo(_M(4)).defaulted);
        _assertLedger();
    }

    // ================================================================== forgery and abuse

    /// @dev The attacker signs a request that names M4 as `from` to pull M4's money through `payLate`. The forwarder
    /// recovers the attacker, not M4, and rejects it; M4's debt and funds do not move.
    function test_Forwarder_ForgedFrom_RevertsInvalidSigner() public {
        _lateM4Setup();
        address attackerAddr = actors[9];
        uint256 m4Before = usdc.balanceOf(_M(4));
        ERC2771Forwarder.ForwardRequestData memory req =
            _signed(actorKey[attackerAddr], _M(4), address(c), abi.encodeCall(IHuiCircle.payLate, (2)), _deadline());
        vm.expectRevert(
            abi.encodeWithSelector(ERC2771Forwarder.ERC2771ForwarderInvalidSigner.selector, attackerAddr, _M(4))
        );
        forwarder.execute(req);
        assertEq(usdc.balanceOf(_M(4)), m4Before);
        assertFalse(c.shortfallOf(2, _M(4)).resolved);
        assertEq(c.memberInfo(_M(4)).debt, 100 * U);
    }

    /// @dev A relayer who edits the calldata after the member signed it (here: payLate(2) becomes payLate(1)).
    function test_Forwarder_TamperedData_Reverts() public {
        _lateM4Setup();
        ERC2771Forwarder.ForwardRequestData memory req =
            _signed(actorKey[_M(4)], _M(4), address(c), abi.encodeCall(IHuiCircle.payLate, (2)), _deadline());
        req.data = abi.encodeCall(IHuiCircle.payLate, (1));
        vm.expectPartialRevert(ERC2771Forwarder.ERC2771ForwarderInvalidSigner.selector);
        forwarder.execute(req);
        assertEq(c.memberInfo(_M(4)).debt, 100 * U);
    }

    function test_Forwarder_Replay_Reverts_ThenExpiredRequest_Reverts() public {
        _lateM4Setup();
        uint48 dl = _deadline();
        ERC2771Forwarder.ForwardRequestData memory req =
            _signed(actorKey[_M(4)], _M(4), address(c), abi.encodeCall(IHuiCircle.payLate, (2)), dl);
        forwarder.execute(req);
        uint256 m4After = usdc.balanceOf(_M(4));
        vm.expectPartialRevert(ERC2771Forwarder.ERC2771ForwarderInvalidSigner.selector);
        forwarder.execute(req); // same bytes: the nonce moved on
        assertEq(usdc.balanceOf(_M(4)), m4After, "no second payment");

        ERC2771Forwarder.ForwardRequestData memory late =
            _signed(actorKey[_M(2)], _M(2), address(c), abi.encodeCall(IHuiCircle.claim, ()), dl);
        vm.warp(uint256(dl) + 1);
        vm.expectRevert(abi.encodeWithSelector(ERC2771Forwarder.ERC2771ForwarderExpiredRequest.selector, dl));
        forwarder.execute(late);
    }

    /// @dev The forwarder refuses targets that do not trust it, so it cannot be turned into a way to call the token
    /// or any other contract as `forwarder`.
    function test_Forwarder_UntrustfulTarget_Reverts() public {
        ERC2771Forwarder.ForwardRequestData memory req = _signed(
            actorKey[_M(2)], _M(2), address(usdc), abi.encodeCall(usdc.transfer, (stranger, 1 * U)), _deadline()
        );
        vm.expectRevert(
            abi.encodeWithSelector(ERC2771Forwarder.ERC2771UntrustfulTarget.selector, address(usdc), address(forwarder))
        );
        forwarder.execute(req);
    }

    /// @dev Spoofing the sender by appending a victim's address to the calldata works only through the trusted
    /// forwarder; a direct call from anyone else is read as itself. M4 has an open shortfall and a full allowance,
    /// so if the suffix were honoured this would be a successful `payLate` for M4.
    function test_Forwarder_AppendedAddressFromDirectCaller_IsIgnored() public {
        _lateM4Setup();
        bytes memory spoof = abi.encodePacked(abi.encodeCall(IHuiCircle.payLate, (2)), _M(4));
        vm.prank(stranger);
        (bool ok, bytes memory ret) = address(c).call(spoof);
        assertFalse(ok);
        assertEq(bytes4(ret), IHuiCircle.NoShortfall.selector, "treated as the stranger, who owes nothing");
        assertEq(c.memberInfo(_M(4)).debt, 100 * U);
        assertFalse(c.shortfallOf(2, _M(4)).resolved);
    }

    /// @dev ADR-06: `Multicall` + `ERC2771Context` allows address spoofing. Neither the circle nor the factory exposes
    /// a `multicall(bytes[])`, even when called through the forwarder.
    function test_Forwarder_NoMulticall() public {
        bytes memory data = abi.encodeWithSignature("multicall(bytes[])", new bytes[](0));
        (bool ok,) = address(c).call(data);
        assertFalse(ok, "circle has no multicall");
        (ok,) = address(factory).call(data);
        assertFalse(ok, "factory has no multicall");
        ERC2771Forwarder.ForwardRequestData memory req = _signed(actorKey[_M(2)], _M(2), address(c), data, _deadline());
        vm.expectRevert(Errors.FailedCall.selector);
        forwarder.execute(req);
    }

    /// @dev Pause blocks relayed calls like direct ones: the forwarder inherits no privilege.
    function test_Forwarder_WhilePaused_RelayedCallReverts() public {
        vm.prank(admin);
        factory.pauseCircle(address(c));
        bytes32 h = keccak256(abi.encode(address(c), uint32(1), _M(2), 1 * U, _salt(_M(2))));
        ERC2771Forwarder.ForwardRequestData memory req =
            _signed(actorKey[_M(2)], _M(2), address(c), abi.encodeCall(IHuiCircle.commitBid, (h)), _deadline());
        vm.expectRevert(Errors.FailedCall.selector);
        forwarder.execute(req);
        assertEq(uint8(c.state()), uint8(CircleState.Paused));
        assertEq(c.revealBondsHeld(), 0);
    }
}
