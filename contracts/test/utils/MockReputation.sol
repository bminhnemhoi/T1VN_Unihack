// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Reputation} from "../../src/interfaces/IReputationRegistry.sol";

/// @notice Test double of the ReputationRegistry read side: `late` is settable per wallet, and the registry can be
/// switched to revert to prove the circle never depends on it for liveness.
contract MockReputation {
    mapping(address => Reputation) internal _rep;
    bool public broken;

    function setLate(address m, uint32 late_) external {
        _rep[m].late = late_;
    }

    function setBroken(bool b) external {
        broken = b;
    }

    /// @dev Write side used by settleRound; counts like the real registry so tie-breaks see in-circle lateness.
    function recordOnTime(address m) external {
        require(!broken, "registry broken");
        _rep[m].onTime += 1;
    }

    function recordLate(address m) external {
        require(!broken, "registry broken");
        _rep[m].late += 1;
    }

    function recordDefault(address m) external {
        _rep[m].defaults += 1;
    }

    function recordRepaid(address m) external {
        _rep[m].repaid += 1;
    }

    function recordCompleted(address m) external {
        _rep[m].completed += 1;
    }

    function reputationOf(address m) external view returns (Reputation memory) {
        require(!broken, "registry broken");
        return _rep[m];
    }
}
