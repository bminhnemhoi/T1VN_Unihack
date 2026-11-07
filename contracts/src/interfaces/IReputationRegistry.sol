// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice On-chain history of a wallet. Addresses and counters only, no personal data.
struct Reputation {
    uint32 completed; // circles completed without default
    uint32 onTime; // on-time contributions
    uint32 late; // late contributions (including missed reveals)
    uint32 defaults; // defaults
    uint32 repaid; // debts repaid after default
}

/// @title IReputationRegistry
/// @notice docs/05 section 3.3. Only circles with `factory.isCircle(msg.sender) == true` may write.
interface IReputationRegistry {
    event ReputationUpdated(address indexed member, address indexed circle, bytes32 kind);
    event FactorySet(address factory);

    function admin() external view returns (address);

    function factory() external view returns (address);

    /// @notice Admin only, exactly once, right after deploying the factory.
    function setFactory(address f) external;

    function reputationOf(address m) external view returns (Reputation memory);

    function recordOnTime(address m) external;

    function recordLate(address m) external;

    function recordDefault(address m) external;

    function recordRepaid(address m) external;

    function recordCompleted(address m) external;
}
