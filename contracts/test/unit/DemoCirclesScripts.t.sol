// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Deploy} from "../../script/Deploy.s.sol";
import {CreateDemoCircles} from "../../script/CreateDemoCircles.s.sol";
import {JoinDemoCircles} from "../../script/JoinDemoCircles.s.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {HuiCircle} from "../../src/HuiCircle.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {CircleMode, CircleParams, CircleState, RoundInfo} from "../../src/libraries/HuiTypes.sol";

/// @notice Runs `CreateDemoCircles` and `JoinDemoCircles` inside the test VM against a system made by `Deploy`.
contract DemoCirclesScriptsTest is Test {
    uint256 internal constant DEPLOYER_KEY = 0xA11CE; // throwaway test keys, hold nothing anywhere
    uint256 internal constant ORGANIZER_KEY = 0xB0B;
    uint256 internal constant ATTESTER_KEY = 0xA77E57;
    uint256 internal constant RELAYER_KEY = 0x2E1A7E2;
    string internal file;

    Deploy.Deployment internal d;
    CreateDemoCircles internal create;
    JoinDemoCircles internal join;
    uint256[5] internal memberKeys;

    function _deploy(string memory name) internal {
        vm.chainId(31337);
        file = string.concat("deployments/DemoCirclesScripts.", name, ".test.json");
        Deploy.Params memory p;
        p.deployerKey = DEPLOYER_KEY;
        p.attester = vm.addr(ATTESTER_KEY);
        p.gitCommit = "abcdef1";
        p.outPath = file;
        d = new Deploy().execute(p);
        create = new CreateDemoCircles();
        join = new JoinDemoCircles();
        for (uint256 i; i < 5; ++i) {
            memberKeys[i] = 0xC0DE00 + i;
            MockUSDC(d.usdc).mint(vm.addr(memberKeys[i]), 122e6);
        }
    }

    function _cleanup() internal {
        if (vm.exists(file)) vm.removeFile(file);
    }

    function _joinParams(JoinDemoCircles.Selection s, bool activate)
        internal
        view
        returns (JoinDemoCircles.Params memory p)
    {
        p.file = file;
        p.organizerKey = ORGANIZER_KEY;
        p.memberKeys = memberKeys;
        p.attesterKey = ATTESTER_KEY;
        p.relayerKey = RELAYER_KEY;
        p.selection = s;
        p.activate = activate;
    }

    function test_TermsHashesAreTheStandardSdkTexts() public {
        string memory v = vm.readFile("test/vectors/terms.json");
        create = new CreateDemoCircles();
        assertEq(create.TERMS_HASH_BIDDING(), vm.parseJsonBytes32(v, ".demo.hash"));
        assertEq(create.TERMS_HASH_PHI(), vm.parseJsonBytes32(v, ".demoPhi.hash"));
        assertEq(create.TERMS_HASH_FIXED(), vm.parseJsonBytes32(v, ".demoFixed.hash"));
        assertEq(keccak256(bytes(vm.parseJsonString(v, ".demoPhi.text"))), create.TERMS_HASH_PHI());
        assertEq(keccak256(bytes(vm.parseJsonString(v, ".demoFixed.text"))), create.TERMS_HASH_FIXED());
    }

    function test_Create_ThreeCirclesAtFullCoverage() public {
        _deploy("create");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days);

        IHuiCircle bidding = IHuiCircle(r.bidding);
        IHuiCircle phi = IHuiCircle(r.phi);
        IHuiCircle fixedC = IHuiCircle(r.fixedCircle);
        assertEq(HuiFactory(d.factory).circlesOf(vm.addr(ORGANIZER_KEY)).length, 3);

        CircleParams memory b = bidding.params();
        assertEq(uint8(b.mode), uint8(CircleMode.Bidding));
        assertEq(b.memberCount, 5);
        assertEq(b.commissionShareBps, 0);
        assertEq(b.feeBps, 100);
        assertEq(b.termsHash, create.TERMS_HASH_BIDDING());

        CircleParams memory f = phi.params();
        assertEq(f.commissionShareBps, 5000);
        assertEq(f.feeBps, 300);
        assertEq(f.termsHash, create.TERMS_HASH_PHI());

        CircleParams memory x = fixedC.params();
        assertEq(uint8(x.mode), uint8(CircleMode.Fixed));
        assertEq(x.memberCount, 3);
        assertEq(x.commitWindow, 0);
        assertEq(x.revealWindow, 0);
        assertEq(x.termsHash, create.TERMS_HASH_FIXED());

        assertEq(HuiCircle(payable(r.bidding)).bondRemaining(), 48e6);
        assertEq(HuiCircle(payable(r.phi)).bondRemaining(), 48e6);
        assertEq(HuiCircle(payable(r.fixedCircle)).bondRemaining(), 16e6);
        assertEq(bidding.coverageIndexBps(), 10_000);
        assertEq(phi.coverageIndexBps(), 10_000);
        assertEq(fixedC.coverageIndexBps(), 10_000);
        assertEq(bidding.requiredAllowance(), 4 * 10.1e6);
        assertEq(fixedC.requiredAllowance(), 2 * 10e6);
        _cleanup();
    }

    function test_Create_Fuji_RevertsWhenOrganizerLacksUsdc() public {
        _deploy("fuji");
        vm.chainId(43_113);
        vm.expectRevert(abi.encodeWithSelector(CreateDemoCircles.InsufficientUsdc.selector, 0, 112e6));
        create.execute(ORGANIZER_KEY, file, 7 days);
        _cleanup();
    }

    function test_Create_RevertsOnUnsupportedChain() public {
        _deploy("chain");
        vm.chainId(43_114);
        vm.expectRevert(abi.encodeWithSelector(CreateDemoCircles.UnsupportedChain.selector, 43_114));
        create.execute(ORGANIZER_KEY, file, 7 days);
        _cleanup();
    }

    function test_Join_FillsAndActivatesAllThreeWithoutMemberGas() public {
        _deploy("join");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days);
        for (uint256 i; i < 5; ++i) {
            assertEq(vm.addr(memberKeys[i]).balance, 0, "members hold no AVAX");
        }
        JoinDemoCircles.Result memory j = join.execute(_joinParams(JoinDemoCircles.Selection.All, true));

        assertEq(j.bidding, r.bidding);
        assertEq(j.phi, r.phi);
        assertEq(j.fixedCircle, r.fixedCircle);
        assertEq(j.biddingMembers, 5);
        assertEq(j.phiMembers, 5);
        assertEq(j.fixedMembers, 3);
        assertEq(uint8(HuiCircle(payable(r.bidding)).state()), uint8(CircleState.Active));
        assertEq(uint8(HuiCircle(payable(r.phi)).state()), uint8(CircleState.Active));
        assertEq(uint8(HuiCircle(payable(r.fixedCircle)).state()), uint8(CircleState.Active));
        address[] memory m = IHuiCircle(r.fixedCircle).members();
        assertEq(m[0], vm.addr(memberKeys[0]));
        assertEq(m[2], vm.addr(memberKeys[2]));
        for (uint256 i; i < 5; ++i) {
            assertEq(vm.addr(memberKeys[i]).balance, 0, "still no AVAX: the relayer paid");
        }
        _cleanup();
    }

    function test_Join_FixedOnlyLeavesTheBiddingCirclesForming() public {
        _deploy("fixed");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days);
        join.execute(_joinParams(JoinDemoCircles.Selection.FixedOnly, true));
        assertEq(uint8(HuiCircle(payable(r.fixedCircle)).state()), uint8(CircleState.Active));
        assertEq(uint8(HuiCircle(payable(r.bidding)).state()), uint8(CircleState.Forming));
        assertEq(IHuiCircle(r.bidding).members().length, 0);
        assertEq(uint8(HuiCircle(payable(r.phi)).state()), uint8(CircleState.Forming));
        _cleanup();
    }

    function test_Join_WithoutActivationAndRerunIsIdempotent() public {
        _deploy("rerun");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days);
        join.execute(_joinParams(JoinDemoCircles.Selection.All, false));
        assertEq(uint8(HuiCircle(payable(r.bidding)).state()), uint8(CircleState.Forming));
        assertEq(IHuiCircle(r.bidding).members().length, 5);
        // Second run: members already in are skipped, then everything activates.
        join.execute(_joinParams(JoinDemoCircles.Selection.All, true));
        assertEq(uint8(HuiCircle(payable(r.bidding)).state()), uint8(CircleState.Active));
        assertEq(IHuiCircle(r.bidding).members().length, 5);
        _cleanup();
    }

    function test_Join_RevertsWhenCirclesWereNotCreated() public {
        _deploy("missing");
        vm.expectRevert(
            abi.encodeWithSelector(JoinDemoCircles.DemoCircleNotFound.selector, create.TERMS_HASH_BIDDING())
        );
        join.execute(_joinParams(JoinDemoCircles.Selection.All, true));
        _cleanup();
    }

    function test_Join_RevertsOnUnsupportedChain() public {
        _deploy("chain2");
        vm.chainId(43_114);
        vm.expectRevert(abi.encodeWithSelector(JoinDemoCircles.UnsupportedChain.selector, 43_114));
        join.execute(_joinParams(JoinDemoCircles.Selection.All, true));
        _cleanup();
    }

    function test_ParseSelection() public {
        join = new JoinDemoCircles();
        assertEq(uint8(join.parseSelection("all")), uint8(JoinDemoCircles.Selection.All));
        assertEq(uint8(join.parseSelection("fixed")), uint8(JoinDemoCircles.Selection.FixedOnly));
        vm.expectRevert(abi.encodeWithSelector(JoinDemoCircles.InvalidSelection.selector, "bidding"));
        join.parseSelection("bidding");
    }

    /// @dev The Fixed demo circle runs to the end on its own: three rounds, then `finalize`, bond back to the organizer.
    function test_FixedDemoCircleRunsToCompletion() public {
        _deploy("complete");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days);
        join.execute(_joinParams(JoinDemoCircles.Selection.FixedOnly, true));
        HuiCircle c = HuiCircle(payable(r.fixedCircle));
        MockUSDC usdc = MockUSDC(d.usdc);
        address m1 = vm.addr(memberKeys[0]);
        uint256 before1 = usdc.balanceOf(m1);

        for (uint32 k = 1; k <= 3; ++k) {
            vm.warp(IHuiCircle(address(c)).deadline(k));
            c.settleRound();
            RoundInfo memory ri = IHuiCircle(address(c)).roundInfo(k);
            assertEq(ri.winner, vm.addr(memberKeys[k - 1]), "fixed order is the join order");
            assertEq(ri.uncovered, 0);
        }
        vm.warp(block.timestamp + 121);
        c.finalize();
        assertEq(uint8(c.state()), uint8(CircleState.Completed));
        assertEq(usdc.balanceOf(address(c)), 0, "the ledger is empty after finalize");
        assertGt(usdc.balanceOf(m1), before1 - 20e6, "M1 got the first pot");
        _cleanup();
    }
}
