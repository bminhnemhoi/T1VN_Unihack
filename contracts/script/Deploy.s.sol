// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

import {HuiCircle} from "../src/HuiCircle.sol";
import {HuiCircleLens} from "../src/HuiCircleLens.sol";
import {HuiFactory} from "../src/HuiFactory.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {FactoryConfig} from "../src/libraries/HuiTypes.sol";

/// @title Deploy
/// @notice Deploys the whole HuiSafe system in the order fixed by docs/05 section 3.3 and wires it:
/// forwarder, registry, lens, circle implementation, factory, then `registry.setFactory(factory)`.
/// @dev Testnet only (hard rule 1): runs on Fuji (43113) and on a local anvil (31337); any other chain id,
/// mainnet 43114 included, reverts before anything is broadcast. The deployer key is read with
/// `vm.envUint("DEPLOYER_PRIVATE_KEY")` (never passed on the command line in real use). Environment read by `run()`:
///   DEPLOYER_PRIVATE_KEY  required, testnet wallet.
///   ADMIN                 optional, defaults to the deployer (testnet). If it differs from the deployer the
///                         script cannot call `registry.setFactory` and says so; the admin must call it.
///   ATTESTER_ADDRESS      address of the attester signing key. Required on Fuji (role separation, ADR-21);
///                         defaults to the deployer on anvil.
///   USDC                  optional; defaults to Circle's Fuji USDC. On anvil, unset means a fresh MockUSDC.
///   RELAYER_ADDRESS       optional, only recorded in the json file.
///   GIT_COMMIT            optional short hash recorded in the json file (export `$(git rev-parse --short HEAD)`).
///   DEPLOY_OUT            optional output path under ./deployments; default `deployments/fuji.json` on Fuji
///                         and `deployments/anvil.json` on anvil.
///   WRITE_DEPLOYMENT      Fuji only: the json file is written only when this is `true`, so a simulation never
///                         overwrites the committed fuji.json. Anvil always writes.
///   ALLOW_UNWIRED         Fuji only: by default the admin must equal the deployer so the script can call
///                         `registry.setFactory`; `true` allows a different admin (json then records `"wired": false`).
///                         On Fuji the attester must differ from both the deployer and the admin (ADR-21).
contract Deploy is Script {
    uint256 internal constant FUJI_CHAIN_ID = 43113;
    uint256 internal constant ANVIL_CHAIN_ID = 31337;
    address internal constant FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;
    uint96 internal constant MAX_CONTRIBUTION = 10_000e6;

    /// @dev Chain is neither Fuji nor anvil (mainnet 43114 lands here).
    error UnsupportedChain(uint256 chainId);
    /// @dev A required address was not provided for this chain.
    error MissingEnv(string name);
    /// @dev Fuji: the attester key must not be the deployer or the admin (ADR-21 role separation).
    error AttesterNotSeparate(address attester);
    /// @dev Fuji: admin differs from the deployer and `ALLOW_UNWIRED` is not set.
    error AdminNotDeployer(address admin, address deployer);
    /// @dev A post-deploy sanity check failed.
    error SanityCheckFailed(string what);

    /// @notice Inputs of `execute`; `run()` fills them from the environment.
    struct Params {
        uint256 deployerKey;
        address admin;
        address attester;
        address usdc;
        address relayer;
        string gitCommit;
        string outPath;
        bool writeDeployment; // Fuji: write the json file only when true (anvil always writes)
        bool allowUnwired; // Fuji: allow admin != deployer (registry.setFactory is then left to the admin)
    }

    /// @notice Addresses produced by a run (also written to the json file).
    struct Deployment {
        address usdc;
        address forwarder;
        address reputation;
        address lens;
        address implementation;
        address factory;
        address admin;
        address attester;
        address relayer;
        bool wired;
    }

    /// @notice Reads the environment and calls `execute`; this is the entry point for `forge script`.
    function run() external returns (Deployment memory d) {
        Params memory p;
        p.deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        p.admin = vm.envOr("ADMIN", address(0));
        p.attester = vm.envOr("ATTESTER_ADDRESS", address(0));
        p.usdc = vm.envOr("USDC", address(0));
        p.relayer = vm.envOr("RELAYER_ADDRESS", address(0));
        p.gitCommit = vm.envOr("GIT_COMMIT", string("unknown"));
        string memory defaultPath = "deployments/anvil.json";
        if (block.chainid == FUJI_CHAIN_ID) defaultPath = "deployments/fuji.json";
        p.outPath = vm.envOr("DEPLOY_OUT", defaultPath);
        p.writeDeployment = vm.envOr("WRITE_DEPLOYMENT", false);
        p.allowUnwired = vm.envOr("ALLOW_UNWIRED", false);
        return execute(p);
    }

    /// @notice Deploys and wires the system, broadcasting with `p.deployerKey`, and writes the json file.
    /// Zero `admin` means the deployer; zero `attester` means the deployer on anvil and reverts on Fuji; zero `usdc`
    /// means Circle's USDC on Fuji and a fresh `MockUSDC` on anvil.
    function execute(Params memory p) public returns (Deployment memory d) {
        if (block.chainid != FUJI_CHAIN_ID && block.chainid != ANVIL_CHAIN_ID) revert UnsupportedChain(block.chainid);

        address deployer = vm.addr(p.deployerKey);
        d.admin = p.admin == address(0) ? deployer : p.admin;
        d.attester = p.attester;
        if (d.attester == address(0)) {
            if (block.chainid == FUJI_CHAIN_ID) revert MissingEnv("ATTESTER_ADDRESS");
            d.attester = deployer;
        }
        d.relayer = p.relayer;
        d.usdc = p.usdc;
        if (d.usdc == address(0) && block.chainid == FUJI_CHAIN_ID) d.usdc = FUJI_USDC;
        if (block.chainid == FUJI_CHAIN_ID) {
            if (d.attester == deployer || d.attester == d.admin) revert AttesterNotSeparate(d.attester);
            if (d.admin != deployer && !p.allowUnwired) revert AdminNotDeployer(d.admin, deployer);
            if (d.usdc.code.length == 0) revert SanityCheckFailed("usdc.code");
            if (IERC20Metadata(d.usdc).decimals() != 6) revert SanityCheckFailed("usdc.decimals");
        }

        vm.startBroadcast(p.deployerKey);
        if (d.usdc == address(0)) d.usdc = address(new MockUSDC());
        // 1. forwarder  2. registry  3. lens  4. implementation  5. factory  6. wiring.
        d.forwarder = address(new ERC2771Forwarder("HuiSafeForwarder"));
        ReputationRegistry registry = new ReputationRegistry(d.admin);
        d.reputation = address(registry);
        d.lens = address(new HuiCircleLens());
        d.implementation = address(new HuiCircle(d.forwarder, d.lens));
        HuiFactory factory = new HuiFactory(d.admin, d.implementation, _config(d));
        d.factory = address(factory);
        if (d.admin == deployer) {
            registry.setFactory(d.factory);
            d.wired = true;
        }
        vm.stopBroadcast();

        _sanityCheck(d);
        _log(d);
        if (block.chainid != FUJI_CHAIN_ID || p.writeDeployment) {
            _write(d, p);
        } else {
            console2.log("deployment json not written; set WRITE_DEPLOYMENT=true");
        }
    }

    function _config(Deployment memory d) internal pure returns (FactoryConfig memory c) {
        c = FactoryConfig({
            usdc: d.usdc,
            forwarder: d.forwarder,
            reputation: d.reputation,
            attester: d.attester,
            maxCapBps: 2000,
            lateRateBps: 1000,
            minCoverageBps: 5000,
            maxFeeBps: 300,
            maxReserveBps: 300,
            minMembers: 3,
            maxMembers: 30,
            maxContribution: MAX_CONTRIBUTION
        });
    }

    function _sanityCheck(Deployment memory d) internal view {
        HuiFactory factory = HuiFactory(d.factory);
        if (factory.implementation() != d.implementation) revert SanityCheckFailed("factory.implementation");
        if (factory.admin() != d.admin) revert SanityCheckFailed("factory.admin");
        FactoryConfig memory c = factory.config();
        if (c.forwarder != d.forwarder) revert SanityCheckFailed("config.forwarder");
        if (c.reputation != d.reputation) revert SanityCheckFailed("config.reputation");
        if (c.usdc != d.usdc) revert SanityCheckFailed("config.usdc");
        if (ReputationRegistry(d.reputation).admin() != d.admin) revert SanityCheckFailed("registry.admin");
        if (c.attester != d.attester) revert SanityCheckFailed("config.attester");
        if (HuiCircle(payable(d.implementation)).trustedForwarder() != d.forwarder) {
            revert SanityCheckFailed("implementation.forwarder");
        }
        if (HuiCircle(payable(d.implementation)).lens() != d.lens) revert SanityCheckFailed("implementation.lens");
        if (d.wired && ReputationRegistry(d.reputation).factory() != d.factory) {
            revert SanityCheckFailed("registry.factory");
        }
    }

    function _log(Deployment memory d) internal view {
        console2.log("chainId", block.chainid);
        console2.log("usdc", d.usdc);
        console2.log("forwarder", d.forwarder);
        console2.log("reputation", d.reputation);
        console2.log("circleLens", d.lens);
        console2.log("circleImplementation", d.implementation);
        console2.log("factory", d.factory);
        console2.log("admin", d.admin);
        console2.log("attester", d.attester);
        if (d.wired) {
            console2.log("registry.setFactory: done");
        } else {
            console2.log("ACTION REQUIRED: admin must call registry.setFactory(factory) (admin is not the deployer)");
        }
    }

    function _write(Deployment memory d, Params memory p) internal {
        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "usdc", d.usdc);
        vm.serializeAddress(k, "forwarder", d.forwarder);
        vm.serializeAddress(k, "reputation", d.reputation);
        vm.serializeAddress(k, "circleLens", d.lens);
        vm.serializeAddress(k, "circleImplementation", d.implementation);
        vm.serializeAddress(k, "factory", d.factory);
        vm.serializeAddress(k, "admin", d.admin);
        vm.serializeAddress(k, "attester", d.attester);
        vm.serializeAddress(k, "relayer", d.relayer);
        vm.serializeString(k, "deployedAt", _iso(block.timestamp));
        vm.serializeUint(k, "deployBlock", block.number); // lower bound for event scans (docs/05 section 6.2)
        if (!d.wired) vm.serializeBool(k, "wired", false);
        string memory json = vm.serializeString(k, "gitCommit", p.gitCommit);
        vm.writeJson(json, p.outPath);
        console2.log("written", p.outPath);
    }

    /// @dev UTC timestamp as `YYYY-MM-DDTHH:MM:SSZ` (civil-from-days, H. Hinnant).
    function _iso(uint256 ts) internal pure returns (string memory) {
        uint256 z = ts / 1 days + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 day = doy - (153 * mp + 2) / 5 + 1;
        uint256 month = mp < 10 ? mp + 3 : mp - 9;
        uint256 year = yoe + era * 400 + (month <= 2 ? 1 : 0);
        uint256 s = ts % 1 days;
        return string.concat(
            vm.toString(year),
            "-",
            _pad(month),
            "-",
            _pad(day),
            "T",
            _pad(s / 1 hours),
            ":",
            _pad((s % 1 hours) / 1 minutes),
            ":",
            _pad(s % 1 minutes),
            "Z"
        );
    }

    function _pad(uint256 v) private pure returns (string memory) {
        return v < 10 ? string.concat("0", vm.toString(v)) : vm.toString(v);
    }
}
