// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHuiFactory} from "./interfaces/IHuiFactory.sol";
import {IReputationRegistry, Reputation} from "./interfaces/IReputationRegistry.sol";

/// @title ReputationRegistry
/// @notice Public on-chain history of wallets across HụiSafe circles (docs/05 section 3.3). Counters only: no
/// personal data (hard rule 4). Only circles created by the registered factory can write.
/// @dev Not an ERC-2771 contract: the only callers are circle contracts, so `msg.sender` is the circle. Deploy order
/// (docs/05 section 3.3): registry, then the factory with this registry in its config, then `setFactory(factory)`
/// exactly once.
contract ReputationRegistry is IReputationRegistry {
    // ------------------------------------------------------------------ errors
    error NotAdmin();
    error NotCircle(address who);
    error ZeroAddress();
    error FactoryAlreadySet();
    error FactoryNotSet();

    // ------------------------------------------------------------------ storage
    /// @inheritdoc IReputationRegistry
    address public immutable override admin;
    /// @inheritdoc IReputationRegistry
    address public override factory;

    mapping(address => Reputation) internal _rep;

    /// @param admin_ Safe multisig (testnet: the deployer wallet); may call `setFactory` once.
    constructor(address admin_) {
        if (admin_ == address(0)) revert ZeroAddress();
        admin = admin_;
    }

    /// @inheritdoc IReputationRegistry
    function setFactory(address f) external override {
        if (msg.sender != admin) revert NotAdmin();
        if (factory != address(0)) revert FactoryAlreadySet();
        if (f == address(0)) revert ZeroAddress();
        factory = f;
        emit FactorySet(f);
    }

    /// @inheritdoc IReputationRegistry
    function reputationOf(address m) external view override returns (Reputation memory) {
        return _rep[m];
    }

    /// @inheritdoc IReputationRegistry
    function recordOnTime(address m) external override onlyCircle {
        _rep[m].onTime += 1;
        emit ReputationUpdated(m, msg.sender, "onTime");
    }

    /// @inheritdoc IReputationRegistry
    function recordLate(address m) external override onlyCircle {
        _rep[m].late += 1;
        emit ReputationUpdated(m, msg.sender, "late");
    }

    /// @inheritdoc IReputationRegistry
    function recordDefault(address m) external override onlyCircle {
        _rep[m].defaults += 1;
        emit ReputationUpdated(m, msg.sender, "default");
    }

    /// @inheritdoc IReputationRegistry
    function recordRepaid(address m) external override onlyCircle {
        _rep[m].repaid += 1;
        emit ReputationUpdated(m, msg.sender, "repaid");
    }

    /// @inheritdoc IReputationRegistry
    function recordCompleted(address m) external override onlyCircle {
        _rep[m].completed += 1;
        emit ReputationUpdated(m, msg.sender, "completed");
    }

    /// @dev Caller must be a circle of the registered factory. Reverts `FactoryNotSet` before `setFactory`.
    modifier onlyCircle() {
        address f = factory;
        if (f == address(0)) revert FactoryNotSet();
        if (!IHuiFactory(f).isCircle(msg.sender)) revert NotCircle(msg.sender);
        _;
    }
}
