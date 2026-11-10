// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CreateSafe, ISafeSetup} from "../../script/CreateSafe.s.sol";

/// @dev Fork test against the public Fuji RPC (read-only fork, nothing is sent). Runs only when
///      HUISAFE_FORK_TESTS=true so the default offline `forge test` is unaffected.
contract CreateSafeScriptTest is Test {
    string internal constant FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
    uint256 internal payerKey;
    address internal payer;
    CreateSafe internal script;

    function _enabled() internal view returns (bool) {
        return vm.envOr("HUISAFE_FORK_TESTS", false);
    }

    function setUp() public {
        if (!_enabled()) return;
        vm.createSelectFork(FUJI_RPC);
        (payer, payerKey) = makeAddrAndKey("payer");
        vm.deal(payer, 1 ether);
        script = new CreateSafe();
    }

    function test_CreatesTwoOfThreeSafe() public {
        if (!_enabled()) return;
        address[3] memory o = [makeAddr("towfienes"), makeAddr("minh"), makeAddr("backup")];
        address safe = script.create(payerKey, o, 1);
        assertGt(safe.code.length, 0);
        assertEq(ISafeSetup(safe).getThreshold(), 2);
        address[] memory owners = ISafeSetup(safe).getOwners();
        assertEq(owners.length, 3);
        for (uint256 i; i < 3; ++i) {
            assertEq(owners[i], o[i]);
        }
    }

    function test_RejectsDuplicateOwner() public {
        if (!_enabled()) return;
        address a = makeAddr("towfienes");
        vm.expectRevert(abi.encodeWithSelector(CreateSafe.BadOwner.selector, a));
        script.create(payerKey, [a, makeAddr("minh"), a], 2);
    }

    function test_RejectsPayerAsOwner() public {
        if (!_enabled()) return;
        vm.expectRevert(abi.encodeWithSelector(CreateSafe.BadOwner.selector, payer));
        script.create(payerKey, [makeAddr("towfienes"), makeAddr("minh"), payer], 3);
    }

    function test_RejectsZeroOwner() public {
        if (!_enabled()) return;
        vm.expectRevert(abi.encodeWithSelector(CreateSafe.BadOwner.selector, address(0)));
        script.create(payerKey, [makeAddr("towfienes"), address(0), makeAddr("backup")], 4);
    }
}
