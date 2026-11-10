// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {FundDemoWallets} from "../../script/FundDemoWallets.s.sol";

/// @dev Fork test against the public Fuji RPC (read-only fork, nothing is sent) with Circle's real USDC. Runs only
///      when HUISAFE_FORK_TESTS=true so the default offline `forge test` is unaffected.
contract FundDemoWalletsForkTest is Test {
    string internal constant FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
    address internal constant USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    uint256 internal deployerKey;
    address internal deployer;
    FundDemoWallets internal script;

    function _enabled() internal view returns (bool) {
        return vm.envOr("HUISAFE_FORK_TESTS", false);
    }

    function setUp() public {
        if (!_enabled()) return;
        vm.createSelectFork(FUJI_RPC);
        (deployer, deployerKey) = makeAddrAndKey("deployer");
        script = new FundDemoWallets();
    }

    function _params(FundDemoWallets.Target t) internal returns (FundDemoWallets.Params memory p) {
        p.deployerKey = deployerKey;
        p.usdc = USDC;
        p.relayer = makeAddr("relayer");
        p.keeper = makeAddr("keeper");
        p.organizer = makeAddr("organizer");
        for (uint256 i; i < 5; ++i) {
            p.members[i] = makeAddr(string.concat("m", vm.toString(i + 1)));
        }
        p.target = t;
    }

    function test_FundsWithRealUsdc() public {
        if (!_enabled()) return;
        deal(USDC, deployer, 800e6);
        vm.deal(deployer, 0.05 ether);
        FundDemoWallets.Params memory p = _params(FundDemoWallets.Target.DemoDay);
        FundDemoWallets.Result memory r = script.execute(p);

        assertEq(IERC20(USDC).balanceOf(p.organizer), 144e6);
        for (uint256 i; i < 5; ++i) {
            assertEq(IERC20(USDC).balanceOf(p.members[i]), 122e6);
        }
        assertEq(p.relayer.balance, 0.02 ether);
        assertEq(r.usdcSent, 144e6 + 5 * 122e6);
        assertEq(IERC20(USDC).balanceOf(deployer), 800e6 - r.usdcSent);
    }

    function test_RevertsWhenDeployerHasTooLittleUsdc() public {
        if (!_enabled()) return;
        deal(USDC, deployer, 100e6);
        vm.deal(deployer, 0.05 ether);
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.InsufficientUsdc.selector, 100e6, 144e6 + 5 * 122e6));
        script.execute(_params(FundDemoWallets.Target.DemoDay));
    }
}
