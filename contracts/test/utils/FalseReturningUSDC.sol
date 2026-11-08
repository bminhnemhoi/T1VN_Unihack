// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @notice Test-only token that REPORTS FAILURE instead of reverting: `transfer` and `transferFrom` return `false`
/// without moving anything when the sender (`from`) or the recipient is flagged. Unlike the blacklist of `MockUSDC`
/// (which reverts) this exercises the `ok == false` branch of the circle's `_pull` and `_pay` (docs/03 section 6.7).
contract FalseReturningUSDC is MockUSDC {
    mapping(address => bool) public returnsFalseFrom;
    mapping(address => bool) public returnsFalseTo;

    function setReturnsFalseFrom(address a, bool v) external {
        returnsFalseFrom[a] = v;
    }

    function setReturnsFalseTo(address a, bool v) external {
        returnsFalseTo[a] = v;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (returnsFalseFrom[msg.sender] || returnsFalseTo[to]) return false;
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (returnsFalseFrom[from] || returnsFalseTo[to]) return false;
        return super.transferFrom(from, to, value);
    }
}
