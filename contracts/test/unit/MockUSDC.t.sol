// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "../utils/BaseTest.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {PermitSig} from "../../src/libraries/HuiTypes.sol";

contract MockUSDCTest is BaseTest {
    function test_Metadata() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.name(), "USD Coin");
        assertEq(usdc.symbol(), "USDC");
        assertEq(usdc.version(), "2");
    }

    function test_DomainSeparator_UsesVersion2() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("USD Coin"),
                keccak256("2"),
                block.chainid,
                address(usdc)
            )
        );
        assertEq(usdc.DOMAIN_SEPARATOR(), expected);
    }

    function test_Permit_SetsAllowanceAndBumpsNonce() public {
        address owner = actors[0];
        address spender = actors[1];
        PermitSig memory sig = _signPermit(owner, spender, 500 * USDC, block.timestamp + 1 hours);

        usdc.permit(owner, spender, sig.value, sig.deadline, sig.v, sig.r, sig.s);

        assertEq(usdc.allowance(owner, spender), 500 * USDC);
        assertEq(usdc.nonces(owner), 1);
    }

    function test_Permit_RevertsOnReplay() public {
        address owner = actors[0];
        address spender = actors[1];
        PermitSig memory sig = _signPermit(owner, spender, 1 * USDC, block.timestamp + 1 hours);
        usdc.permit(owner, spender, sig.value, sig.deadline, sig.v, sig.r, sig.s);

        vm.expectRevert();
        usdc.permit(owner, spender, sig.value, sig.deadline, sig.v, sig.r, sig.s);
    }

    function test_Permit_RevertsWhenExpired() public {
        address owner = actors[0];
        PermitSig memory sig = _signPermit(owner, actors[1], 1 * USDC, block.timestamp + 1 hours);
        vm.warp(block.timestamp + 2 hours);

        vm.expectRevert(abi.encodeWithSelector(MockUSDC.ERC2612ExpiredSignature.selector, sig.deadline));
        usdc.permit(owner, actors[1], sig.value, sig.deadline, sig.v, sig.r, sig.s);
    }

    function test_Permit_RevertsOnWrongSigner() public {
        // actors[2] signs but claims actors[0] is the owner
        PermitSig memory sig = _signPermit(actors[2], actors[1], 1 * USDC, block.timestamp + 1 hours);
        vm.expectRevert();
        usdc.permit(actors[0], actors[1], sig.value, sig.deadline, sig.v, sig.r, sig.s);
    }

    function test_Blacklist_BlocksTransferFromAndTo() public {
        _fund(actors[0], 100 * USDC);
        _fund(actors[1], 100 * USDC);
        usdc.setBlacklisted(actors[1], true);

        // recipient blacklisted
        vm.prank(actors[0]);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blacklisted.selector, actors[1]));
        usdc.transfer(actors[1], 1 * USDC);

        // sender blacklisted
        vm.prank(actors[1]);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blacklisted.selector, actors[1]));
        usdc.transfer(actors[0], 1 * USDC);

        // lifting the block restores transfers
        usdc.setBlacklisted(actors[1], false);
        vm.prank(actors[0]);
        usdc.transfer(actors[1], 1 * USDC);
        assertEq(usdc.balanceOf(actors[1]), 101 * USDC);
    }

    function test_Blacklist_BlocksTransferFrom() public {
        _fund(actors[0], 100 * USDC);
        vm.prank(actors[0]);
        usdc.approve(address(this), 100 * USDC);
        usdc.setBlacklisted(actors[0], true);

        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blacklisted.selector, actors[0]));
        usdc.transferFrom(actors[0], actors[1], 1 * USDC);
    }

    function test_ReceiveWithAuthorization_Works() public {
        address from = actors[0];
        address to = actors[1];
        _fund(from, 100 * USDC);
        bytes32 nonce = keccak256("n1");
        (uint8 v, bytes32 r, bytes32 s) = _signReceive(from, to, 40 * USDC, 0, block.timestamp + 1 hours, nonce);

        vm.prank(to);
        usdc.receiveWithAuthorization(from, to, 40 * USDC, 0, block.timestamp + 1 hours, nonce, v, r, s);

        assertEq(usdc.balanceOf(to), 40 * USDC);
        assertTrue(usdc.authorizationState(from, nonce));
    }

    function test_ReceiveWithAuthorization_RevertsWhenCallerNotPayee() public {
        address from = actors[0];
        _fund(from, 100 * USDC);
        bytes32 nonce = keccak256("n2");
        (uint8 v, bytes32 r, bytes32 s) = _signReceive(from, actors[1], 1 * USDC, 0, block.timestamp + 1 hours, nonce);

        vm.prank(actors[2]);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.CallerMustBePayee.selector, actors[2], actors[1]));
        usdc.receiveWithAuthorization(from, actors[1], 1 * USDC, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_ReceiveWithAuthorization_RevertsOnReuse() public {
        address from = actors[0];
        address to = actors[1];
        _fund(from, 100 * USDC);
        bytes32 nonce = keccak256("n3");
        (uint8 v, bytes32 r, bytes32 s) = _signReceive(from, to, 10 * USDC, 0, block.timestamp + 1 hours, nonce);

        vm.startPrank(to);
        usdc.receiveWithAuthorization(from, to, 10 * USDC, 0, block.timestamp + 1 hours, nonce, v, r, s);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.AuthorizationAlreadyUsed.selector, from, nonce));
        usdc.receiveWithAuthorization(from, to, 10 * USDC, 0, block.timestamp + 1 hours, nonce, v, r, s);
        vm.stopPrank();
    }

    function _signReceive(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
                ),
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(actorKey[from], digest);
    }
}
