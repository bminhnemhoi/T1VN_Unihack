// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @title FundDemoWallets
/// @notice Tops up the demo wallets from the deployer, only by what each one is missing (`docs/DEPLOY-FUJI.md` section 13):
///   AVAX : RELAYER 0.02, KEEPER 0.005, ORGANIZER 0.005 (gas; the members never hold AVAX, the relayer pays).
///   USDC : ORGANIZER and M1..M5 up to the target of the chosen mode.
///          single  (default)  1 circle  : ORGANIZER 48,  each member 41.
///          demoday            3 circles : ORGANIZER 144, each member 122.
/// A wallet that already has enough gets nothing; the script reverts before sending anything when the deployer cannot
/// cover the whole top-up.
/// @dev Testnet only (hard rule 1): Fuji (43113) or a local anvil (31337); any other chain id reverts before anything
/// is broadcast. Keys are never printed. Environment read by `run()`:
///   DEPLOYER_PRIVATE_KEY   required, read with `vm.envUint` (never on the command line).
///   RELAYER_ADDRESS, KEEPER_ADDRESS, ORGANIZER_ADDRESS, M1_ADDRESS .. M5_ADDRESS   required, public addresses.
///   FUND_TARGET            optional, `single` (default) or `demoday`.
///   DEPLOY_FILE            optional json with the `usdc` address; default `deployments/fuji.json` on Fuji and
///                          `deployments/anvil.json` on anvil. On Fuji the token must be Circle's USDC.
/// On anvil (31337) the deployer is minted any USDC it lacks (the deployed token is the public `MockUSDC`); on Fuji it
/// must already hold the USDC (Circle faucet) or the script reverts `InsufficientUsdc`.
contract FundDemoWallets is Script {
    using SafeERC20 for IERC20;

    uint256 internal constant FUJI_CHAIN_ID = 43113;
    uint256 internal constant ANVIL_CHAIN_ID = 31337;
    address internal constant FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    uint256 public constant RELAYER_AVAX = 0.02 ether;
    uint256 public constant KEEPER_AVAX = 0.005 ether;
    uint256 public constant ORGANIZER_AVAX = 0.005 ether;

    uint256 public constant SINGLE_ORGANIZER_USDC = 48e6;
    uint256 public constant SINGLE_MEMBER_USDC = 41e6;
    uint256 public constant DEMODAY_ORGANIZER_USDC = 144e6;
    uint256 public constant DEMODAY_MEMBER_USDC = 122e6;

    /// @notice How many circles the wallets must be able to serve.
    enum Target {
        Single,
        DemoDay
    }

    /// @dev Chain is neither Fuji nor anvil (mainnet 43114 lands here).
    error UnsupportedChain(uint256 chainId);
    /// @dev `FUND_TARGET` is neither `single` nor `demoday`.
    error InvalidTarget(string value);
    /// @dev A wallet address is zero, equals the deployer, or appears twice in the list.
    error BadWallet(string role, address wallet);
    /// @dev The token address has no code, or on Fuji it is not Circle's USDC.
    error BadToken(address token);
    /// @dev The deployer cannot cover the whole USDC top-up (nothing was sent).
    error InsufficientUsdc(uint256 have, uint256 need);
    /// @dev The deployer cannot cover the whole AVAX top-up (nothing was sent).
    error InsufficientAvax(uint256 have, uint256 need);
    /// @dev A balance did not reach its target after the transfers.
    error SanityCheckFailed(string what);

    /// @notice Inputs of `execute`; `run()` fills them from the environment.
    struct Params {
        uint256 deployerKey;
        address usdc;
        address relayer;
        address keeper;
        address organizer;
        address[5] members;
        Target target;
    }

    /// @notice What a run sent (base units; AVAX in wei).
    struct Result {
        uint256 avaxSent;
        uint256 usdcSent;
        uint256 transfers;
    }

    /// @notice Reads the environment and calls `execute`; this is the entry point for `forge script`.
    function run() external returns (Result memory r) {
        Params memory p;
        p.deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        p.relayer = vm.envAddress("RELAYER_ADDRESS");
        p.keeper = vm.envAddress("KEEPER_ADDRESS");
        p.organizer = vm.envAddress("ORGANIZER_ADDRESS");
        p.members[0] = vm.envAddress("M1_ADDRESS");
        p.members[1] = vm.envAddress("M2_ADDRESS");
        p.members[2] = vm.envAddress("M3_ADDRESS");
        p.members[3] = vm.envAddress("M4_ADDRESS");
        p.members[4] = vm.envAddress("M5_ADDRESS");
        p.target = parseTarget(vm.envOr("FUND_TARGET", string("single")));
        string memory defaultPath = block.chainid == FUJI_CHAIN_ID ? "deployments/fuji.json" : "deployments/anvil.json";
        p.usdc = vm.parseJsonAddress(vm.readFile(vm.envOr("DEPLOY_FILE", defaultPath)), ".usdc");
        return execute(p);
    }

    /// @notice Maps `single` / `demoday` to a `Target`; anything else reverts `InvalidTarget`.
    function parseTarget(string memory value) public pure returns (Target) {
        bytes32 h = keccak256(bytes(value));
        if (h == keccak256("single")) return Target.Single;
        if (h == keccak256("demoday")) return Target.DemoDay;
        revert InvalidTarget(value);
    }

    /// @notice Tops up every wallet to its target, broadcasting with the deployer key. See the contract NatSpec.
    function execute(Params memory p) public returns (Result memory r) {
        if (block.chainid != FUJI_CHAIN_ID && block.chainid != ANVIL_CHAIN_ID) revert UnsupportedChain(block.chainid);
        address deployer = vm.addr(p.deployerKey);
        _checkWallets(p, deployer);
        if (p.usdc.code.length == 0 || (block.chainid == FUJI_CHAIN_ID && p.usdc != FUJI_USDC)) {
            revert BadToken(p.usdc);
        }

        IERC20 usdc = IERC20(p.usdc);
        bool single = p.target == Target.Single;
        uint256 orgTarget = single ? SINGLE_ORGANIZER_USDC : DEMODAY_ORGANIZER_USDC;
        uint256 memTarget = single ? SINGLE_MEMBER_USDC : DEMODAY_MEMBER_USDC;

        // Shortfalls first, so that a deployer that cannot cover everything sends nothing at all.
        uint256 relayerAvax = _missing(p.relayer.balance, RELAYER_AVAX);
        uint256 keeperAvax = _missing(p.keeper.balance, KEEPER_AVAX);
        uint256 organizerAvax = _missing(p.organizer.balance, ORGANIZER_AVAX);
        uint256 organizerUsdc = _missing(usdc.balanceOf(p.organizer), orgTarget);
        uint256[5] memory memberUsdc;
        uint256 usdcNeed = organizerUsdc;
        for (uint256 i; i < 5; ++i) {
            memberUsdc[i] = _missing(usdc.balanceOf(p.members[i]), memTarget);
            usdcNeed += memberUsdc[i];
        }
        uint256 avaxNeed = relayerAvax + keeperAvax + organizerAvax;

        uint256 usdcHave = usdc.balanceOf(deployer);
        bool mintShortfall = block.chainid == ANVIL_CHAIN_ID && usdcHave < usdcNeed;
        if (!mintShortfall && usdcHave < usdcNeed) revert InsufficientUsdc(usdcHave, usdcNeed);
        if (deployer.balance < avaxNeed) revert InsufficientAvax(deployer.balance, avaxNeed);

        vm.startBroadcast(p.deployerKey);
        if (mintShortfall) MockUSDC(p.usdc).mint(deployer, usdcNeed - usdcHave);
        r.transfers += _sendAvax(p.relayer, relayerAvax);
        r.transfers += _sendAvax(p.keeper, keeperAvax);
        r.transfers += _sendAvax(p.organizer, organizerAvax);
        r.transfers += _sendUsdc(usdc, p.organizer, organizerUsdc);
        for (uint256 i; i < 5; ++i) {
            r.transfers += _sendUsdc(usdc, p.members[i], memberUsdc[i]);
        }
        vm.stopBroadcast();

        r.avaxSent = avaxNeed;
        r.usdcSent = usdcNeed;

        if (p.relayer.balance < RELAYER_AVAX) revert SanityCheckFailed("relayer.avax");
        if (p.keeper.balance < KEEPER_AVAX) revert SanityCheckFailed("keeper.avax");
        if (p.organizer.balance < ORGANIZER_AVAX) revert SanityCheckFailed("organizer.avax");
        if (usdc.balanceOf(p.organizer) < orgTarget) revert SanityCheckFailed("organizer.usdc");
        for (uint256 i; i < 5; ++i) {
            if (usdc.balanceOf(p.members[i]) < memTarget) revert SanityCheckFailed("member.usdc");
        }

        console2.log("chainId", block.chainid);
        console2.log("target (0 single, 1 demoday)", uint256(p.target));
        console2.log("AVAX sent (wei)", r.avaxSent);
        console2.log("USDC sent (base units)", r.usdcSent);
        console2.log("transfers", r.transfers);
    }

    function _missing(uint256 have, uint256 target) internal pure returns (uint256) {
        return have >= target ? 0 : target - have;
    }

    function _sendAvax(address to, uint256 amount) internal returns (uint256) {
        if (amount == 0) return 0;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert SanityCheckFailed("avax.transfer");
        return 1;
    }

    function _sendUsdc(IERC20 usdc, address to, uint256 amount) internal returns (uint256) {
        if (amount == 0) return 0;
        usdc.safeTransfer(to, amount);
        return 1;
    }

    /// @dev Non-zero, different from the deployer (ADR-21) and pairwise distinct.
    function _checkWallets(Params memory p, address deployer) internal pure {
        address[8] memory all =
            [p.relayer, p.keeper, p.organizer, p.members[0], p.members[1], p.members[2], p.members[3], p.members[4]];
        for (uint256 i; i < 8; ++i) {
            if (all[i] == address(0) || all[i] == deployer) revert BadWallet(_role(i), all[i]);
            for (uint256 j; j < i; ++j) {
                if (all[i] == all[j]) revert BadWallet(_role(i), all[i]);
            }
        }
    }

    function _role(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "relayer";
        if (i == 1) return "keeper";
        if (i == 2) return "organizer";
        return string.concat("m", vm.toString(i - 2));
    }
}
