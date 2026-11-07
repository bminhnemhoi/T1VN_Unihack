// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {PermitSig} from "../../src/libraries/HuiTypes.sol";

/// @notice Shared fixture: a MockUSDC, a set of funded actors with known private keys, and signing helpers.
/// @dev Later tasks extend this with forwarder, registry, factory and attestation helpers.
abstract contract BaseTest is Test {
    uint256 internal constant USDC = 1e6; // 1 USDC in base units
    uint256 internal constant ACTOR_COUNT = 30;

    MockUSDC internal usdc;
    ERC2771Forwarder internal forwarder;

    address internal admin = makeAddr("admin");
    address internal organizer = makeAddr("organizer");

    /// @dev Actors are derived from fixed private keys so tests can sign permits for them.
    address[] internal actors;
    mapping(address => uint256) internal actorKey;

    function setUp() public virtual {
        usdc = new MockUSDC();
        forwarder = new ERC2771Forwarder("HuiSafeForwarder");
        for (uint256 i = 0; i < ACTOR_COUNT; i++) {
            uint256 pk = uint256(keccak256(abi.encode("huisafe.actor", i))) % (SECP256K1_ORDER - 1) + 1;
            address a = vm.addr(pk);
            vm.label(a, string.concat("actor", vm.toString(i)));
            actors.push(a);
            actorKey[a] = pk;
        }
    }

    /// @notice Mint `amount` base units of MockUSDC to `to`.
    function _fund(address to, uint256 amount) internal {
        usdc.mint(to, amount);
    }

    /// @notice Sign an EIP-2612 permit for `owner` (must be a known actor) using the token's runtime domain.
    function _signPermit(address owner, address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (PermitSig memory sig)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                value,
                usdc.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(actorKey[owner], digest);
        sig = PermitSig({value: value, deadline: deadline, v: v, r: r, s: s});
    }

    /// @notice Sign and execute an ERC-2771 forward request from `from` (must be a known actor) to `to`.
    /// @dev Anyone may submit; here the test contract plays the relayer. The forwarder reverts when the inner call
    /// fails (single `execute`).
    function _forward(address from, address to, bytes memory data) internal {
        ERC2771Forwarder.ForwardRequestData memory req = ERC2771Forwarder.ForwardRequestData({
            from: from,
            to: to,
            value: 0,
            gas: 3_000_000,
            deadline: uint48(block.timestamp + 1 hours),
            data: data,
            signature: ""
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(actorKey[from], _forwardDigest(req));
        req.signature = abi.encodePacked(r, s, v);
        forwarder.execute(req);
    }

    /// @dev EIP-712 digest of a forward request under the forwarder's runtime domain.
    function _forwardDigest(ERC2771Forwarder.ForwardRequestData memory req) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
                ),
                req.from,
                req.to,
                req.value,
                req.gas,
                forwarder.nonces(req.from),
                req.deadline,
                keccak256(req.data)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _forwarderDomainSeparator(), structHash));
    }

    function _forwarderDomainSeparator() internal view returns (bytes32) {
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            forwarder.eip712Domain();
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }
}
