// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title MockUSDC
/// @notice Test-only stand-in for Circle USDC: 6 decimals, EIP-2612 permit with domain version "2",
/// EIP-3009 `receiveWithAuthorization`, and a blacklist that makes transfers to/from an address revert.
/// @dev Anyone can mint. Never deploy outside local/test networks.
contract MockUSDC is ERC20, EIP712, Nonces, IERC20Permit {
    bytes32 private constant _PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant _RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    /// @notice Addresses whose transfers revert, like Circle's blacklist.
    mapping(address => bool) public isBlacklisted;

    /// @notice EIP-3009 authorization nonce state: authorizer => nonce => used.
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    error ERC2612ExpiredSignature(uint256 deadline);
    error ERC2612InvalidSigner(address signer, address owner);
    error Blacklisted(address account);
    error AuthorizationNotYetValid(uint256 validAfter);
    error AuthorizationExpired(uint256 validBefore);
    error AuthorizationAlreadyUsed(address authorizer, bytes32 nonce);
    error InvalidAuthorizationSignature();
    error CallerMustBePayee(address caller, address payee);

    event BlacklistSet(address indexed account, bool blacklisted);
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor() ERC20("USD Coin", "USDC") EIP712("USD Coin", "2") {}

    /// @notice 6 decimals, like USDC.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint without restriction (mock only).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Toggle the blacklist for an address (mock only, unrestricted).
    function setBlacklisted(address account, bool blacklisted) external {
        isBlacklisted[account] = blacklisted;
        emit BlacklistSet(account, blacklisted);
    }

    /// @notice Domain version, "2" as on Circle USDC.
    function version() external view returns (string memory) {
        return _EIP712Version();
    }

    // ------------------------------------------------------------------ EIP-2612

    /// @inheritdoc IERC20Permit
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        override
    {
        if (block.timestamp > deadline) revert ERC2612ExpiredSignature(deadline);

        bytes32 structHash = keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s);
        if (signer != owner) revert ERC2612InvalidSigner(signer, owner);

        _approve(owner, spender, value);
    }

    /// @inheritdoc IERC20Permit
    function nonces(address owner) public view override(IERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /// @inheritdoc IERC20Permit
    // forge-lint: disable-next-line(mixed-case-function)
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ------------------------------------------------------------------ EIP-3009

    /// @notice Transfer `value` from `from` to the caller using a signed authorization (EIP-3009).
    /// @dev The caller must be `to`, as in the reference implementation.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (to != msg.sender) revert CallerMustBePayee(msg.sender, to);
        if (block.timestamp <= validAfter) revert AuthorizationNotYetValid(validAfter);
        if (block.timestamp >= validBefore) revert AuthorizationExpired(validBefore);
        if (authorizationState[from][nonce]) revert AuthorizationAlreadyUsed(from, nonce);

        bytes32 structHash = keccak256(
            abi.encode(_RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
        );
        if (ECDSA.recover(_hashTypedDataV4(structHash), v, r, s) != from) revert InvalidAuthorizationSignature();

        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    // ------------------------------------------------------------------ blacklist hook

    function _update(address from, address to, uint256 value) internal override {
        if (isBlacklisted[from]) revert Blacklisted(from);
        if (isBlacklisted[to]) revert Blacklisted(to);
        super._update(from, to, value);
    }
}
