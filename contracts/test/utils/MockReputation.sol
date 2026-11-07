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

    function reputationOf(address m) external view returns (Reputation memory) {
        require(!broken, "registry broken");
        return _rep[m];
    }
}
