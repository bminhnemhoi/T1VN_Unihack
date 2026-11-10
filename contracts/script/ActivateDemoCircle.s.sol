// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {HuiFactory} from "../src/HuiFactory.sol";
import {HuiCircle} from "../src/HuiCircle.sol";
import {IHuiCircle} from "../src/interfaces/IHuiCircle.sol";
import {CircleParams, CircleState} from "../src/libraries/HuiTypes.sol";

/// @title ActivateDemoCircle
/// @notice The organizer starts ONE demo circle (the "Bắt đầu dây" button of the web, for a circle whose organizer is
/// the script's organizer wallet and not a Privy account). Use it once the last seat of a circle left free by
/// `JoinDemoCircles` (`DEMO_MEMBERS=4`) has been taken by a person joining through the web.
/// @dev Testnet only (hard rule 1): Fuji (43113) or a local anvil (31337); any other chain id reverts before anything
/// is broadcast. Everything is checked BEFORE the broadcast so a premature run reverts with a readable reason instead
/// of spending gas on a failing `activate()`: the address is a circle of this factory, the key is that circle's
/// organizer, the circle is `Forming` and full (members == N), its join deadline has not passed and its coverage index
/// reaches the factory minimum. Environment (the key is read with `vm.envUint`, never from the command line, never
/// printed): `DEMO_ORGANIZER_PRIVATE_KEY`, `CIRCLE` (the circle address), optional `DEPLOY_FILE` (default
/// `deployments/fuji.json` / `deployments/anvil.json`).
contract ActivateDemoCircle is Script {
    uint256 internal constant FUJI_CHAIN_ID = 43113;
    uint256 internal constant ANVIL_CHAIN_ID = 31337;

    /// @dev Chain is neither Fuji nor anvil (mainnet 43114 lands here).
    error UnsupportedChain(uint256 chainId);
    /// @dev The deployment file is missing a contract or the factory has no code.
    error NotDeployed(string file);
    /// @dev `circle` was not created by the factory of the deployment file.
    error NotACircle(address circle);
    /// @dev The key is not the circle's organizer.
    error NotOrganizer(address signer, address organizer);
    /// @dev The circle is not `Forming` (already started, cancelled, ...).
    error NotForming(CircleState state);
    /// @dev Fewer members than seats: wait for the missing ones (or run `JoinDemoCircles` for the demo wallets).
    error NotFull(uint256 have, uint256 need);
    /// @dev The join deadline passed: `activate()` would revert and the circle can only be cancelled.
    error JoinDeadlinePassed(uint64 deadline);
    /// @dev The circle's coverage index is under the factory minimum (`activate()` would revert `CoverageTooLow`).
    error CoverageBelowMinimum(uint256 bps, uint256 minBps);
    /// @dev `activate()` did not leave the circle `Active`.
    error SanityCheckFailed(string what);

    /// @notice Reads the environment and calls `execute`; this is the entry point for `forge script`.
    function run() external returns (CircleState) {
        string memory defaultPath = block.chainid == FUJI_CHAIN_ID ? "deployments/fuji.json" : "deployments/anvil.json";
        return execute(
            vm.envUint("DEMO_ORGANIZER_PRIVATE_KEY"), vm.envOr("DEPLOY_FILE", defaultPath), vm.envAddress("CIRCLE")
        );
    }

    /// @notice Checks the circle, then activates it with `organizerKey`. Returns the state afterwards (`Active`).
    function execute(uint256 organizerKey, string memory file, address circle) public returns (CircleState) {
        if (block.chainid != FUJI_CHAIN_ID && block.chainid != ANVIL_CHAIN_ID) revert UnsupportedChain(block.chainid);
        string memory json = vm.readFile(file);
        HuiFactory factory = HuiFactory(vm.parseJsonAddress(json, ".factory"));
        if (address(factory).code.length == 0) revert NotDeployed(file);
        if (!factory.isCircle(circle)) revert NotACircle(circle);

        HuiCircle c = HuiCircle(payable(circle));
        address signer = vm.addr(organizerKey);
        if (c.organizer() != signer) revert NotOrganizer(signer, c.organizer());
        CircleState before = c.state();
        if (before != CircleState.Forming) revert NotForming(before);

        CircleParams memory p = IHuiCircle(circle).params();
        uint256 have = IHuiCircle(circle).members().length;
        if (have != p.memberCount) revert NotFull(have, p.memberCount);
        if (block.timestamp > p.joinDeadline) revert JoinDeadlinePassed(p.joinDeadline);
        uint256 coverage = IHuiCircle(circle).coverageIndexBps();
        uint256 minimum = c.minCoverageBps();
        if (coverage < minimum) revert CoverageBelowMinimum(coverage, minimum);

        vm.startBroadcast(organizerKey);
        c.activate();
        vm.stopBroadcast();

        CircleState afterState = c.state();
        if (afterState != CircleState.Active) revert SanityCheckFailed("active");
        console2.log("chainId", block.chainid);
        console2.log("circle", circle);
        console2.log("members", have);
        console2.log("coverage index", coverage);
        console2.log("activated", true);
        return afterState;
    }
}
