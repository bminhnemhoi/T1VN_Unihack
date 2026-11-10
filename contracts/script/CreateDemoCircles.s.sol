// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {HuiFactory} from "../src/HuiFactory.sol";
import {HuiCircle} from "../src/HuiCircle.sol";
import {IHuiCircle} from "../src/interfaces/IHuiCircle.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {CircleMode, CircleParams, CircleState, PermitSig} from "../src/libraries/HuiTypes.sol";

/// @title CreateDemoCircles
/// @notice Creates the three Demo Day circles (C = 10 USDC, demo timing 180/90/60/120 s, P = 30 days, alpha 20%) and has
/// the organizer deposit each bond, so every one reaches a coverage index of exactly 100%:
///   1. `Bidding`, N = 5, phi = 0 (fee 1% of the pot): docs/03 section 8 divided by 10. Bond 48 USDC.
///   2. `Bidding`, N = 5, phi = 5000 (fee ceiling 3%): docs/03 section 8.1 divided by 10. Bond 48 USDC.
///   3. `Fixed`, N = 3 (docs/14 ADR-28: runs ahead of the demo until it completes). Bond 16 USDC.
/// Members then join with `JoinDemoCircles.s.sol` (or through the web) and the organizer activates.
/// @dev Testnet only (hard rule 1): Fuji (43113) or a local anvil (31337); any other chain id reverts before anything
/// is broadcast. The organizer key is read with `vm.envUint("DEMO_ORGANIZER_PRIVATE_KEY")`, never from the command
/// line. On anvil the organizer is minted any bond USDC it lacks; on Fuji it must already hold 112 USDC
/// (`FundDemoWallets.s.sol` with `FUND_TARGET=demoday` gives 144). Environment read by `run()`:
///   DEMO_ORGANIZER_PRIVATE_KEY  required, testnet wallet.
///   DEPLOY_FILE                 optional; default `deployments/fuji.json` on Fuji, `deployments/anvil.json` on anvil.
///   JOIN_WINDOW_SECONDS         optional; seconds from now until `joinDeadline`; default 7 days.
///   DEMO_FORCE                  optional `true`: create even if live demo circles of this organizer already exist.
contract CreateDemoCircles is Script {
    uint256 internal constant FUJI_CHAIN_ID = 43113;
    uint256 internal constant ANVIL_CHAIN_ID = 31337;
    uint256 internal constant DEFAULT_JOIN_WINDOW = 7 days;
    uint96 internal constant CONTRIBUTION = 10e6; // 10 USDC

    /// @notice `keccak256` of the standard agreement text of each demo circle, `buildTermsText(DEMO_*_TERMS_INPUT)` in
    /// `packages/sdk/src/terms.ts` (ADR-27). `test/vectors/terms.json` pins text and hash; regenerate both with
    /// `pnpm --filter sdk generate:terms` whenever the text changes. The web verifies them with `verifyTerms`.
    bytes32 public constant TERMS_HASH_BIDDING = 0xd635fa40006e68e86ab9a09230677cb732f9f06da1dfa920561f3d79349389c6;
    bytes32 public constant TERMS_HASH_PHI = 0x46a9b59df25aa753c070cca1e618e5358890a99fea5d5675f89b5c874f845b5a;
    bytes32 public constant TERMS_HASH_FIXED = 0x23c8f462fdd886b5c9037eef2cbb1fc6b9052da7709a7c0d5d36b94805893b31;

    uint256 public constant BOND_BIDDING = 48e6; // (1 - alpha) * O_max = 0.8 * 60 USDC
    uint256 public constant BOND_PHI = 48e6;
    uint256 public constant BOND_FIXED = 16e6; // 0.8 * 20 USDC (N = 3: O_max = 1 * 2 * C)

    /// @dev Chain is neither Fuji nor anvil (mainnet 43114 lands here).
    error UnsupportedChain(uint256 chainId);
    /// @dev The deployment file is missing a contract or the factory has no code.
    error NotDeployed(string file);
    /// @dev Fuji: the organizer wallet lacks the USDC for the three bonds.
    error InsufficientUsdc(uint256 have, uint256 need);
    /// @dev The organizer already has a live (Forming, Active or Paused) demo circle of this kind; rerunning would lock
    /// another 112 USDC of bond. Set `DEMO_FORCE=true` to create them anyway.
    error AlreadyCreated(address circle);
    /// @dev A circle did not come out as docs/03 section 8 expects.
    error SanityCheckFailed(string what);

    /// @notice Circles created by a run, in creation order: bidding phi 0, bidding phi 5000, fixed.
    struct Result {
        address bidding;
        address phi;
        address fixedCircle;
        address organizer;
    }

    /// @notice Reads the environment and calls `execute`; this is the entry point for `forge script`.
    function run() external returns (Result memory r) {
        uint256 key = vm.envUint("DEMO_ORGANIZER_PRIVATE_KEY");
        string memory defaultPath = block.chainid == FUJI_CHAIN_ID ? "deployments/fuji.json" : "deployments/anvil.json";
        return execute(
            key,
            vm.envOr("DEPLOY_FILE", defaultPath),
            vm.envOr("JOIN_WINDOW_SECONDS", DEFAULT_JOIN_WINDOW),
            vm.envOr("DEMO_FORCE", false)
        );
    }

    /// @notice Creates the three circles and deposits the three bonds, broadcasting with `organizerKey`.
    function execute(uint256 organizerKey, string memory file, uint256 joinWindow, bool force)
        public
        returns (Result memory r)
    {
        if (block.chainid != FUJI_CHAIN_ID && block.chainid != ANVIL_CHAIN_ID) {
            revert UnsupportedChain(block.chainid);
        }
        string memory json = vm.readFile(file);
        HuiFactory factory = HuiFactory(vm.parseJsonAddress(json, ".factory"));
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(json, ".usdc"));
        if (address(factory).code.length == 0 || address(usdc).code.length == 0) revert NotDeployed(file);

        r.organizer = vm.addr(organizerKey);
        uint256 need = BOND_BIDDING + BOND_PHI + BOND_FIXED;
        uint256 balance = usdc.balanceOf(r.organizer);
        if (balance < need && block.chainid == FUJI_CHAIN_ID) revert InsufficientUsdc(balance, need);

        if (!force) _requireNoLiveDemoCircle(factory, r.organizer);
        uint64 deadline = uint64(block.timestamp + joinWindow);
        vm.startBroadcast(organizerKey);
        if (block.chainid == ANVIL_CHAIN_ID && balance < need) usdc.mint(r.organizer, need - balance);
        r.bidding = _create(
            factory,
            usdc,
            organizerKey,
            _biddingParams(0, 100, TERMS_HASH_BIDDING, "huisafe-demo-bid", deadline),
            BOND_BIDDING
        );
        r.phi = _create(
            factory,
            usdc,
            organizerKey,
            _biddingParams(5000, 300, TERMS_HASH_PHI, "huisafe-demo-phi", deadline),
            BOND_PHI
        );
        r.fixedCircle = _create(factory, usdc, organizerKey, _fixedParams(deadline), BOND_FIXED);
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("organizer", r.organizer);
        console2.log("demo circle 1 bidding phi=0   ", r.bidding);
        console2.log("demo circle 2 bidding phi=5000", r.phi);
        console2.log("demo circle 3 fixed N=3       ", r.fixedCircle);
    }

    /// @dev Reverts when `organizer` still has a Forming, Active or Paused circle with one of the three demo terms hashes.
    function _requireNoLiveDemoCircle(HuiFactory factory, address organizer) internal view {
        address[] memory all = factory.circlesOf(organizer);
        for (uint256 i; i < all.length; ++i) {
            bytes32 t = IHuiCircle(all[i]).params().termsHash;
            if (t != TERMS_HASH_BIDDING && t != TERMS_HASH_PHI && t != TERMS_HASH_FIXED) continue;
            CircleState s = HuiCircle(payable(all[i])).state();
            if (s == CircleState.Forming || s == CircleState.Active || s == CircleState.Paused) {
                revert AlreadyCreated(all[i]);
            }
        }
    }

    function _create(HuiFactory factory, MockUSDC usdc, uint256 key, CircleParams memory p, uint256 bond)
        internal
        returns (address circle)
    {
        circle = factory.createCircle(p);
        HuiCircle(payable(circle)).depositBond(bond, _permit(usdc, key, vm.addr(key), circle, bond));
        if (HuiCircle(payable(circle)).bondRemaining() != bond) revert SanityCheckFailed("bond");
        if (IHuiCircle(circle).coverageIndexBps() != 10_000) revert SanityCheckFailed("coverage");
        if (IHuiCircle(circle).params().termsHash != p.termsHash) revert SanityCheckFailed("termsHash");
    }

    function _biddingParams(uint16 phiBps, uint16 feeBps, bytes32 terms, string memory label, uint64 joinDeadline)
        internal
        pure
        returns (CircleParams memory)
    {
        return CircleParams({
            mode: CircleMode.Bidding,
            memberCount: 5,
            contribution: CONTRIBUTION,
            periodSeconds: 30 days,
            roundDuration: 180,
            commitWindow: 90,
            revealWindow: 60,
            graceSeconds: 120,
            alphaBps: 2000,
            commissionMode: true,
            feeBps: feeBps,
            reserveBps: 100,
            revealBondBps: 100,
            capBps: 2000,
            joinDeadline: joinDeadline,
            organizerIsMember: false,
            label: bytes32(bytes(label)),
            commissionShareBps: phiBps,
            termsHash: terms
        });
    }

    function _fixedParams(uint64 joinDeadline) internal pure returns (CircleParams memory) {
        return CircleParams({
            mode: CircleMode.Fixed,
            memberCount: 3,
            contribution: CONTRIBUTION,
            periodSeconds: 30 days,
            roundDuration: 180,
            commitWindow: 0,
            revealWindow: 0,
            graceSeconds: 120,
            alphaBps: 2000,
            commissionMode: true,
            feeBps: 100,
            reserveBps: 100,
            revealBondBps: 0,
            capBps: 2000,
            joinDeadline: joinDeadline,
            organizerIsMember: false,
            label: bytes32(bytes("huisafe-demo-fixed")),
            commissionShareBps: 0,
            termsHash: TERMS_HASH_FIXED
        });
    }

    /// @dev EIP-2612 permit signed by `key` with the token's own domain separator.
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
