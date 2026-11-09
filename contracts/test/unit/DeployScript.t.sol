// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Deploy} from "../../script/Deploy.s.sol";
import {HuiCircle} from "../../src/HuiCircle.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {ReputationRegistry} from "../../src/ReputationRegistry.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {FactoryConfig} from "../../src/libraries/HuiTypes.sol";

/// @notice Runs `script/Deploy.s.sol` inside the test VM (no real broadcast) with a throwaway key. Tests call `execute(Params)` so they do not share
/// process-wide environment variables (forge runs tests in parallel); only `test_Run_ReadsEnvironment` sets env.
/// Output goes to one scratch file per test under ./deployments (git-ignored) and is removed at the end of the test.
contract DeployScriptTest is Test {
    uint256 internal constant DEPLOYER_KEY = 0xA11CE; // throwaway test key, holds nothing anywhere
    address internal deployer;
    address internal constant FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;
    uint256 internal constant NOT_FUJI_CHAIN = 43_114;

    Deploy internal script;
    string internal out;

    function setUp() public {
        script = new Deploy();
        deployer = vm.addr(DEPLOYER_KEY);
        // The Fuji pre-checks need code at Circle's USDC address, which the test VM does not have.
        vm.etch(FUJI_USDC, address(new MockUSDC()).code);
    }

    /// @dev forge-std has no tearDown hook: tests that write a file call this as their last step.
    function _cleanup() internal {
        if (bytes(out).length != 0 && vm.exists(out)) vm.removeFile(out);
    }

    function _params(string memory name) internal returns (Deploy.Params memory p) {
        out = string.concat("deployments/DeployScript.", name, ".test.json");
        p.deployerKey = DEPLOYER_KEY;
        p.gitCommit = "abcdef1";
        p.outPath = out;
    }

    function _fujiParams(string memory name) internal returns (Deploy.Params memory p) {
        vm.chainId(43_113);
        p = _params(name);
        p.attester = makeAddr("attester");
    }

    function test_Execute_Anvil_WiresEverything() public {
        vm.chainId(31337);
        Deploy.Deployment memory d = script.execute(_params("wires"));

        assertTrue(d.wired);
        assertEq(d.admin, deployer);
        assertEq(d.attester, deployer);
        assertEq(MockUSDC(d.usdc).decimals(), 6);
        assertEq(ReputationRegistry(d.reputation).factory(), d.factory);
        assertEq(ReputationRegistry(d.reputation).admin(), deployer);

        HuiFactory f = HuiFactory(d.factory);
        assertEq(f.implementation(), d.implementation);
        assertEq(f.admin(), deployer);
        FactoryConfig memory c = f.config();
        assertEq(c.forwarder, d.forwarder);
        assertEq(c.reputation, d.reputation);
        assertEq(c.usdc, d.usdc);
        assertEq(c.maxCapBps, 2000);
        assertEq(c.lateRateBps, 1000);
        assertEq(c.minCoverageBps, 5000);
        assertEq(c.maxFeeBps, 300);
        assertEq(c.maxReserveBps, 300);
        assertEq(c.minMembers, 3);
        assertEq(c.maxMembers, 30);
        assertEq(c.maxContribution, 10_000e6);

        HuiCircle impl = HuiCircle(payable(d.implementation));
        assertEq(impl.trustedForwarder(), d.forwarder);
        assertEq(impl.lens(), d.lens);
        _cleanup();
    }

    function test_Execute_WritesJson() public {
        vm.chainId(31337);
        vm.warp(1_700_000_000); // 2023-11-14T22:13:20Z
        Deploy.Deployment memory d = script.execute(_params("json"));

        string memory json = vm.readFile(out);
        assertEq(vm.parseJsonUint(json, ".chainId"), 31337);
        assertEq(vm.parseJsonAddress(json, ".factory"), d.factory);
        assertEq(vm.parseJsonAddress(json, ".circleImplementation"), d.implementation);
        assertEq(vm.parseJsonAddress(json, ".circleLens"), d.lens);
        assertEq(vm.parseJsonAddress(json, ".forwarder"), d.forwarder);
        assertEq(vm.parseJsonAddress(json, ".reputation"), d.reputation);
        assertEq(vm.parseJsonAddress(json, ".usdc"), d.usdc);
        assertEq(vm.parseJsonAddress(json, ".admin"), d.admin);
        assertEq(vm.parseJsonAddress(json, ".attester"), d.attester);
        assertEq(vm.parseJsonString(json, ".deployedAt"), "2023-11-14T22:13:20Z");
        assertEq(vm.parseJsonString(json, ".gitCommit"), "abcdef1");
        _cleanup();
    }

    function test_Execute_Fuji_RequiresAttester() public {
        vm.chainId(43_113);
        Deploy.Params memory p = _params("fujiNoAttester");
        vm.expectRevert(abi.encodeWithSelector(Deploy.MissingEnv.selector, "ATTESTER_ADDRESS"));
        script.execute(p);
    }

    function test_Execute_Fuji_UsesCircleUsdc() public {
        vm.chainId(43_113);
        Deploy.Params memory p = _params("fuji");
        p.attester = makeAddr("attester");
        Deploy.Deployment memory d = script.execute(p);
        assertEq(d.usdc, FUJI_USDC);
        assertEq(HuiFactory(d.factory).config().usdc, FUJI_USDC);
        assertEq(HuiFactory(d.factory).config().attester, p.attester);
        assertEq(ReputationRegistry(d.reputation).factory(), d.factory);
        _cleanup();
    }

    /// @dev 09/11 decision (ADR-22): Fuji deploys with a 100% coverage floor by default; anvil keeps docs/03 2.3 (5000).
    function test_Execute_Fuji_DefaultMinCoverageIs10000() public {
        Deploy.Params memory p = _fujiParams("fujiMinCoverage");
        Deploy.Deployment memory d = script.execute(p);
        assertEq(HuiFactory(d.factory).config().minCoverageBps, 10_000);
        _cleanup();
    }

    function test_Execute_AdminDifferentFromDeployer_SkipsWiring() public {
        vm.chainId(31337);
        address safe = makeAddr("safe");
        Deploy.Params memory p = _params("safe");
        p.admin = safe;
        Deploy.Deployment memory d = script.execute(p);
        assertFalse(d.wired);
        assertEq(ReputationRegistry(d.reputation).factory(), address(0));
        assertEq(HuiFactory(d.factory).admin(), safe);
        // The admin finishes the wiring, exactly once.
        vm.prank(safe);
        ReputationRegistry(d.reputation).setFactory(d.factory);
        assertEq(ReputationRegistry(d.reputation).factory(), d.factory);
        _cleanup();
    }

    function test_Execute_Fuji_DoesNotWriteJsonByDefault() public {
        Deploy.Params memory p = _fujiParams("fujiNoWrite");
        vm.writeFile(out, "sentinel");
        script.execute(p);
        assertEq(vm.readFile(out), "sentinel");
        _cleanup();
    }

    function test_Execute_Fuji_WritesJsonWhenEnabled() public {
        Deploy.Params memory p = _fujiParams("fujiWrite");
        p.writeDeployment = true;
        Deploy.Deployment memory d = script.execute(p);
        string memory json = vm.readFile(out);
        assertEq(vm.parseJsonUint(json, ".chainId"), 43_113);
        assertEq(vm.parseJsonAddress(json, ".factory"), d.factory);
        assertFalse(vm.keyExistsJson(json, ".wired"));
        _cleanup();
    }

    function test_Execute_Fuji_RevertsIfAttesterIsDeployer() public {
        Deploy.Params memory p = _fujiParams("fujiAttDeployer");
        p.attester = deployer;
        vm.expectRevert(abi.encodeWithSelector(Deploy.AttesterNotSeparate.selector, deployer));
        script.execute(p);
    }

    function test_Execute_Fuji_RevertsIfAttesterIsAdmin() public {
        Deploy.Params memory p = _fujiParams("fujiAttAdmin");
        address safe = makeAddr("safe");
        p.admin = safe;
        p.attester = safe;
        p.allowUnwired = true;
        vm.expectRevert(abi.encodeWithSelector(Deploy.AttesterNotSeparate.selector, safe));
        script.execute(p);
    }

    function test_Execute_Fuji_RevertsIfAdminNotDeployer() public {
        Deploy.Params memory p = _fujiParams("fujiAdmin");
        address safe = makeAddr("safe");
        p.admin = safe;
        vm.expectRevert(abi.encodeWithSelector(Deploy.AdminNotDeployer.selector, safe, deployer));
        script.execute(p);
    }

    function test_Execute_Fuji_AllowUnwired_WritesWiredFalse() public {
        Deploy.Params memory p = _fujiParams("fujiUnwired");
        address safe = makeAddr("safe");
        p.admin = safe;
        p.allowUnwired = true;
        p.writeDeployment = true;
        Deploy.Deployment memory d = script.execute(p);
        assertFalse(d.wired);
        assertEq(ReputationRegistry(d.reputation).admin(), safe);
        assertFalse(vm.parseJsonBool(vm.readFile(out), ".wired"));
        _cleanup();
    }

    function test_Execute_Fuji_RevertsIfUsdcHasNoCode() public {
        Deploy.Params memory p = _fujiParams("fujiNoUsdc");
        vm.etch(FUJI_USDC, "");
        vm.expectRevert(abi.encodeWithSelector(Deploy.SanityCheckFailed.selector, "usdc.code"));
        script.execute(p);
    }

    function test_Execute_RevertsOnMainnet() public {
        vm.chainId(NOT_FUJI_CHAIN);
        Deploy.Params memory p = _params("mainnet");
        vm.expectRevert(abi.encodeWithSelector(Deploy.UnsupportedChain.selector, NOT_FUJI_CHAIN));
        script.execute(p);
    }

    function test_Execute_RevertsOnUnknownChain() public {
        vm.chainId(1);
        Deploy.Params memory p = _params("unknown");
        vm.expectRevert(abi.encodeWithSelector(Deploy.UnsupportedChain.selector, 1));
        script.execute(p);
    }

    /// @dev The only test that touches process-wide env vars.
    function test_Run_ReadsEnvironment() public {
        out = "deployments/DeployScript.env.test.json";
        address attester = makeAddr("envAttester");
        address relayer = makeAddr("envRelayer");
        vm.setEnv("DEPLOYER_PRIVATE_KEY", vm.toString(DEPLOYER_KEY));
        vm.setEnv("ATTESTER_ADDRESS", vm.toString(attester));
        vm.setEnv("RELAYER_ADDRESS", vm.toString(relayer));
        vm.setEnv("GIT_COMMIT", "feed123");
        vm.setEnv("DEPLOY_OUT", out);
        // Neutralise anything exported in the caller's shell so the test does not depend on it.
        vm.setEnv("ADMIN", "");
        vm.setEnv("USDC", "");
        vm.setEnv("WRITE_DEPLOYMENT", "");
        vm.setEnv("ALLOW_UNWIRED", "");
        vm.setEnv("MIN_COVERAGE_BPS", "");
        vm.chainId(31337);

        Deploy.Deployment memory d = script.run();
        assertEq(d.attester, attester);
        assertEq(d.admin, deployer);
        assertTrue(d.wired);
        string memory json = vm.readFile(out);
        assertEq(vm.parseJsonAddress(json, ".relayer"), relayer);
        assertEq(vm.parseJsonString(json, ".gitCommit"), "feed123");
        _cleanup();
    }
}
