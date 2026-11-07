// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";

import {IHuiFactory} from "../../src/interfaces/IHuiFactory.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {CircleParams, FactoryConfig} from "../../src/libraries/HuiTypes.sol";

/// @notice Test double of a circle clone: records the calls the factory forwards (pause, unpause, unwind) and can
/// call the factory back like a real circle (onActivated, onFinished). Used until HuiCircle implements C4-C7.
contract StubCircle is ERC2771Context, Initializable {
    address public factory;
    address public organizer;
    uint256 public pauseCalls;
    uint256 public unpauseCalls;
    uint256 public unwindCalls;
    bool public unwindReverts;

    constructor(address forwarder_) ERC2771Context(forwarder_) {
        _disableInitializers();
    }

    function initialize(address organizer_, CircleParams calldata, FactoryConfig calldata) external initializer {
        factory = msg.sender;
        organizer = organizer_;
    }

    function pause() external {
        pauseCalls++;
    }

    function unpause() external {
        unpauseCalls++;
    }

    function emergencyUnwind() external {
        if (unwindReverts) revert IHuiCircle.UnwindTooEarly();
        unwindCalls++;
    }

    function setUnwindReverts(bool v) external {
        unwindReverts = v;
    }

    function notifyActivated() external {
        IHuiFactory(factory).onActivated(organizer);
    }

    function notifyFinished() external {
        IHuiFactory(factory).onFinished(organizer);
    }
}
