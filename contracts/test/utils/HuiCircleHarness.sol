// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HuiCircle} from "../../src/HuiCircle.sol";
import {HuiCircleLens} from "../../src/HuiCircleLens.sol";
import {HuiCircleViews} from "../../src/HuiCircleViews.sol";
import {CircleState, MemberInfo, Shortfall} from "../../src/libraries/HuiTypes.sol";

/// @notice Exposes internals of HuiCircle that later tasks (C6, C7) will drive, so C4/C5 tests can reach states
/// such as "member already received" or "round settled" before `settleRound` exists.
/// @dev Inherits the views directly (not through the lens) so existing tests keep calling `c.params()` and friends;
/// the lens path itself is covered by `HuiCircleLens.t.sol` on a real `HuiCircle`.
contract HuiCircleHarness is HuiCircle, HuiCircleViews {
    constructor(address forwarder_) HuiCircle(forwarder_, address(new HuiCircleLens())) {}

    function exposed_selectWinner(uint32 k) external view returns (address winner, uint256 bid) {
        return _selectWinner(k);
    }

    function exposed_liveCount() external view returns (uint256) {
        return liveCount;
    }

    /// @dev Recomputes the `liveCount` storage counter from member flags after a direct state poke.
    function _recount() private {
        uint32 count;
        uint256 n = _members.length;
        for (uint256 i = 0; i < n; i++) {
            MemberInfo storage mi = _info[_members[i]];
            if (!mi.received && !mi.defaulted) count++;
        }
        liveCount = count;
    }

    function exposed_setReceived(address m, uint8 round) external {
        _info[m].received = true;
        _info[m].receivedRound = round;
        _recount();
    }

    function exposed_setDefaulted(address m, bool v) external {
        _info[m].defaulted = v;
        _recount();
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

    function exposed_setReserve(uint256 v) external {
        reserve = v;
    }

    /// @dev Sets a member's holdback and keeps `totalHoldback` consistent; the test must mint/burn USDC to match.
    function exposed_setHoldback(address m, uint128 h) external {
        totalHoldback = totalHoldback - _info[m].holdback + h;
        _info[m].holdback = h;
    }

    function exposed_setShortfall(uint32 round, address debtor, Shortfall calldata sf) external {
        _shortfalls[round][debtor] = sf;
    }

    function exposed_setRoundWinner(uint32 round, address w) external {
        _rounds[round].winner = w;
    }

    function exposed_repayFromPot(address debtor, uint256 budget, uint32 upToRound) external returns (uint256) {
        return _repayFromPot(debtor, budget, upToRound);
    }
}
