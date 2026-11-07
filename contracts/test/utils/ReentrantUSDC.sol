// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @notice Test-only malicious USDC: a `MockUSDC` whose `transfer` / `transferFrom` call back into a chosen target
/// (a circle) from the middle of the token movement, as an ERC-777 style receive hook or a hostile token would.
/// @dev The hook fires once per `arm`, AFTER the balances moved (the worst moment for the circle: tokens are already
/// in or out, its own bookkeeping is mid-flight). The callback is made as `attacker` through `vm.prank`, which models
/// a member that is a contract wallet reacting to the transfer. The low-level call result is recorded, not bubbled,
/// so the outer transfer still completes and the test can read what the re-entry got.
contract ReentrantUSDC is MockUSDC {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    enum Side {
        None,
        /// @dev Fire when `who` is the recipient of a `transfer` or `transferFrom`.
        Recipient,
        /// @dev Fire when `who` is the source of a `transfer` or `transferFrom`.
        Source
    }

    Side public side;
    address public who;
    address public attacker;
    address public target;
    bytes public payload;

    /// @dev Matching movements to let pass before the hook fires (0 = the first one).
    uint256 public skip;

    uint256 public hookCalls;
    bool public lastOk;
    bytes public lastReturn;
    bool private _inHook;

    /// @notice Arm a single re-entry: when `who_` is on `side_` of the next matching movement, `attacker_` calls
    /// `target_` with `payload_`.
    function arm(Side side_, address who_, address attacker_, address target_, bytes calldata payload_) external {
        side = side_;
        who = who_;
        attacker = attacker_;
        target = target_;
        payload = payload_;
        skip = 0;
    }

    /// @notice Like `arm`, but the hook fires at the `skip_ + 1`-th matching movement (for example the late fee pull
    /// that follows the principal pull in `payLate` and `repayDebt`).
    function armNth(
        Side side_,
        address who_,
        address attacker_,
        address target_,
        bytes calldata payload_,
        uint256 skip_
    ) external {
        side = side_;
        who = who_;
        attacker = attacker_;
        target = target_;
        payload = payload_;
        skip = skip_;
    }

    function disarm() external {
        side = Side.None;
    }

    /// @notice The 4-byte selector of the last re-entry's revert data (0 if it did not revert or had no data).
    function lastRevertSelector() external view returns (bytes4 sel) {
        if (lastOk || lastReturn.length < 4) return bytes4(0);
        bytes memory r = lastReturn;
        assembly ("memory-safe") {
            sel := mload(add(r, 0x20))
        }
    }

    function transfer(address to, uint256 value) public override returns (bool ok) {
        ok = super.transfer(to, value);
        _maybeFire(msg.sender, to);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool ok) {
        ok = super.transferFrom(from, to, value);
        _maybeFire(from, to);
    }

    function _maybeFire(address from, address to) private {
        if (_inHook) return;
        Side s = side;
        if (s == Side.None) return;
        if (!((s == Side.Recipient && to == who) || (s == Side.Source && from == who))) return;
        if (skip != 0) {
            skip -= 1;
            return;
        }
        side = Side.None; // fire once
        _inHook = true;
        VM.prank(attacker);
        (bool ok, bytes memory ret) = target.call(payload);
        _inHook = false;
        hookCalls += 1;
        lastOk = ok;
        lastReturn = ret;
    }
}
