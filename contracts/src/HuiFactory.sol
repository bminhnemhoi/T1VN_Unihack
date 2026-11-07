// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {IHuiCircle} from "./interfaces/IHuiCircle.sol";
import {IHuiFactory} from "./interfaces/IHuiFactory.sol";
import {CircleMode, CircleParams, FactoryConfig} from "./libraries/HuiTypes.sol";

/// @title HuiFactory
/// @notice Creates HuiCircle clones (EIP-1167), keeps the circle registry, the factory config and the number of
/// active circles per organizer, and relays the admin's pause / unpause / unwind commands (docs/05 section 3.1).
/// @dev Holds no USDC and has no function that moves user funds. `createCircle` goes through ERC-2771, so the
/// organizer is the signer of the forward request. No Multicall (ADR-06).
contract HuiFactory is ERC2771Context, IHuiFactory {
    // ------------------------------------------------------------------ errors
    /// @dev Same name and signature as IHuiCircle.InvalidParams; codes in docs/05 section 4.3.
    error InvalidParams(uint8 code);
    error NotAdmin();
    /// @dev Caller of onActivated/onFinished, or target of pause/unpause/unwind, is not a circle of this factory.
    error NotCircle(address who);
    error ZeroAddress();
    /// @dev A FactoryConfig field is out of its structural range (see `_checkConfig`).
    error InvalidConfig();

    // ------------------------------------------------------------------ constants
    /// @notice Smallest allowed contribution, 1 USDC (docs/03 section 3.1).
    uint96 public constant MIN_CONTRIBUTION = 1e6;
    uint32 internal constant MIN_PERIOD = 1 days;
    uint32 internal constant MAX_PERIOD = 31 days;
    uint32 internal constant MIN_ROUND_DURATION = 120;
    uint32 internal constant MIN_WINDOW = 30;
    uint32 internal constant MIN_GRACE = 60;
    uint16 internal constant BPS = 10_000;
    /// @dev Hard ceilings from the spec that no admin config may exceed: fee <= 3%, reserve <= 3% (docs/03 section 1),
    /// annual interest cap 20% (Decree 19/2019 Art. 21) and late rate at most 50% of it (Art. 22 clause 1).
    uint16 internal constant HARD_MAX_FEE_BPS = 300;
    uint16 internal constant HARD_MAX_RESERVE_BPS = 300;
    uint16 internal constant HARD_MAX_CAP_BPS = 2000;
    uint16 internal constant HARD_MAX_LATE_RATE_BPS = 1000;
    uint16 internal constant MAX_REVEAL_BOND_BPS = 500;
    /// @dev Hard bound of the member loop in HuiCircle (CLAUDE.md: N <= 30).
    uint8 internal constant HARD_MAX_MEMBERS = 30;
    /// @dev Documented lower bound of N (docs/03 section 3.1).
    uint8 internal constant HARD_MIN_MEMBERS = 3;

    // ------------------------------------------------------------------ storage
    /// @inheritdoc IHuiFactory
    address public immutable override implementation;
    /// @inheritdoc IHuiFactory
    address public immutable override admin;

    FactoryConfig internal _config;
    address[] internal _allCircles;
    mapping(address => address[]) internal _circlesOf;
    mapping(address => uint256) internal _activeCirclesOf;
    mapping(address => bool) internal _isCircle;

    modifier onlyAdmin() {
        if (_msgSender() != admin) revert NotAdmin();
        _;
    }

    modifier onlyCircle() {
        address sender = _msgSender();
        if (!_isCircle[sender]) revert NotCircle(sender);
        _;
    }

    /// @param admin_ Safe multisig (testnet: the deployer wallet).
    /// @param implementation_ The HuiCircle implementation that every circle clones.
    /// @param config_ Initial configuration; `config_.forwarder` becomes this factory's trusted forwarder.
    constructor(address admin_, address implementation_, FactoryConfig memory config_)
        ERC2771Context(config_.forwarder)
    {
        if (admin_ == address(0) || implementation_ == address(0)) {
            revert ZeroAddress();
        }
        _checkConfig(config_);
        // Every clone trusts the implementation's immutable forwarder, so it must be the one the config names.
        if (ERC2771Context(implementation_).trustedForwarder() != config_.forwarder) revert InvalidConfig();
        admin = admin_;
        implementation = implementation_;
        _config = config_;
        emit ConfigUpdated(config_);
    }

    // ------------------------------------------------------------------ create

    /// @inheritdoc IHuiFactory
    /// @dev Validates `p` against docs/05 section 4.3 (first failing check wins, in table order), clones the
    /// implementation and initializes the clone in the same transaction.
    function createCircle(CircleParams calldata p) external override returns (address circle) {
        address organizer = _msgSender();
        _validate(p);

        circle = Clones.clone(implementation);
        _isCircle[circle] = true;
        _allCircles.push(circle);
        _circlesOf[organizer].push(circle);

        IHuiCircle(circle).initialize(organizer, p, _config);

        emit CircleCreated(circle, organizer, p.mode, p.memberCount, p.contribution, p.label);
    }

    // ------------------------------------------------------------------ config

    /// @inheritdoc IHuiFactory
    function config() external view override returns (FactoryConfig memory) {
        return _config;
    }

    /// @inheritdoc IHuiFactory
    /// @dev Applies only to circles created afterwards: every circle copies the values it needs in `initialize`.
    /// The forwarder cannot change, because it is an immutable of both this factory and the implementation.
    function setConfig(FactoryConfig calldata c) external override onlyAdmin {
        _checkConfig(c);
        _config = c;
        emit ConfigUpdated(c);
    }

    // ------------------------------------------------------------------ registry

    /// @inheritdoc IHuiFactory
    function allCircles() external view override returns (address[] memory) {
        return _allCircles;
    }

    /// @inheritdoc IHuiFactory
    function circlesOf(address organizer) external view override returns (address[] memory) {
        return _circlesOf[organizer];
    }

    /// @inheritdoc IHuiFactory
    function activeCirclesOf(address organizer) external view override returns (uint256) {
        return _activeCirclesOf[organizer];
    }

    /// @inheritdoc IHuiFactory
    function isCircle(address a) external view override returns (bool) {
        return _isCircle[a];
    }

    /// @inheritdoc IHuiFactory
    function onActivated(address organizer) external override onlyCircle {
        _activeCirclesOf[organizer] += 1;
    }

    /// @inheritdoc IHuiFactory
    function onFinished(address organizer) external override onlyCircle {
        _activeCirclesOf[organizer] -= 1;
    }

    // ------------------------------------------------------------------ admin: pause / unpause / unwind

    /// @inheritdoc IHuiFactory
    function pauseCircle(address circle) external override onlyAdmin {
        _requireCircle(circle);
        IHuiCircle(circle).pause();
        emit CirclePausedByAdmin(circle);
    }

    /// @inheritdoc IHuiFactory
    function unpauseCircle(address circle) external override onlyAdmin {
        _requireCircle(circle);
        IHuiCircle(circle).unpause();
        emit CircleUnpausedByAdmin(circle);
    }

    /// @inheritdoc IHuiFactory
    /// @dev The circle itself enforces "Paused continuously for at least 48 hours" and reverts `UnwindTooEarly`.
    function unwindCircle(address circle) external override onlyAdmin {
        _requireCircle(circle);
        IHuiCircle(circle).emergencyUnwind();
    }

    // ------------------------------------------------------------------ internals

    function _requireCircle(address circle) internal view {
        if (!_isCircle[circle]) revert NotCircle(circle);
    }

    /// @dev Parameter checks of docs/05 section 4.3, in table order.
    function _validate(CircleParams calldata p) internal view {
        FactoryConfig storage cfg = _config;

        if (p.memberCount < cfg.minMembers || p.memberCount > cfg.maxMembers) revert InvalidParams(1);
        // docs/05 4.3: contribution == 0 or above the cap; docs/03 3.1 also requires at least 1 USDC.
        if (p.contribution < MIN_CONTRIBUTION || p.contribution > cfg.maxContribution) revert InvalidParams(2);
        if (p.periodSeconds < MIN_PERIOD || p.periodSeconds > MAX_PERIOD) revert InvalidParams(3);
        if (p.roundDuration < MIN_ROUND_DURATION) revert InvalidParams(4);
        if (p.mode == CircleMode.Bidding) {
            if (
                p.commitWindow < MIN_WINDOW || p.revealWindow < MIN_WINDOW
                    || uint256(p.commitWindow) + uint256(p.revealWindow) > p.roundDuration
            ) revert InvalidParams(5);
        } else if (p.commitWindow != 0 || p.revealWindow != 0) {
            revert InvalidParams(6);
        }
        if (p.graceSeconds < MIN_GRACE) revert InvalidParams(7);
        if (p.alphaBps > BPS) revert InvalidParams(8);
        if (p.feeBps > cfg.maxFeeBps || (p.feeBps > 0 && !p.commissionMode)) revert InvalidParams(9);
        if (p.reserveBps > cfg.maxReserveBps) revert InvalidParams(10);
        if (p.revealBondBps > MAX_REVEAL_BOND_BPS) revert InvalidParams(11);
        if (p.capBps > cfg.maxCapBps) revert InvalidParams(12);
        if (p.joinDeadline <= block.timestamp) revert InvalidParams(13);
    }

    /// @dev Structural sanity of a config: non-zero addresses, forwarder unchanged, every bps value <= 10_000 (fee,
    /// reserve, cap and late rate also within the spec hard ceilings) and
    /// 3 <= minMembers <= maxMembers <= 30 (the member loop of HuiCircle is only safe up to 30).
    function _checkConfig(FactoryConfig memory c) internal view {
        if (c.usdc == address(0) || c.forwarder == address(0) || c.reputation == address(0) || c.attester == address(0))
        {
            revert ZeroAddress();
        }
        if (c.forwarder != trustedForwarder()) revert InvalidConfig();
        if (
            c.maxCapBps > BPS || c.lateRateBps > BPS || c.minCoverageBps > BPS || c.maxFeeBps > BPS
                || c.maxReserveBps > BPS
        ) revert InvalidConfig();
        if (
            c.maxFeeBps > HARD_MAX_FEE_BPS || c.maxReserveBps > HARD_MAX_RESERVE_BPS || c.maxCapBps > HARD_MAX_CAP_BPS
                || c.lateRateBps > HARD_MAX_LATE_RATE_BPS
        ) revert InvalidConfig();
        if (c.minMembers < HARD_MIN_MEMBERS || c.minMembers > c.maxMembers || c.maxMembers > HARD_MAX_MEMBERS) {
            revert InvalidConfig();
        }
        if (c.maxContribution < MIN_CONTRIBUTION) revert InvalidConfig();
    }
}
