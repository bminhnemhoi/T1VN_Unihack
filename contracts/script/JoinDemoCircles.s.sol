// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

import {HuiFactory} from "../src/HuiFactory.sol";
import {HuiCircle} from "../src/HuiCircle.sol";
import {IHuiCircle} from "../src/interfaces/IHuiCircle.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {CircleState, MemberAttestation, PermitSig} from "../src/libraries/HuiTypes.sol";
import {CreateDemoCircles} from "./CreateDemoCircles.s.sol";

/// @title JoinDemoCircles
/// @notice Puts the demo members M1..M5 into the Demo Day circles made by `CreateDemoCircles.s.sol` WITHOUT Privy and
/// without the members holding any AVAX, along the same path the web uses: the attester key signs each
/// `MemberAttestation` (what `/api/attest` does), the member key signs the USDC permit for exactly the circle's
/// `requiredAllowance` and the ERC-2771 forward request, and the relayer key broadcasts `forwarder.execute`
/// (what `/api/relay` does). Then the organizer activates each circle that ends up FULL (circle 1 and 2: 5 members;
/// circle 3: 3 members); a circle with a free seat stays `Forming` for a live joiner and is activated later with
/// `ActivateDemoCircle.s.sol`.
/// @dev Testnet only (hard rule 1): Fuji (43113) or a local anvil (31337); any other chain id reverts before anything
/// is broadcast. All keys are read with `vm.envUint`, never from the command line, and never printed:
///   DEMO_ORGANIZER_PRIVATE_KEY, DEMO_M1_PRIVATE_KEY .. DEMO_M5_PRIVATE_KEY, ATTESTER_PRIVATE_KEY, RELAYER_PRIVATE_KEY.
/// Optional: `M1_ADDRESS`..`M5_ADDRESS` (when set, must equal the address of the key), `DEPLOY_FILE` (default
/// `deployments/fuji.json` / `deployments/anvil.json`), `DEMO_JOIN` = `all` (default) or `fixed` (only the Fixed circle
/// is filled and activated, so the two bidding circles stay `Forming` for live joins through the web), `DEMO_ACTIVATE` =
/// `true` (default) or `false` (join only), `DEMO_MEMBERS` = how many of M1..M5 to put in (1..5; default 5, so every seat
/// is filled): `DEMO_MEMBERS=4` leaves the fifth seat of each bidding circle free for a person joining with Privy (the
/// Fixed circle takes at most its 3 seats). Re-running is safe when other people have already joined: it only requires
/// that every chosen M ends up in the circle, never that the member count equals the chosen number.
/// The three circles are the last three of `factory.circlesOf(organizer)`, recognised by their `termsHash`.
contract JoinDemoCircles is Script {
    uint256 internal constant FUJI_CHAIN_ID = 43113;
    uint256 internal constant ANVIL_CHAIN_ID = 31337;
    uint256 internal constant JOIN_GAS = 800_000;

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant ATTESTATION_TYPEHASH =
        keccak256("MemberAttestation(address member,address circle,bytes32 attestationId,uint64 expiry)");
    bytes32 internal constant FORWARD_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );

    /// @dev Chain is neither Fuji nor anvil (mainnet 43114 lands here).
    error UnsupportedChain(uint256 chainId);
    /// @dev The deployment file is missing a contract or the factory has no code.
    error NotDeployed(string file);
    /// @dev The organizer has no circle with the expected `termsHash` (run `CreateDemoCircles` first).
    error DemoCircleNotFound(bytes32 termsHash);
    /// @dev `DEMO_JOIN` is neither `all` nor `fixed`.
    error InvalidSelection(string value);
    /// @dev A member key does not match the address configured for that member.
    error AddressMismatch(uint256 member, address expected, address actual);
    /// @dev Two of the organizer, relayer, attester and member keys are the same wallet (ADR-21: one wallet per role).
    error DuplicateKey(address wallet);
    /// @dev A circle is not `Forming` or a chosen member is not in the circle after the joins.
    error SanityCheckFailed(string what);
    /// @dev `DEMO_MEMBERS` is above the five demo members.
    error InvalidMembers(uint256 members);

    /// @notice Which circles to fill.
    enum Selection {
        All,
        FixedOnly
    }

    /// @notice Everything `execute` needs; `run()` fills it from the environment.
    struct Params {
        string file;
        uint256 organizerKey;
        uint256[5] memberKeys;
        uint256 attesterKey;
        uint256 relayerKey;
        Selection selection;
        bool activate;
        /// @dev How many of M1..M5 to put in; 0 means all five.
        uint8 members;
    }

    /// @notice The three circles found, and how many members each ended with.
    struct Result {
        address bidding;
        address phi;
        address fixedCircle;
        uint8 biddingMembers;
        uint8 phiMembers;
        uint8 fixedMembers;
    }

    /// @notice Reads the environment and calls `execute`; this is the entry point for `forge script`.
    function run() external returns (Result memory r) {
        Params memory p;
        string memory defaultPath = block.chainid == FUJI_CHAIN_ID ? "deployments/fuji.json" : "deployments/anvil.json";
        p.file = vm.envOr("DEPLOY_FILE", defaultPath);
        p.organizerKey = vm.envUint("DEMO_ORGANIZER_PRIVATE_KEY");
        p.memberKeys[0] = vm.envUint("DEMO_M1_PRIVATE_KEY");
        p.memberKeys[1] = vm.envUint("DEMO_M2_PRIVATE_KEY");
        p.memberKeys[2] = vm.envUint("DEMO_M3_PRIVATE_KEY");
        p.memberKeys[3] = vm.envUint("DEMO_M4_PRIVATE_KEY");
        p.memberKeys[4] = vm.envUint("DEMO_M5_PRIVATE_KEY");
        p.attesterKey = vm.envUint("ATTESTER_PRIVATE_KEY");
        p.relayerKey = vm.envUint("RELAYER_PRIVATE_KEY");
        p.selection = parseSelection(vm.envOr("DEMO_JOIN", string("all")));
        p.activate = vm.envOr("DEMO_ACTIVATE", true);
        uint256 members = vm.envOr("DEMO_MEMBERS", uint256(0));
        if (members > 5) revert InvalidMembers(members);
        p.members = uint8(members);
        for (uint256 i; i < 5; ++i) {
            address configured = vm.envOr(string.concat("M", vm.toString(i + 1), "_ADDRESS"), address(0));
            if (configured != address(0) && configured != vm.addr(p.memberKeys[i])) {
                revert AddressMismatch(i + 1, configured, vm.addr(p.memberKeys[i]));
            }
        }
        return execute(p);
    }

    /// @notice Maps `all` / `fixed` to a `Selection`; anything else reverts `InvalidSelection`.
    function parseSelection(string memory value) public pure returns (Selection) {
        bytes32 h = keccak256(bytes(value));
        if (h == keccak256("all")) return Selection.All;
        if (h == keccak256("fixed")) return Selection.FixedOnly;
        revert InvalidSelection(value);
    }

    /// @notice Joins the members and activates the circles. See the contract NatSpec.
    function execute(Params memory p) public returns (Result memory r) {
        if (block.chainid != FUJI_CHAIN_ID && block.chainid != ANVIL_CHAIN_ID) revert UnsupportedChain(block.chainid);
        if (p.members > 5) revert InvalidMembers(p.members);
        uint8 chosen = p.members == 0 ? 5 : p.members;
        string memory json = vm.readFile(p.file);
        HuiFactory factory = HuiFactory(vm.parseJsonAddress(json, ".factory"));
        address forwarder = vm.parseJsonAddress(json, ".forwarder");
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(json, ".usdc"));
        if (address(factory).code.length == 0 || forwarder.code.length == 0 || address(usdc).code.length == 0) {
            revert NotDeployed(p.file);
        }

        address organizer = vm.addr(p.organizerKey);
        _requireDistinctKeys(p);
        CreateDemoCircles ids = new CreateDemoCircles();
        r.bidding = _find(factory, organizer, ids.TERMS_HASH_BIDDING());
        r.phi = _find(factory, organizer, ids.TERMS_HASH_PHI());
        r.fixedCircle = _find(factory, organizer, ids.TERMS_HASH_FIXED());

        if (p.selection == Selection.All) {
            r.biddingMembers = _fill(p, forwarder, usdc, r.bidding, chosen);
            r.phiMembers = _fill(p, forwarder, usdc, r.phi, chosen);
        }
        r.fixedMembers = _fill(p, forwarder, usdc, r.fixedCircle, chosen > 3 ? 3 : chosen);

        if (p.activate) {
            // Only circles that are full now: one with a free seat is left `Forming` for the person who will take it.
            vm.startBroadcast(p.organizerKey);
            if (p.selection == Selection.All) {
                _activateIfFull(r.bidding, 5);
                _activateIfFull(r.phi, 5);
            }
            _activateIfFull(r.fixedCircle, 3);
            vm.stopBroadcast();
            if (p.selection == Selection.All) {
                _requireActiveIfFull(r.bidding, 5, "bidding.active");
                _requireActiveIfFull(r.phi, 5, "phi.active");
            }
            _requireActiveIfFull(r.fixedCircle, 3, "fixed.active");
        }

        console2.log("chainId", block.chainid);
        console2.log("bidding circle members", r.biddingMembers);
        console2.log("phi circle members", r.phiMembers);
        console2.log("fixed circle members", r.fixedMembers);
        console2.log("activated", p.activate);
    }

    function _requireDistinctKeys(Params memory p) internal pure {
        address[8] memory all = [
            vm.addr(p.organizerKey),
            vm.addr(p.relayerKey),
            vm.addr(p.attesterKey),
            vm.addr(p.memberKeys[0]),
            vm.addr(p.memberKeys[1]),
            vm.addr(p.memberKeys[2]),
            vm.addr(p.memberKeys[3]),
            vm.addr(p.memberKeys[4])
        ];
        for (uint256 i = 1; i < 8; ++i) {
            for (uint256 j; j < i; ++j) {
                if (all[i] == all[j]) revert DuplicateKey(all[i]);
            }
        }
    }

    /// @dev Newest circle of `organizer` whose terms hash is `terms`.
    function _find(HuiFactory factory, address organizer, bytes32 terms) internal view returns (address) {
        address[] memory all = factory.circlesOf(organizer);
        for (uint256 i = all.length; i > 0; --i) {
            if (IHuiCircle(all[i - 1]).params().termsHash == terms) return all[i - 1];
        }
        revert DemoCircleNotFound(terms);
    }

    function _activateIfFull(address circle, uint256 seats) internal {
        if (HuiCircle(payable(circle)).state() == CircleState.Forming && IHuiCircle(circle).members().length == seats) {
            HuiCircle(payable(circle)).activate();
        }
    }

    function _requireActiveIfFull(address circle, uint256 seats, string memory what) internal view {
        if (IHuiCircle(circle).members().length == seats && HuiCircle(payable(circle)).state() != CircleState.Active) {
            revert SanityCheckFailed(what);
        }
    }

    /// @dev True when M1..M`count` are all in `circle`.
    function _allJoined(Params memory p, address circle, uint8 count) internal view returns (bool) {
        for (uint256 i; i < count; ++i) {
            if (!IHuiCircle(circle).memberInfo(vm.addr(p.memberKeys[i])).joined) return false;
        }
        return true;
    }

    /// @dev Joins members M1..M`count` (those not yet in) into `circle`; returns the member count afterwards, which
    /// can be higher than `count` when other people joined. A circle that already left `Forming` is accepted only when
    /// every chosen member is already in it (a re-run after activation).
    function _fill(Params memory p, address forwarder, MockUSDC usdc, address circle, uint8 count)
        internal
        returns (uint8)
    {
        if (HuiCircle(payable(circle)).state() != CircleState.Forming) {
            if (_allJoined(p, circle, count)) return uint8(IHuiCircle(circle).members().length);
            revert SanityCheckFailed("not.forming");
        }
        for (uint256 i; i < count; ++i) {
            address member = vm.addr(p.memberKeys[i]);
            if (IHuiCircle(circle).memberInfo(member).joined) continue;
            bytes memory data = abi.encodeCall(
                IHuiCircle.join,
                (
                    _attestation(member, circle),
                    _attestationSig(p.attesterKey, member, circle),
                    _permit(usdc, p.memberKeys[i], circle)
                )
            );
            _relay(p.relayerKey, p.memberKeys[i], forwarder, circle, data);
        }
        if (!_allJoined(p, circle, count)) revert SanityCheckFailed("member.joined");
        return uint8(IHuiCircle(circle).members().length);
    }

    function _attestation(address member, address circle) internal view returns (MemberAttestation memory) {
        // One id per (member, circle); the prefix keeps it apart from the web's server-secret ids.
        return MemberAttestation({
            member: member,
            circle: circle,
            attestationId: keccak256(abi.encodePacked("huisafe-demo-join", member, circle)),
            expiry: uint64(block.timestamp + 1 hours)
        });
    }

    function _attestationSig(uint256 attesterKey, address member, address circle) internal view returns (bytes memory) {
        MemberAttestation memory a = _attestation(member, circle);
        bytes32 structHash = keccak256(abi.encode(ATTESTATION_TYPEHASH, a.member, a.circle, a.attestationId, a.expiry));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attesterKey, _digest("HuiSafe", circle, structHash));
        return abi.encodePacked(r, s, v);
    }

    /// @dev EIP-2612 permit for exactly `requiredAllowance()`: `join` calls `permit` with that value.
    function _permit(MockUSDC usdc, uint256 memberKey, address circle) internal view returns (PermitSig memory sig) {
        address owner = vm.addr(memberKey);
        uint256 value = IHuiCircle(circle).requiredAllowance();
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                circle,
                value,
                usdc.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(memberKey, digest);
        sig = PermitSig({value: value, deadline: deadline, v: v, r: r, s: s});
    }

    /// @dev The member signs the forward request; the relayer broadcasts `forwarder.execute` and pays the gas.
    function _relay(uint256 relayerKey, uint256 memberKey, address forwarder, address to, bytes memory data) internal {
        address from = vm.addr(memberKey);
        uint48 deadline = uint48(block.timestamp + 1 hours);
        uint256 nonce = ERC2771Forwarder(forwarder).nonces(from);
        bytes32 structHash =
            keccak256(abi.encode(FORWARD_TYPEHASH, from, to, uint256(0), JOIN_GAS, nonce, deadline, keccak256(data)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(memberKey, _digest("HuiSafeForwarder", forwarder, structHash));
        ERC2771Forwarder.ForwardRequestData memory req = ERC2771Forwarder.ForwardRequestData({
            from: from,
            to: to,
            value: 0,
            gas: JOIN_GAS,
            deadline: deadline,
            data: data,
            signature: abi.encodePacked(r, s, v)
        });
        vm.startBroadcast(relayerKey);
        ERC2771Forwarder(forwarder).execute(req);
        vm.stopBroadcast();
    }

    function _digest(string memory name, address verifying, bytes32 structHash) internal view returns (bytes32) {
        bytes32 domain = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256("1"), block.chainid, verifying)
        );
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }
}
