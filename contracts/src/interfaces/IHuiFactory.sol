// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CircleMode, CircleParams, FactoryConfig} from "../libraries/HuiTypes.sol";

/// @title IHuiFactory
/// @notice Creates HuiCircle clones, keeps the registry and the factory config (docs/05 section 3.1).
interface IHuiFactory {
    event CircleCreated(
        address indexed circle,
        address indexed organizer,
        CircleMode mode,
        uint8 memberCount,
        uint96 contribution,
        bytes32 label
    );
    event ConfigUpdated(FactoryConfig config);
    event CirclePausedByAdmin(address indexed circle);
    event CircleUnpausedByAdmin(address indexed circle);

    /// @notice Create and initialize a new circle (EIP-1167 clone). The caller becomes the organizer.
    function createCircle(CircleParams calldata p) external returns (address circle);

    function implementation() external view returns (address);

    /// @notice Safe multisig (testnet: deployer).
    function admin() external view returns (address);

    function config() external view returns (FactoryConfig memory);

    /// @notice Admin only; applies only to circles created afterwards.
    function setConfig(FactoryConfig calldata c) external;

    function allCircles() external view returns (address[] memory);

    function circlesOf(address organizer) external view returns (address[] memory);

    function activeCirclesOf(address organizer) external view returns (uint256);

    function isCircle(address a) external view returns (bool);

    /// @notice Called by a valid circle when it activates.
    function onActivated(address organizer) external;

    /// @notice Called by a valid circle when it ends (completed, unwound).
    function onFinished(address organizer) external;

    /// @notice Admin only.
    function pauseCircle(address circle) external;

    /// @notice Admin only.
    function unpauseCircle(address circle) external;

    /// @notice Admin only; the circle must have been Paused continuously for at least 48 hours.
    function unwindCircle(address circle) external;
}
