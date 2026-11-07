// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IUSDCPermit
/// @notice The USDC surface HuiSafe uses: ERC-20 plus EIP-2612 permit (docs/05 section 3.4).
interface IUSDCPermit is IERC20 {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;

    function nonces(address owner) external view returns (uint256);

    function name() external view returns (string memory);

    /// @dev Circle USDC returns "2".
    function version() external view returns (string memory);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @dev EIP-3009 (bonus, already available on USDC).
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
    ) external;
}
