// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Deploy} from "../../script/Deploy.s.sol";
import {CreateDemoCircles} from "../../script/CreateDemoCircles.s.sol";
import {JoinDemoCircles} from "../../script/JoinDemoCircles.s.sol";
import {ActivateDemoCircle} from "../../script/ActivateDemoCircle.s.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {HuiCircle} from "../../src/HuiCircle.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {CircleMode, CircleParams, CircleState, RoundInfo} from "../../src/libraries/HuiTypes.sol";

/// @notice Runs `CreateDemoCircles`, `JoinDemoCircles` and `ActivateDemoCircle` inside the test VM against a system made by `Deploy`.
contract DemoCirclesScriptsTest is Test {
    uint256 internal constant DEPLOYER_KEY = 0xA11CE; // throwaway test keys, hold nothing anywhere
    uint256 internal constant ORGANIZER_KEY = 0xB0B;
    uint256 internal constant ATTESTER_KEY = 0xA77E57;
    uint256 internal constant RELAYER_KEY = 0x2E1A7E2;
    string internal file;

    Deploy.Deployment internal d;
    CreateDemoCircles internal create;
    JoinDemoCircles internal join;
    ActivateDemoCircle internal activator;
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
        activator = new ActivateDemoCircle();
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
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);

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

    function test_Create_RerunRevertsWhileDemoCirclesAreLive_UnlessForced() public {
        _deploy("rerun2");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
        vm.expectRevert(abi.encodeWithSelector(CreateDemoCircles.AlreadyCreated.selector, r.bidding));
        create.execute(ORGANIZER_KEY, file, 7 days, false);
        create.execute(ORGANIZER_KEY, file, 7 days, true);
        assertEq(HuiFactory(d.factory).circlesOf(vm.addr(ORGANIZER_KEY)).length, 6);
        _cleanup();
    }

    function test_Create_Fuji_RevertsWhenOrganizerLacksUsdc() public {
        _deploy("fuji");
        vm.chainId(43_113);
        vm.expectRevert(abi.encodeWithSelector(CreateDemoCircles.InsufficientUsdc.selector, 0, 112e6));
        create.execute(ORGANIZER_KEY, file, 7 days, false);
        _cleanup();
    }

    function test_Create_RevertsOnUnsupportedChain() public {
        _deploy("chain");
        vm.chainId(43_114);
        vm.expectRevert(abi.encodeWithSelector(CreateDemoCircles.UnsupportedChain.selector, 43_114));
        create.execute(ORGANIZER_KEY, file, 7 days, false);
        _cleanup();
    }

    function test_Join_FillsAndActivatesAllThreeWithoutMemberGas() public {
        _deploy("join");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
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
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
        join.execute(_joinParams(JoinDemoCircles.Selection.FixedOnly, true));
        assertEq(uint8(HuiCircle(payable(r.fixedCircle)).state()), uint8(CircleState.Active));
        assertEq(uint8(HuiCircle(payable(r.bidding)).state()), uint8(CircleState.Forming));
        assertEq(IHuiCircle(r.bidding).members().length, 0);
        assertEq(uint8(HuiCircle(payable(r.phi)).state()), uint8(CircleState.Forming));
        _cleanup();
    }

    function test_Join_WithoutActivationAndRerunIsIdempotent() public {
        _deploy("rerun");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
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

    function test_Join_RevertsWhenTwoRolesShareAKey() public {
        _deploy("dupkey");
        create.execute(ORGANIZER_KEY, file, 7 days, false);
        JoinDemoCircles.Params memory p = _joinParams(JoinDemoCircles.Selection.All, true);
        p.relayerKey = ORGANIZER_KEY;
        vm.expectRevert(abi.encodeWithSelector(JoinDemoCircles.DuplicateKey.selector, vm.addr(ORGANIZER_KEY)));
        join.execute(p);
        _cleanup();
    }

    // ---------------------------------------------------------------- DEMO_MEMBERS: leave seats free (A20)

    function _withMembers(JoinDemoCircles.Params memory p, uint8 members)
        internal
        pure
        returns (JoinDemoCircles.Params memory)
    {
        p.members = members;
        return p;
    }

    function test_Join_FourMembersLeavesTheLastSeatOfTheBiddingCircles() public {
        _deploy("members4");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
        JoinDemoCircles.Result memory j =
            join.execute(_withMembers(_joinParams(JoinDemoCircles.Selection.All, true), 4));

        assertEq(j.biddingMembers, 4);
        assertEq(j.phiMembers, 4);
        assertEq(j.fixedMembers, 3, "the Fixed circle takes at most its 3 seats");
        // The two bidding circles keep a free seat and stay Forming; the full Fixed circle is activated.
        assertEq(uint8(HuiCircle(payable(r.bidding)).state()), uint8(CircleState.Forming));
        assertEq(uint8(HuiCircle(payable(r.phi)).state()), uint8(CircleState.Forming));
        assertEq(uint8(HuiCircle(payable(r.fixedCircle)).state()), uint8(CircleState.Active));
        assertFalse(IHuiCircle(r.bidding).memberInfo(vm.addr(memberKeys[4])).joined, "M5 is not in");
        _cleanup();
    }

    function test_Join_MembersAboveFiveReverts() public {
        _deploy("members6");
        create.execute(ORGANIZER_KEY, file, 7 days, false);
        vm.expectRevert(abi.encodeWithSelector(JoinDemoCircles.InvalidMembers.selector, 6));
        join.execute(_withMembers(_joinParams(JoinDemoCircles.Selection.All, true), 6));
        _cleanup();
    }

    /// @dev A stranger (a person using Privy on the live night) takes a seat; re-running the script neither reverts
    /// (it used to demand members.length == the chosen count) nor activates the circle that is still not full.
    function test_Join_RerunAfterAStrangerJoinedKeepsEveryoneAndDoesNotRevert() public {
        _deploy("stranger");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
        join.execute(_withMembers(_joinParams(JoinDemoCircles.Selection.All, false), 2)); // M1, M2

        // the stranger: the same script joins a different key, as `joinParams.memberKeys[0]`
        uint256 strangerKey = 0xC0DE99;
        MockUSDC(d.usdc).mint(vm.addr(strangerKey), 122e6);
        JoinDemoCircles.Params memory sp = _withMembers(_joinParams(JoinDemoCircles.Selection.All, false), 1);
        sp.memberKeys[0] = strangerKey;
        join.execute(sp);
        assertEq(IHuiCircle(r.bidding).members().length, 3, "M1, M2 and the stranger");

        // re-run for M1, M2: both are already in (skipped); the circle holds 3 members, not 2, and that is accepted
        JoinDemoCircles.Result memory j =
            join.execute(_withMembers(_joinParams(JoinDemoCircles.Selection.All, true), 2));
        assertEq(j.biddingMembers, 3, "the stranger counts");
        assertEq(IHuiCircle(r.bidding).members().length, 3);
        assertTrue(IHuiCircle(r.bidding).memberInfo(vm.addr(strangerKey)).joined, "the stranger is still in");
        assertEq(uint8(HuiCircle(payable(r.bidding)).state()), uint8(CircleState.Forming), "not full: not activated");
        // the Fixed circle is full (M1, M2, stranger) and the run activates it
        assertEq(uint8(HuiCircle(payable(r.fixedCircle)).state()), uint8(CircleState.Active));
        _cleanup();
    }

    function test_Join_RerunAfterActivationIsANoOp() public {
        _deploy("rerunactive");
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
        join.execute(_joinParams(JoinDemoCircles.Selection.All, true));
        JoinDemoCircles.Result memory j = join.execute(_joinParams(JoinDemoCircles.Selection.All, true));
        assertEq(j.biddingMembers, 5);
        assertEq(uint8(HuiCircle(payable(r.bidding)).state()), uint8(CircleState.Active));
        _cleanup();
    }

    // ---------------------------------------------------------------- ActivateDemoCircle (A20)

    function _filledBidding(string memory name, uint8 members) internal returns (address circle) {
        _deploy(name);
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
        join.execute(_withMembers(_joinParams(JoinDemoCircles.Selection.All, false), members));
        return r.bidding;
    }

    function test_Activate_StartsAFullCircle() public {
        address circle = _filledBidding("act1", 5);
        assertEq(uint8(HuiCircle(payable(circle)).state()), uint8(CircleState.Forming));
        CircleState after_ = activator.execute(ORGANIZER_KEY, file, circle);
        assertEq(uint8(after_), uint8(CircleState.Active));
        assertEq(uint8(HuiCircle(payable(circle)).state()), uint8(CircleState.Active));
        assertGt(HuiCircle(payable(circle)).startTime(), 0);
        _cleanup();
    }

    function test_Activate_AfterTheLastSeatIsTaken() public {
        address circle = _filledBidding("act2", 4);
        vm.expectRevert(abi.encodeWithSelector(ActivateDemoCircle.NotFull.selector, 4, 5));
        activator.execute(ORGANIZER_KEY, file, circle);
        // the fifth person (here M5, through the same script) arrives; now it starts
        join.execute(_joinParams(JoinDemoCircles.Selection.All, false));
        activator.execute(ORGANIZER_KEY, file, circle);
        assertEq(uint8(HuiCircle(payable(circle)).state()), uint8(CircleState.Active));
        _cleanup();
    }

    function test_Activate_RevertsForAnotherSigner() public {
        address circle = _filledBidding("act3", 5);
        uint256 other = 0xBAD;
        vm.expectRevert(
            abi.encodeWithSelector(ActivateDemoCircle.NotOrganizer.selector, vm.addr(other), vm.addr(ORGANIZER_KEY))
        );
        activator.execute(other, file, circle);
        _cleanup();
    }

    function test_Activate_RevertsForAnAddressThatIsNotACircle() public {
        _filledBidding("act4", 5);
        address notCircle = address(0xDEAD);
        vm.expectRevert(abi.encodeWithSelector(ActivateDemoCircle.NotACircle.selector, notCircle));
        activator.execute(ORGANIZER_KEY, file, notCircle);
        _cleanup();
    }

    function test_Activate_RevertsWhenAlreadyActive() public {
        address circle = _filledBidding("act5", 5);
        activator.execute(ORGANIZER_KEY, file, circle);
        vm.expectRevert(abi.encodeWithSelector(ActivateDemoCircle.NotForming.selector, CircleState.Active));
        activator.execute(ORGANIZER_KEY, file, circle);
        _cleanup();
    }

    function test_Activate_RevertsAfterTheJoinDeadline() public {
        address circle = _filledBidding("act6", 5);
        uint64 deadline = IHuiCircle(circle).params().joinDeadline;
        vm.warp(uint256(deadline) + 1);
        vm.expectRevert(abi.encodeWithSelector(ActivateDemoCircle.JoinDeadlinePassed.selector, deadline));
        activator.execute(ORGANIZER_KEY, file, circle);
        _cleanup();
    }

    function test_Activate_RevertsWhenCoverageIsBelowTheMinimum() public {
        address circle = _filledBidding("act7", 5);
        // Every demo circle is made at 100%, so a lower reading is simulated at the view the script reads.
        vm.mockCall(circle, abi.encodeWithSelector(IHuiCircle.coverageIndexBps.selector), abi.encode(uint256(4_000)));
        uint256 minimum = HuiCircle(payable(circle)).minCoverageBps();
        vm.expectRevert(abi.encodeWithSelector(ActivateDemoCircle.CoverageBelowMinimum.selector, 4_000, minimum));
        activator.execute(ORGANIZER_KEY, file, circle);
        vm.clearMockedCalls();
        assertEq(uint8(HuiCircle(payable(circle)).state()), uint8(CircleState.Forming), "nothing was broadcast");
        _cleanup();
    }

    function test_Activate_RevertsOnUnsupportedChain() public {
        address circle = _filledBidding("act8", 5);
        vm.chainId(43_114);
        vm.expectRevert(abi.encodeWithSelector(ActivateDemoCircle.UnsupportedChain.selector, 43_114));
        activator.execute(ORGANIZER_KEY, file, circle);
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
        CreateDemoCircles.Result memory r = create.execute(ORGANIZER_KEY, file, 7 days, false);
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
