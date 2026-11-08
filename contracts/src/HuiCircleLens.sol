// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HuiCircleBase} from "./HuiCircleBase.sol";
import {HuiCircleViews} from "./HuiCircleViews.sol";

/// @title HuiCircleLens
/// @notice Deployed once next to the `HuiCircle` implementation. Circles delegate their read-only functions here; it
/// holds no state of its own and cannot move funds (it has no function that writes storage or transfers).
contract HuiCircleLens is HuiCircleViews {
    constructor() HuiCircleBase(address(0)) {
        _disableInitializers();
    }
}
