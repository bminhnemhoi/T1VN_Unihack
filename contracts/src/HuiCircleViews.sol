// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HuiCircleBase} from "./HuiCircleBase.sol";
import {HuiMath} from "./libraries/HuiMath.sol";
import {
    Commit,
    CircleParams,
    CircleState,
    MemberInfo,
    RoundInfo,
    RoundPhase,
    Shortfall
} from "./libraries/HuiTypes.sol";

/// @title HuiCircleViews
/// @notice Read-only functions of a circle (docs/05 section 3.2), kept out of `HuiCircle` to stay under the 24,576
/// byte limit. `HuiCircle` forwards unknown selectors to a deployed `HuiCircleLens` with DELEGATECALL, so these
/// functions run against the circle's own storage and the ABI of the circle is unchanged.
/// @dev Only `view` functions, no state writes, no immutables read: safe to run through a delegate fallback.
abstract contract HuiCircleViews is HuiCircleBase {
    /// @notice Creation parameters, immutable after `activate()` (docs/03 section 3.1).
    function params() external view returns (CircleParams memory) {
        return _params;
    }

    /// @notice Members in `joinIndex` order.
    function members() external view returns (address[] memory) {
        return _members;
    }

    /// @notice Bookkeeping of one member.
    function memberInfo(address m) external view returns (MemberInfo memory) {
        return _info[m];
    }

    /// @notice Phase of the current round (`settledRounds + 1`) by time: NotStarted before activation or while the
    /// round has not opened yet (previous round settled early), Commit, Reveal, then AwaitingSettle once the reveal
    /// window ends. Done once the round is settled. While round k-1 is still unsettled the current round stays k-1,
    /// so after its reveal window this reports AwaitingSettle until it is settled (round k then starts at that moment).
    function phase() external view returns (RoundPhase) {
        CircleState s = state;
        if (s == CircleState.Completed) return RoundPhase.Done;
        if (s != CircleState.Active) return RoundPhase.NotStarted;
        uint32 k = currentRound();
        if (_rounds[k].settled) return RoundPhase.Done;
        uint256 start = _roundStart(k);
        if (block.timestamp < start) return RoundPhase.NotStarted;
        uint256 revealStart = start + _params.commitWindow;
        if (block.timestamp < revealStart) return RoundPhase.Commit;
        if (block.timestamp < revealStart + _params.revealWindow) return RoundPhase.Reveal;
        return RoundPhase.AwaitingSettle;
    }

    /// @notice Start of round `k` (1..N): `max(startTime + (k - 1) * roundDuration, settledAt(k - 1) -
    /// pausedAtSettle(k - 1)) + pausedTotal` (the second term only for k >= 2 and a settled round k - 1).
    function roundStart(uint32 k) external view returns (uint64) {
        return uint64(_roundStart(k));
    }

    /// @notice Earliest time `settleRound` may run for round `k`: `roundStart(k) + roundDuration`.
    function deadline(uint32 k) external view returns (uint64) {
        return uint64(_roundStart(k) + _params.roundDuration);
    }

    /// @notice Stored result of round `k` (empty until settled).
    function roundInfo(uint32 k) external view returns (RoundInfo memory) {
        return _rounds[k];
    }

    /// @notice Sealed bid state of member `m` in round `k`.
    function commitOf(uint32 k, address m) external view returns (Commit memory) {
        return _commits[k][m];
    }

    /// @notice Shortfall record of `m` in round `k` (empty if none).
    function shortfallOf(uint32 k, address m) external view returns (Shortfall memory) {
        return _shortfalls[k][m];
    }

    /// @notice What `m` owes into the pot of any round where a winning bid `bid` is paid: C for members who already
    /// received, C - bid for the others. Zero for non-members.
    function dueOf(address m, uint32, uint256 bid) external view returns (uint256) {
        MemberInfo storage mi = _info[m];
        if (!mi.joined) return 0;
        return mi.received ? _params.contribution : _params.contribution - bid;
    }

    /// @notice Late fee `m` would owe today to clear the open principal of its shortfall of round `k` (docs/03
    /// section 2.5, summed per part exactly as `payLate` charges it). Zero when there is no open shortfall.
    function lateFeeOf(address m, uint32 k) external view returns (uint256 fee) {
        Shortfall storage sf = _shortfalls[k][m];
        if (sf.resolved || sf.amount == 0) return 0;
        uint256 elapsed = block.timestamp - sf.since - (pausedTotal - _pausedAtSettle[k]);
        uint256[4] memory parts = [uint256(sf.uncovered), sf.fromReserve, sf.fromBond, sf.fromHoldback];
        for (uint256 i = 0; i < 4; i++) {
            fee += HuiMath.lateFee(parts[i], lateRateBps, elapsed, _params.periodSeconds, _params.roundDuration);
        }
    }

    /// @notice Bid ceiling of round `k` for the current number of live members (docs/03 section 2.4).
    function maxBid(uint32 k) external view returns (uint256) {
        return _maxBid(k);
    }

    /// @notice Statutory bid ceiling of round `k`, before the organizer's commission share (docs/03 section 2.7).
    function statutoryMaxBid(uint32 k) external view returns (uint256) {
        return _statutoryMaxBid(k);
    }

    /// @notice room_k = statutoryMaxBid(k) * L_k: the interest room the commission lives inside (docs/03 section 2.7).
    function commissionRoom(uint32 k) external view returns (uint256) {
        return HuiMath.commissionRoom(_statutoryMaxBid(k), _payers(k));
    }

    /// @notice max(0, (N - 1) - lateCount), 0 once defaulted: the weight of `m` in the reserve split (ADR-24).
    function onTimeWeight(address m) external view returns (uint16) {
        MemberInfo storage mi = _info[m];
        return uint16(HuiMath.onTimeWeight(_params.memberCount, mi.lateCount, mi.defaulted));
    }

    /// @notice O(k) = k * (N - k) * C.
    function exposure(uint32 k) external view returns (uint256) {
        return HuiMath.exposure(_params.memberCount, k, _params.contribution);
    }

    /// @notice O_max, the peak exposure.
    function maxExposure() external view returns (uint256) {
        return HuiMath.maxExposure(_params.memberCount, _params.contribution);
    }

    /// @notice Coverage index in bps using the current reserve.
    function coverageIndexBps() external view returns (uint256) {
        return
            HuiMath.coverageIndexBps(
                _params.alphaBps, bondRemaining, reserve, _params.memberCount, _params.contribution
            );
    }
}
