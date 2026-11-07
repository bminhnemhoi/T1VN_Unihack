// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IHuiCircle} from "./interfaces/IHuiCircle.sol";
import {IHuiFactory} from "./interfaces/IHuiFactory.sol";
import {CircleParams, CircleState, FactoryConfig} from "./libraries/HuiTypes.sol";

/// @title HuiCircle
/// @notice One rotating-savings circle. This is the SKELETON delivered with the factory (task C3): it can be cloned,
/// initialized once by the factory and read back. The money flows (docs/03 sections 5-6) are added by tasks C4-C7.
/// @dev Deployed once as an implementation; every circle is an EIP-1167 clone of it. The forwarder is an immutable of
/// the implementation (ERC2771Context), so every clone shares it. Use `_msgSender()`, never `msg.sender`. No Multicall.
contract HuiCircle is ERC2771Context, Initializable {
    // ------------------------------------------------------------------ storage (docs/05 section 2.1, partial)
    IHuiFactory public factory;
    address public organizer;
    IERC20 public usdc;
    address public reputation;
    address public attester;
    uint16 public lateRateBps; // copied from the factory config at initialize
    uint16 public minCoverageBps;

    CircleParams internal _params;
    CircleState public state;

    /// @param forwarder_ ERC-2771 trusted forwarder shared by all clones.
    constructor(address forwarder_) ERC2771Context(forwarder_) {
        _disableInitializers();
    }

    /// @notice Initialize a freshly cloned circle. Callable exactly once; the caller becomes the recorded factory.
    /// @dev The factory clones and initializes in the same transaction, so nobody else can front-run this call.
    /// @param organizer_ The circle organizer (the factory passes its `_msgSender()`).
    /// @param p Creation parameters, already validated by the factory.
    /// @param cfg Factory configuration snapshot at creation time.
    function initialize(address organizer_, CircleParams calldata p, FactoryConfig calldata cfg) external initializer {
        factory = IHuiFactory(_msgSender());
        organizer = organizer_;
        usdc = IERC20(cfg.usdc);
        reputation = cfg.reputation;
        attester = cfg.attester;
        lateRateBps = cfg.lateRateBps;
        minCoverageBps = cfg.minCoverageBps;
        _params = p;
        state = CircleState.Forming;
    }

    /// @notice Creation parameters, immutable after `activate()` (docs/03 section 3.1).
    function params() external view returns (CircleParams memory) {
        return _params;
    }
}
