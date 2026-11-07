// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @notice MockUSDC that remembers every `transfer` and `transferFrom` in an append-only log. The invariant Handler
/// replays the entries produced by one call to prove INV-04 (nobody is pulled for more than they owe) and INV-07 (USDC
/// only reaches members, the organizer and holders of `claimable`, never the admin).
/// @dev Test-only. `MockUSDC._update` is not virtual, so the log is kept at the public `transfer` and `transferFrom`
/// entry points: every movement the circle makes goes through them. Mints and `receiveWithAuthorization` are not
/// recorded (the circle never calls them). The spender of a `transferFrom` is not recorded: only the circle pulls.
contract RecordingUSDC is MockUSDC {
    struct Entry {
        address from;
        address to;
        uint256 amount;
    }

    Entry[] internal _log;

    /// @notice Number of entries recorded so far; take it before a call and replay from there afterwards.
    function recordCount() external view returns (uint256) {
        return _log.length;
    }

    /// @notice Entry `i` of the log.
    function recordAt(uint256 i) external view returns (address from, address to, uint256 amount) {
        Entry storage e = _log[i];
        return (e.from, e.to, e.amount);
    }

    /// @notice ERC-20 transfer, recorded.
    function transfer(address to, uint256 value) public override returns (bool) {
        bool ok = super.transfer(to, value);
        _log.push(Entry({from: msg.sender, to: to, amount: value}));
        return ok;
    }

    /// @notice ERC-20 transferFrom, recorded.
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        bool ok = super.transferFrom(from, to, value);
        _log.push(Entry({from: from, to: to, amount: value}));
        return ok;
    }
}
