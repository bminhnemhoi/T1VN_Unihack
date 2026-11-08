// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Deploy} from "../../script/Deploy.s.sol";
import {CreateDemoCircle} from "../../script/CreateDemoCircle.s.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {CircleMode, CircleParams, CircleState} from "../../src/libraries/HuiTypes.sol";

/// @notice Runs `script/CreateDemoCircle.s.sol` inside the test VM against a system deployed by `Deploy` (anvil flavour).
contract CreateDemoCircleScriptTest is Test {
    uint256 internal constant DEPLOYER_KEY = 0xA11CE; // throwaway test keys, hold nothing anywhere
    uint256 internal constant ORGANIZER_KEY = 0xB0B;
    string internal file;

    Deploy.Deployment internal d;
    CreateDemoCircle internal script;

    /// @dev One scratch file per test: forge runs tests in parallel.
    function _deploy(string memory name) internal {
        vm.chainId(31337);
        file = string.concat("deployments/CreateDemoCircleScript.", name, ".test.json");
        Deploy.Params memory p;
        p.deployerKey = DEPLOYER_KEY;
        p.gitCommit = "abcdef1";
        p.outPath = file;
        d = new Deploy().execute(p);
        script = new CreateDemoCircle();
    }

    function _cleanup() internal {
        if (vm.exists(file)) vm.removeFile(file);
    }

    function test_Execute_CreatesScaledWorkedExampleCircle() public {
        _deploy("creates");
        CreateDemoCircle.Result memory r = script.execute(ORGANIZER_KEY, file, 7 days, "huisafe-demo");

        assertEq(r.organizer, vm.addr(ORGANIZER_KEY));
        assertEq(r.coverageBps, 10_000);
        assertTrue(HuiFactory(d.factory).isCircle(r.circle));

        IHuiCircle c = IHuiCircle(r.circle);
        CircleParams memory p = c.params();
        assertEq(uint8(p.mode), uint8(CircleMode.Bidding));
        assertEq(p.memberCount, 5);
        assertEq(p.contribution, 10e6);
        assertEq(p.periodSeconds, 30 days);
        assertEq(p.roundDuration, 180);
        assertEq(p.commitWindow, 90);
        assertEq(p.revealWindow, 60);
        assertEq(p.graceSeconds, 120);
        assertEq(p.alphaBps, 2000);
        assertEq(p.feeBps, 100);
        assertEq(p.reserveBps, 100);
        assertEq(p.joinDeadline, block.timestamp + 7 days);
        assertEq(c.maxExposure(), 60e6);
        assertEq(c.requiredAllowance(), 4 * (10e6 + 0.1e6));

        (bool ok, bytes memory data) = r.circle.staticcall(abi.encodeWithSignature("bondRemaining()"));
        assertTrue(ok);
        assertEq(abi.decode(data, (uint256)), 48e6);
        (ok, data) = r.circle.staticcall(abi.encodeWithSignature("state()"));
        assertTrue(ok);
        assertEq(abi.decode(data, (uint8)), uint8(CircleState.Forming));
        _cleanup();
    }

    function test_Execute_RevertsOnUnsupportedChain() public {
        _deploy("chain");
        vm.chainId(43_114);
        vm.expectRevert(abi.encodeWithSelector(CreateDemoCircle.UnsupportedChain.selector, 43_114));
        script.execute(ORGANIZER_KEY, file, 7 days, "x");
        _cleanup();
    }

    function test_Execute_Fuji_RevertsWhenOrganizerLacksUsdc() public {
        _deploy("fuji");
        vm.chainId(43_113);
        vm.expectRevert(abi.encodeWithSelector(CreateDemoCircle.InsufficientUsdc.selector, 0, 48e6));
        script.execute(ORGANIZER_KEY, file, 7 days, "x");
        _cleanup();
    }

    function test_Execute_RevertsWhenNothingDeployed() public {
        file = "deployments/CreateDemoCircleScript.nothing.test.json";
        script = new CreateDemoCircle();
        // factory address in the file has no code on this chain
        vm.writeJson(
            '{"factory":"0x0000000000000000000000000000000000001234","usdc":"0x0000000000000000000000000000000000005678"}',
            file
        );
        vm.expectRevert(abi.encodeWithSelector(CreateDemoCircle.NotDeployed.selector, file));
        script.execute(ORGANIZER_KEY, file, 7 days, "x");
        _cleanup();
    }
}
