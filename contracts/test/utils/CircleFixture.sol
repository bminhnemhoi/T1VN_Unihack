// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./BaseTest.sol";
import {HuiCircleHarness} from "./HuiCircleHarness.sol";
import {MockReputation} from "./MockReputation.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {CircleMode, CircleParams, FactoryConfig, MemberAttestation, PermitSig} from "../../src/libraries/HuiTypes.sol";

/// @notice Shared fixture for HuiCircle tests: factory + harness implementation + registry double + attester key,
/// and helpers to create, fund, attest, join, bond and activate circles of the docs/03 section 8 shape
/// (N = 5, C = 100 USDC, alpha = 20%, bond 480 USDC, demo timings).
abstract contract CircleFixture is BaseTest {
    HuiCircleHarness internal impl;
    HuiFactory internal factory;
    MockReputation internal rep;
    FactoryConfig internal cfg;

    uint256 internal constant ATTESTER_KEY = 0xA77E57;
    address internal attester;

    uint64 internal constant JOIN_WINDOW = 7 days;

    function setUp() public virtual override {
        super.setUp();
        attester = vm.addr(ATTESTER_KEY);
        rep = new MockReputation();
        cfg = FactoryConfig({
            usdc: address(usdc),
            forwarder: address(forwarder),
            reputation: address(rep),
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
        impl = new HuiCircleHarness(address(forwarder));
        factory = new HuiFactory(admin, address(impl), cfg);
    }

    // ------------------------------------------------------------------ circle creation

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
            joinDeadline: uint64(block.timestamp + JOIN_WINDOW),
            organizerIsMember: false,
            label: bytes32("demo"),
            commissionShareBps: 0,
            termsHash: keccak256("huisafe-test-terms")
        });
    }

    function _create(CircleParams memory p) internal returns (HuiCircleHarness c) {
        vm.prank(organizer);
        c = HuiCircleHarness(factory.createCircle(p));
    }

    // ------------------------------------------------------------------ attestation and joining

    function _attestationId(address member, address circle) internal pure returns (bytes32) {
        return keccak256(abi.encode("attestation", member, circle));
    }

    function _attestation(address member, address circle, uint64 expiry)
        internal
        pure
        returns (MemberAttestation memory att)
    {
        att = MemberAttestation({
            member: member, circle: circle, attestationId: _attestationId(member, circle), expiry: expiry
        });
    }

    /// @dev Signs `att` as the attester under the HuiSafe domain whose verifyingContract is the clone.
    function _signAttestation(MemberAttestation memory att, uint256 key) internal view returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("HuiSafe"),
                keccak256("1"),
                block.chainid,
                att.circle
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("MemberAttestation(address member,address circle,bytes32 attestationId,uint64 expiry)"),
                att.member,
                att.circle,
                att.attestationId,
                att.expiry
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }

    /// @dev Funds `member` for the whole circle, signs a permit for the required allowance and joins.
    function _join(HuiCircleHarness c, address member) internal {
        _fund(member, 10_000 * USDC);
        MemberAttestation memory att = _attestation(member, address(c), uint64(block.timestamp + 1 hours));
        bytes memory sig = _signAttestation(att, ATTESTER_KEY);
        PermitSig memory permit = _signPermit(member, address(c), c.requiredAllowance(), block.timestamp + 1 hours);
        vm.prank(member);
        c.join(att, sig, permit);
    }

    function _joinN(HuiCircleHarness c, uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            _join(c, actors[i]);
        }
    }

    // ------------------------------------------------------------------ bond and activation

    /// @dev Organizer funds itself, approves and deposits `amount` (no permit: the organizer has no known key).
    function _depositBond(HuiCircleHarness c, uint256 amount) internal {
        _fund(organizer, amount);
        vm.startPrank(organizer);
        usdc.approve(address(c), amount);
        c.depositBond(amount, PermitSig({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)}));
        vm.stopPrank();
    }

    /// @dev Create a circle, deposit `bond`, join `members` actors and activate it (if full and covered).
    function _active(CircleParams memory p, uint256 bond) internal returns (HuiCircleHarness c) {
        c = _create(p);
        _depositBond(c, bond);
        _joinN(c, p.memberCount);
        vm.prank(organizer);
        c.activate();
    }

    /// @dev The docs/03 section 8 circle: N = 5, C = 100, bond 480, already active at the current timestamp.
    function _workedExample() internal returns (HuiCircleHarness c) {
        c = _active(_params(), 480 * USDC);
    }
}
