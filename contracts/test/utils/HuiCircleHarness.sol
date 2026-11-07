// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HuiCircle} from "../../src/HuiCircle.sol";
import {CircleState} from "../../src/libraries/HuiTypes.sol";

/// @notice Exposes internals of HuiCircle that later tasks (C6, C7) will drive, so C4/C5 tests can reach states
/// such as "member already received" or "round settled" before `settleRound` exists.
contract HuiCircleHarness is HuiCircle {
    constructor(address forwarder_) HuiCircle(forwarder_) {}

    function exposed_selectWinner(uint32 k) external view returns (address winner, uint256 bid) {
        return _selectWinner(k);
    }

    function exposed_liveCount() external view returns (uint256) {
        return _liveCount();
    }

    function exposed_setReceived(address m, uint8 round) external {
        _info[m].received = true;
        _info[m].receivedRound = round;
    }

    function exposed_setDefaulted(address m, bool v) external {
        _info[m].defaulted = v;
    }

    function exposed_setDebt(address m, uint128 d) external {
        _info[m].debt = d;
    }

    function exposed_setLateCount(address m, uint16 c) external {
        _info[m].lateCount = c;
    }

    /// @dev Pretends rounds 1..k were settled (only the bookkeeping that C5 reads).
    function exposed_setSettled(uint32 k) external {
        settledRounds = k;
        for (uint32 r = 1; r <= k; r++) {
            _rounds[r].settled = true;
        }
    }

    function exposed_setPausedTotal(uint64 t) external {
        pausedTotal = t;
    }

    function exposed_setState(CircleState s) external {
        state = s;
    }
}
