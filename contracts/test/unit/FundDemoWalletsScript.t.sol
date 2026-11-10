// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";

import {FundDemoWallets} from "../../script/FundDemoWallets.s.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @notice Runs `script/FundDemoWallets.s.sol` inside the test VM with throwaway keys and `MockUSDC`.
contract FundDemoWalletsScriptTest is Test {
    uint256 internal constant DEPLOYER_KEY = 0xA11CE; // throwaway test key, holds nothing anywhere
    address internal constant FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    FundDemoWallets internal script;
    MockUSDC internal usdc;
    address internal deployer;
    address internal relayer = makeAddr("relayer");
    address internal keeper = makeAddr("keeper");
    address internal organizer = makeAddr("organizer");
    address[5] internal members;

    function setUp() public {
        vm.chainId(31337);
        script = new FundDemoWallets();
        usdc = new MockUSDC();
        deployer = vm.addr(DEPLOYER_KEY);
        for (uint256 i; i < 5; ++i) {
            members[i] = makeAddr(string.concat("m", vm.toString(i + 1)));
        }
    }

    function _params(FundDemoWallets.Target t) internal view returns (FundDemoWallets.Params memory p) {
        p.deployerKey = DEPLOYER_KEY;
        p.usdc = address(usdc);
        p.relayer = relayer;
        p.keeper = keeper;
        p.organizer = organizer;
        p.members = members;
        p.target = t;
    }

    function _fundDeployer(uint256 avax, uint256 usdcAmount) internal {
        vm.deal(deployer, avax);
        if (usdcAmount != 0) usdc.mint(deployer, usdcAmount);
    }

    function test_Single_FundsEveryWalletToItsTarget() public {
        _fundDeployer(1 ether, 1000e6);
        FundDemoWallets.Result memory r = script.execute(_params(FundDemoWallets.Target.Single));

        assertEq(relayer.balance, 0.02 ether);
        assertEq(keeper.balance, 0.005 ether);
        assertEq(organizer.balance, 0.005 ether);
        assertEq(usdc.balanceOf(organizer), 48e6);
        for (uint256 i; i < 5; ++i) {
            assertEq(usdc.balanceOf(members[i]), 41e6);
            assertEq(members[i].balance, 0, "members never need AVAX, the relayer pays gas");
        }
        assertEq(r.usdcSent, 48e6 + 5 * 41e6);
        assertEq(r.avaxSent, 0.03 ether);
        assertEq(r.transfers, 3 + 6);
        assertEq(usdc.balanceOf(deployer), 1000e6 - r.usdcSent);
    }

    function test_DemoDay_UsesTheLargerTargets() public {
        _fundDeployer(1 ether, 1000e6);
        script.execute(_params(FundDemoWallets.Target.DemoDay));
        assertEq(usdc.balanceOf(organizer), 144e6);
        for (uint256 i; i < 5; ++i) {
            assertEq(usdc.balanceOf(members[i]), 122e6);
        }
    }

    /// @dev Only the missing part moves: a wallet at or above target gets nothing; one below gets the difference.
    function test_SendsOnlyWhatIsMissing() public {
        _fundDeployer(1 ether, 1000e6);
        vm.deal(relayer, 0.05 ether); // already above its 0.02 target
        vm.deal(keeper, 0.003 ether); // short by 0.002
        usdc.mint(organizer, 48e6); // exactly at target
        usdc.mint(members[0], 100e6); // above target
        usdc.mint(members[1], 30e6); // short by 11

        vm.recordLogs();
        FundDemoWallets.Result memory r = script.execute(_params(FundDemoWallets.Target.Single));
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(relayer.balance, 0.05 ether, "above target: untouched");
        assertEq(keeper.balance, 0.005 ether);
        assertEq(usdc.balanceOf(organizer), 48e6);
        assertEq(usdc.balanceOf(members[0]), 100e6, "above target: untouched");
        assertEq(usdc.balanceOf(members[1]), 41e6);
        assertEq(usdc.balanceOf(members[2]), 41e6);

        uint256 transfers;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(usdc) && logs[i].topics[0] == keccak256("Transfer(address,address,uint256)"))
            {
                ++transfers;
            }
        }
        assertEq(transfers, 4, "m2 gap (11) plus m3..m5 in full");
        assertEq(r.usdcSent, 11e6 + 3 * 41e6);
        assertEq(r.avaxSent, 0.002 ether + 0.005 ether); // keeper gap + organizer
    }

    function test_SecondRunSendsNothing() public {
        _fundDeployer(1 ether, 1000e6);
        script.execute(_params(FundDemoWallets.Target.Single));
        uint256 usdcBefore = usdc.balanceOf(deployer);
        uint256 avaxBefore = deployer.balance;
        FundDemoWallets.Result memory r = script.execute(_params(FundDemoWallets.Target.Single));
        assertEq(r.transfers, 0);
        assertEq(r.usdcSent, 0);
        assertEq(r.avaxSent, 0);
        assertEq(usdc.balanceOf(deployer), usdcBefore);
        assertEq(deployer.balance, avaxBefore);
    }

    function test_Anvil_MintsTheDeployerShortfallOnly() public {
        _fundDeployer(1 ether, 0);
        script.execute(_params(FundDemoWallets.Target.Single));
        assertEq(usdc.balanceOf(deployer), 0, "minted exactly what it sent");
        assertEq(usdc.balanceOf(members[4]), 41e6);
    }

    function test_Fuji_RevertsWhenDeployerLacksUsdc_AndSendsNothing() public {
        vm.chainId(43_113);
        vm.etch(FUJI_USDC, address(new MockUSDC()).code);
        usdc = MockUSDC(FUJI_USDC);
        _fundDeployer(1 ether, 100e6);
        uint256 need = 48e6 + 5 * 41e6;
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.InsufficientUsdc.selector, 100e6, need));
        script.execute(_params(FundDemoWallets.Target.Single));
        assertEq(usdc.balanceOf(organizer), 0, "nothing sent before the check");
        assertEq(relayer.balance, 0);
    }

    function test_RevertsWhenDeployerLacksAvax() public {
        _fundDeployer(0.01 ether, 1000e6);
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.InsufficientAvax.selector, 0.01 ether, 0.03 ether));
        script.execute(_params(FundDemoWallets.Target.Single));
    }

    function test_Fuji_RejectsAnyTokenButCirclesUsdc() public {
        vm.chainId(43_113);
        _fundDeployer(1 ether, 1000e6);
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.BadToken.selector, address(usdc)));
        script.execute(_params(FundDemoWallets.Target.Single));
    }

    function test_RevertsOnUnsupportedChain() public {
        vm.chainId(43_114);
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.UnsupportedChain.selector, 43_114));
        script.execute(_params(FundDemoWallets.Target.Single));
    }

    function test_RevertsOnZeroDuplicateOrDeployerWallet() public {
        _fundDeployer(1 ether, 1000e6);
        FundDemoWallets.Params memory p = _params(FundDemoWallets.Target.Single);

        p.keeper = address(0);
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.BadWallet.selector, "keeper", address(0)));
        script.execute(p);

        p = _params(FundDemoWallets.Target.Single);
        p.members[2] = p.members[0];
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.BadWallet.selector, "m3", p.members[0]));
        script.execute(p);

        p = _params(FundDemoWallets.Target.Single);
        p.organizer = deployer;
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.BadWallet.selector, "organizer", deployer));
        script.execute(p);
    }

    function test_RevertsWhenTokenHasNoCode() public {
        _fundDeployer(1 ether, 0);
        FundDemoWallets.Params memory p = _params(FundDemoWallets.Target.Single);
        p.usdc = makeAddr("nothing");
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.BadToken.selector, p.usdc));
        script.execute(p);
    }

    function test_ParseTarget() public {
        assertEq(uint8(script.parseTarget("single")), uint8(FundDemoWallets.Target.Single));
        assertEq(uint8(script.parseTarget("demoday")), uint8(FundDemoWallets.Target.DemoDay));
        vm.expectRevert(abi.encodeWithSelector(FundDemoWallets.InvalidTarget.selector, "triple"));
        script.parseTarget("triple");
    }
}
