// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {HuiFactory} from "../src/HuiFactory.sol";
import {HuiCircle} from "../src/HuiCircle.sol";
import {IHuiCircle} from "../src/interfaces/IHuiCircle.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {CircleMode, CircleParams, PermitSig} from "../src/libraries/HuiTypes.sol";

/// @title CreateDemoCircle
/// @notice Creates the docs/03 section 8 demo circle scaled to C = 10 USDC (N = 5, `Bidding`, demo timings
/// 180/90/60/120 s, P = 30 days, alpha 20%, fee 1%, reserve 1%) and has the organizer deposit the 48 USDC bond,
/// which gives a coverage index of 100%. Every figure of the worked example divides by 10 (docs/03 section 8).
/// @dev Testnet only (hard rule 1): Fuji (43113) or a local anvil (31337); any other chain id reverts before
/// anything is broadcast. The organizer key is read with `vm.envUint("DEMO_ORGANIZER_PRIVATE_KEY")`, never from the
/// command line. On anvil the organizer is minted the bond in MockUSDC; on Fuji the wallet must already hold it
/// (Circle faucet). Members then join through `/api/attest` + permit + `/api/relay`, and the organizer calls
/// `activate()` once five have joined. Environment:
///   DEMO_ORGANIZER_PRIVATE_KEY  required, testnet wallet.
///   DEPLOY_FILE                 optional; default `deployments/fuji.json` on Fuji, `deployments/anvil.json` on anvil.
///   JOIN_WINDOW_SECONDS         optional; seconds from now until `joinDeadline`; default 7 days.
///   DEMO_LABEL                  optional short name (at most 31 bytes, no personal names); default `huisafe-demo`.
contract CreateDemoCircle is Script {
    uint256 internal constant FUJI_CHAIN_ID = 43113;
    uint256 internal constant ANVIL_CHAIN_ID = 31337;

    uint8 internal constant MEMBERS = 5;
    uint96 internal constant CONTRIBUTION = 10e6; // 10 USDC
    uint256 internal constant BOND = 48e6; // (1 - alpha) * O_max = 0.8 * 60 USDC
    uint32 internal constant PERIOD_SECONDS = 30 days;
    uint32 internal constant ROUND_DURATION = 180;
    uint32 internal constant COMMIT_WINDOW = 90;
    uint32 internal constant REVEAL_WINDOW = 60;
    uint32 internal constant GRACE_SECONDS = 120;
    uint256 internal constant DEFAULT_JOIN_WINDOW = 7 days;

    /// @dev Chain is neither Fuji nor anvil (mainnet 43114 lands here).
    error UnsupportedChain(uint256 chainId);
    /// @dev The deployment file is missing a contract or the factory has no code.
    error NotDeployed(string file);
    /// @dev Fuji: the organizer wallet lacks the USDC for the bond.
    error InsufficientUsdc(uint256 have, uint256 need);
    /// @dev The label is longer than 31 bytes (it would be truncated into the bytes32).
    error LabelTooLong(uint256 length);
    /// @dev The circle did not come out as docs/03 section 8 expects.
    error SanityCheckFailed(string what);

    /// @notice Outputs of a run.
    struct Result {
        address circle;
        address organizer;
        uint256 coverageBps;
    }

    /// @notice Reads the environment and calls `execute`; this is the entry point for `forge script`.
    function run() external returns (Result memory r) {
        uint256 key = vm.envUint("DEMO_ORGANIZER_PRIVATE_KEY");
        string memory defaultPath = block.chainid == FUJI_CHAIN_ID ? "deployments/fuji.json" : "deployments/anvil.json";
        string memory file = vm.envOr("DEPLOY_FILE", defaultPath);
        uint256 window = vm.envOr("JOIN_WINDOW_SECONDS", DEFAULT_JOIN_WINDOW);
        string memory label = vm.envOr("DEMO_LABEL", string("huisafe-demo"));
        return execute(key, file, window, label);
    }

    /// @notice Creates the demo circle and deposits the bond, broadcasting with `organizerKey`.
    function execute(uint256 organizerKey, string memory file, uint256 joinWindow, string memory label)
        public
        returns (Result memory r)
    {
        if (block.chainid != FUJI_CHAIN_ID && block.chainid != ANVIL_CHAIN_ID) {
            revert UnsupportedChain(block.chainid);
        }

        if (bytes(label).length > 31) revert LabelTooLong(bytes(label).length);
        string memory json = vm.readFile(file);
        HuiFactory factory = HuiFactory(vm.parseJsonAddress(json, ".factory"));
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(json, ".usdc"));
        if (address(factory).code.length == 0 || address(usdc).code.length == 0) revert NotDeployed(file);

        address organizer = vm.addr(organizerKey);
        uint256 balance = usdc.balanceOf(organizer);
        if (balance < BOND && block.chainid == FUJI_CHAIN_ID) revert InsufficientUsdc(balance, BOND);

        CircleParams memory p = CircleParams({
            mode: CircleMode.Bidding,
            memberCount: MEMBERS,
            contribution: CONTRIBUTION,
            periodSeconds: PERIOD_SECONDS,
            roundDuration: ROUND_DURATION,
            commitWindow: COMMIT_WINDOW,
            revealWindow: REVEAL_WINDOW,
            graceSeconds: GRACE_SECONDS,
            alphaBps: 2000,
            commissionMode: true,
            feeBps: 100,
            reserveBps: 100,
            revealBondBps: 100,
            capBps: 2000,
            joinDeadline: uint64(block.timestamp + joinWindow),
            organizerIsMember: false,
            label: bytes32(bytes(label)),
            commissionShareBps: 0,
            termsHash: keccak256("HuiSafe demo circle terms v1.2 (fixed 1% fee, phi = 0)")
        });

        vm.startBroadcast(organizerKey);
        if (block.chainid == ANVIL_CHAIN_ID && balance < BOND) usdc.mint(organizer, BOND - balance);
        r.circle = factory.createCircle(p);
        PermitSig memory permit = _permit(usdc, organizerKey, organizer, r.circle, BOND);
        HuiCircle(payable(r.circle)).depositBond(BOND, permit);
        vm.stopBroadcast();

        r.organizer = organizer;
        r.coverageBps = IHuiCircle(r.circle).coverageIndexBps();
        if (HuiCircle(payable(r.circle)).bondRemaining() != BOND) revert SanityCheckFailed("bond");
        if (r.coverageBps != 10_000) revert SanityCheckFailed("coverage");

        console2.log("chainId", block.chainid);
        console2.log("demo circle", r.circle);
        console2.log("organizer", organizer);
        console2.log("bond (USDC base units)", BOND);
        console2.log("coverageBps", r.coverageBps);
    }

    /// @dev EIP-2612 permit signed by the organizer with the token's own domain separator.
    function _permit(MockUSDC usdc, uint256 key, address owner, address spender, uint256 value)
        internal
        view
        returns (PermitSig memory sig)
    {
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                value,
                usdc.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        sig = PermitSig({value: value, deadline: deadline, v: v, r: r, s: s});
    }
}
