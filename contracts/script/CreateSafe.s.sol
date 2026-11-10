// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address proxy);
}

interface ISafeSetup {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
}

/// @title CreateSafe
/// @notice Creates the 2-of-3 Safe that becomes the HuiFactory admin on Fuji (ADR-26), using the canonical
///         Safe v1.4.1 contracts already deployed on chain 43113 (SafeProxyFactory + SafeL2 + fallback handler).
/// @dev The deployer only pays the creation gas; it is NOT an owner (ADR-21: one wallet per role).
///      Env: DEPLOYER_PRIVATE_KEY, SAFE_OWNER_1, SAFE_OWNER_2, SAFE_OWNER_3, optional SAFE_SALT (default 43113).
///      Owners can be swapped later by 2 signatures without changing the Safe address, so the factory admin stays valid.
contract CreateSafe is Script {
    address internal constant PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address internal constant SAFE_L2_SINGLETON = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address internal constant FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;
    uint256 internal constant THRESHOLD = 2;
    uint256 internal constant FUJI_CHAIN_ID = 43_113;

    error WrongChain(uint256 chainId);
    error SafeContractsMissing();
    error BadOwner(address owner);
    error SetupCheckFailed();

    /// @notice Reads the env (see contract NatSpec) and creates the Safe.
    /// @return safe Address of the new Safe proxy.
    function run() external returns (address safe) {
        address[3] memory owners =
            [vm.envAddress("SAFE_OWNER_1"), vm.envAddress("SAFE_OWNER_2"), vm.envAddress("SAFE_OWNER_3")];
        safe = create(vm.envUint("DEPLOYER_PRIVATE_KEY"), owners, vm.envOr("SAFE_SALT", uint256(43_113)));
    }

    /// @notice Creates a 2-of-3 SafeL2 proxy paid by `key` and checks owners and threshold.
    /// @param key Private key that pays the gas; its address must not be an owner.
    /// @param owners_ The three signers; non-zero, distinct, externally owned.
    /// @param salt Salt nonce for the proxy factory.
    /// @return safe Address of the new Safe proxy.
    function create(uint256 key, address[3] memory owners_, uint256 salt) public returns (address safe) {
        if (block.chainid != FUJI_CHAIN_ID) revert WrongChain(block.chainid);
        if (PROXY_FACTORY.code.length == 0 || SAFE_L2_SINGLETON.code.length == 0 || FALLBACK_HANDLER.code.length == 0) {
            revert SafeContractsMissing();
        }
        address deployer = vm.addr(key);
        address[] memory owners = new address[](3);
        for (uint256 i; i < 3; ++i) {
            owners[i] = owners_[i];
            if (owners[i] == address(0) || owners[i] == deployer || owners[i].code.length != 0) {
                revert BadOwner(owners[i]);
            }
            for (uint256 j; j < i; ++j) {
                if (owners[i] == owners[j]) revert BadOwner(owners[i]);
            }
        }

        bytes memory init = abi.encodeCall(
            ISafeSetup.setup, (owners, THRESHOLD, address(0), "", FALLBACK_HANDLER, address(0), 0, payable(address(0)))
        );

        vm.startBroadcast(key);
        safe = ISafeProxyFactory(PROXY_FACTORY).createProxyWithNonce(SAFE_L2_SINGLETON, init, salt);
        vm.stopBroadcast();

        address[] memory got = ISafeSetup(safe).getOwners();
        if (ISafeSetup(safe).getThreshold() != THRESHOLD || got.length != 3) revert SetupCheckFailed();

        console2.log("Safe (2/3) created at:", safe);
        console2.log("owner 1:", got[0]);
        console2.log("owner 2:", got[1]);
        console2.log("owner 3:", got[2]);
    }
}
