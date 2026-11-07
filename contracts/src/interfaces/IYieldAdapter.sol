// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IYieldAdapter
/// @notice MVP: NoYield. Bonus: MockYieldVault (ERC-4626). docs/05 section 3.4.
interface IYieldAdapter {
    function deposit(uint256 assets) external returns (uint256 shares);

    function withdraw(uint256 assets, address to) external returns (uint256 shares);

    function totalAssetsOf(address owner) external view returns (uint256);
}
