// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

import {HuiCircleHarness} from "../utils/HuiCircleHarness.sol";
import {RecordingUSDC} from "../utils/RecordingUSDC.sol";
import {HuiFactory} from "../../src/HuiFactory.sol";
import {IHuiCircle} from "../../src/interfaces/IHuiCircle.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";
import {
    CircleMode,
    CircleParams,
    CircleState,
    MemberAttestation,
    MemberInfo,
    PermitSig,
    RoundInfo,
    Shortfall
} from "../../src/libraries/HuiTypes.sol";

/// @notice Everything the Handler needs from the test that builds the system.
struct Wiring {
    HuiCircleHarness circle;
    RecordingUSDC usdc;
    HuiFactory factory;
    ERC2771Forwarder forwarder;
    address implementation;
    address admin;
    address organizer;
    address[5] members;
    uint256[5] keys;
    uint256 attesterKey;
    /// @dev docs/09 section 4.1, HuiInvariantsFullCoverage: members that never received never stop paying, and all
    /// receivers that will ever stop do so at the same moment (the case docs/03 section 7.3 proves).
    bool fullCoverage;
}

/// @title Handler
/// @notice Stateful fuzzing driver of the HuiCircle invariant suite (docs/09 section 4.2, 4.3). Actors: the five
/// members, the organizer, a keeper (this contract), the admin (through the factory), the USDC issuer (blacklist) and
/// an attacker. Every action is wrapped in `try/catch`, inputs are `bound()`ed to valid ranges and the ghost
/// variables record what the invariants of `Invariants.t.sol` compare with the contract state.
/// @dev Time: `vm.getBlockTimestamp()` everywhere (the via-IR optimizer may cache `block.timestamp` across `vm.warp`).
/// Money accounting: `RecordingUSDC` logs each balance movement; after every call into the circle `_audit` replays
/// the new entries to prove nobody was pulled for more than the call allows (INV-04) and nobody but members and the
/// organizer received USDC (INV-07).
contract Handler is Test {
    uint256 internal constant N = 5;
    uint256 internal constant C = 100e6;
    uint256 internal constant ORG = 5; // index of the organizer in the 6-slot accounting arrays
    uint256 internal constant NONE = type(uint256).max;

    HuiCircleHarness public immutable circle;
    RecordingUSDC public immutable usdc;
    HuiFactory public immutable factory;
    ERC2771Forwarder public immutable forwarder;
    address public immutable implementation;
    address public immutable admin;
    address public immutable organizer;
    bool public immutable fullCoverage;

    address[5] public members;
    uint256[5] internal _keys;
    uint256 internal immutable _attesterKey;
    uint256 internal immutable _attackerKey;
    address public immutable attacker;
    address public immutable sink; // where drained USDC goes (not a protocol address)

    // ------------------------------------------------------------------ ghost variables (docs/09 section 4.3)

    /// @notice Total paid out to round winners (`RoundInfo.payout`).
    uint256 public ghostPaidOut;
    mapping(address => uint256) public ghostWins;
    mapping(uint32 => uint256) public ghostMaxBidAtSettle;
    /// @dev Per settled round: principal + late fee the winner repaid from the pot (from `DebtRepaid`).
    mapping(uint32 => uint256) public ghostRepaidAtSettle;
    /// @dev Per settled round: USDC actually pulled by `transferFrom` (from `RecordingUSDC`).
    mapping(uint32 => uint256) public ghostPulledAtSettle;
    /// @dev Per settled round: shortfall amounts covered from holdback, bond and reserve (from `ShortfallCovered`).
    mapping(uint32 => uint256) public ghostCoveredAtSettle;
    mapping(uint32 => uint256) public ghostUncoveredAtSettle;
    /// @dev The member received the full `holdbackFor(alpha, N, r, C)` when it won.
    mapping(address => bool) public ghostFullH;

    uint256 public ghostUnexpectedRecipient;
    uint256 public ghostAdminReceived;
    uint256 public ghostSettledBeforeDeadline;
    bytes32 public ghostParamsHash;
    bool public ghostAnyShortfall;
    bool public ghostAnyLate;
    uint256 public ghostUnauthorizedSuccess;

    /// @dev INV-04: calls where a member was pulled for more than allowed, and the first such case.
    uint256 public ghostOverPull;
    address public ghostOverPullWho;
    uint256 public ghostOverPullPulled;
    uint256 public ghostOverPullAllowed;

    /// @dev INV-09 extras: a pause that did not shift the schedule by exactly its length, a state-changing call that
    /// worked while Paused, a commit or reveal that worked outside its window or a reveal above the bid cap.
    uint256 public ghostScheduleBreak;
    uint256 public ghostPausedBreach;
    uint256 public ghostWindowBreach;
    uint256 public ghostBidCapBreach;

    /// @dev Liveness (audit M-01): `settleRound()` / `finalize()` reverted although the circle was Active and past
    /// the moment the spec allows them (docs/03 section 6.5 and 5.3), the first selector seen and the round.
    uint256 public ghostStuckSettle;
    bytes4 public ghostStuckSettleSelector;
    uint32 public ghostStuckSettleRound;
    uint256 public ghostStuckFinalize;
    bytes4 public ghostStuckFinalizeSelector;

    /// @dev Own copies of what the INV-03 / INV-09 checks compare the circle with (audit L-04): the number of
    /// payers L_k locked at the first commit of a round, when the current pause began, and for each settled round the
    /// time and the `pausedTotal` at the moment it was settled.
    mapping(uint32 => uint256) internal _payersSnap;

    // ---- v1.2 (A13): INV-11 (commission inside the interest room), INV-12 (reserve split), INV-13 (fee timing)
    /// @dev L_k the Handler derives on its own right before each settlement (first-commit snapshot or live - 1).
    mapping(uint32 => uint256) public ghostPayersAtSettle;
    /// @dev room_k = statutory maxBid(k) * L_k, from `HuiMath` and the Handler's own L_k.
    mapping(uint32 => uint256) public ghostRoomAtSettle;
    /// @dev Number of `ContributionShortfall` events of the settlement transaction of round k.
    mapping(uint32 => uint256) public ghostShortfallsAtSettle;
    /// @dev Amount of the `FeePaid` event of round k (0 if none).
    mapping(uint32 => uint256) public ghostFeePaidAtSettle;
    uint256 public ghostFeePaidTotal;
    /// @dev `CircleFinalized` data and `ReserveShared` events of the one `finalize` call that succeeded.
    uint256 public ghostFinalizeFees;
    uint256 public ghostReserveDistributed;
    uint256 public ghostReserveSharedSum;
    uint256 public ghostReserveSharedCount;
    mapping(address => uint256) public ghostReserveShare;
    mapping(address => uint16) public ghostReserveWeight;
    uint256 public ghostPauseStart;
    mapping(uint32 => uint256) public ghostSettledAt;
    mapping(uint32 => uint256) public ghostPausedTotalAtSettle;

    /// @dev Winner of each settled round as the Handler saw it at settlement (compared with the views through the lens).
    mapping(uint32 => address) public ghostWinnerOf;

    /// @dev Fixed mode (docs/03 section 6.4): per settled round the winner the Handler derives on its own from the
    /// pre-settlement flags and the joinIndex order (first member that has not received and is not frozen, frozen ones
    /// last), whether a frozen member existed, and the counters of rounds checked and of order violations seen.
    mapping(uint32 => address) public ghostFixedExpected;
    mapping(uint32 => bool) public ghostFixedFrozenAtSettle;
    uint256 public ghostFixedChecked;
    uint256 public ghostFixedOrderBreak;
    uint256 public ghostFixedStrictBreak;
    uint256 public ghostFixedFrozenRounds;

    uint256 public ghostDefaults;
    uint256 public ghostLatePaid;
    uint256 public ghostRepaid;
    uint256 public ghostSkippedReveals;
    uint256 public ghostCommits;
    uint256 public ghostReveals;
    uint256 public ghostSettles;
    bool public ghostFinalized;
    bool public ghostUnwound;
    bool public ghostStoppedReceivers;

    // ------------------------------------------------------------------ call counters

    mapping(string => uint256) public calls;
    string[] internal _names;

    // ------------------------------------------------------------------ bookkeeping

    struct BidRec {
        uint256 bid;
        bytes32 salt;
        bool exists;
        bool revealed;
    }

    mapping(uint32 => mapping(uint256 => BidRec)) internal _bids;
    uint256 internal _ctr; // spreads calls between direct calls and calls through the ERC-2771 forwarder

    constructor(Wiring memory w) {
        circle = w.circle;
        usdc = w.usdc;
        factory = w.factory;
        forwarder = w.forwarder;
        implementation = w.implementation;
        admin = w.admin;
        organizer = w.organizer;
        members = w.members;
        _keys = w.keys;
        _attesterKey = w.attesterKey;
        fullCoverage = w.fullCoverage;
        _attackerKey = uint256(keccak256("huisafe.invariant.attacker"));
        attacker = vm.addr(_attackerKey);
        sink = makeAddr("sink");
        ghostParamsHash = keccak256(abi.encode(w.circle.params()));
    }

    function names() external view returns (string[] memory) {
        return _names;
    }

    // ================================================================== helpers

    function _now() internal view returns (uint256) {
        return vm.getBlockTimestamp();
    }

    function _hit(string memory name) internal {
        if (calls[name] == 0) _names.push(name);
        calls[name] += 1;
    }

    function _addr(uint256 i) internal view returns (address) {
        return i == ORG ? organizer : members[i];
    }

    function _idx(address a) internal view returns (uint256) {
        if (a == organizer) return ORG;
        for (uint256 i = 0; i < N; i++) {
            if (members[i] == a) return i;
        }
        return NONE;
    }

    function _is(CircleState s) internal view returns (bool) {
        return circle.state() == s;
    }

    /// @dev Members that are alive (joined, not received, not defaulted), counted from the public member info.
    function _liveNow() internal view returns (uint256 live) {
        for (uint256 i = 0; i < N; i++) {
            MemberInfo memory mi = circle.memberInfo(members[i]);
            if (mi.joined && !mi.received && !mi.defaulted) live++;
        }
    }

    /// @dev INV-03 bound computed with `HuiMath.maxBid` and the Handler's own L_k: the payers snapshot taken at the
    /// first successful commit of round `k` (docs/03 section 6.3), or the live members minus one before any commit.
    /// Never reads `circle.maxBid`.
    function _payersNow(uint32 k) internal view returns (uint256 payers) {
        payers = _payersSnap[k];
        if (payers == 0) {
            uint256 live = _liveNow();
            payers = live > 0 ? live - 1 : 0;
        }
    }

    function _statutory(uint32 k, uint256 payers) internal view returns (uint256) {
        CircleParams memory p = circle.params();
        return HuiMath.maxBid(p.capBps, N, k, C, p.periodSeconds, payers);
    }

    /// @dev With phi > 0 the enforced cap is the statutory one minus the organizer's share (docs/03 section 2.7).
    function _maxBid(uint32 k) internal view returns (uint256) {
        return HuiMath.bidCapAfterShare(_statutory(k, _payersNow(k)), circle.params().commissionShareBps);
    }

    /// @notice The INV-03 bound the Handler computes on its own (payers snapshot of the first commit, else live - 1);
    /// the view tests compare `circle.maxBid(k)` with it.
    function expectedMaxBid(uint32 k) external view returns (uint256) {
        return _maxBid(k);
    }

    function _firstSelector(bytes memory reason) internal pure returns (bytes4 sel) {
        if (reason.length >= 4) {
            assembly ("memory-safe") {
                sel := mload(add(reason, 0x20))
            }
        }
    }

    /// @dev Calls `data` on the circle as member `i`, one time in three through a signed ERC-2771 request.
    function _callAs(uint256 i, bytes memory data) internal returns (bool ok) {
        address from = members[i];
        _ctr += 1;
        if (_ctr % 3 == 0) {
            ERC2771Forwarder.ForwardRequestData memory req = ERC2771Forwarder.ForwardRequestData({
                from: from,
                to: address(circle),
                value: 0,
                gas: 1_500_000,
                deadline: uint48(_now() + 1 hours),
                data: data,
                signature: ""
            });
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(_keys[i], _forwardDigest(req));
            req.signature = abi.encodePacked(r, s, v);
            try forwarder.execute(req) {
                return true;
            } catch {
                return false;
            }
        }
        address target = address(circle);
        vm.prank(from);
        (ok,) = target.call(data);
    }

    function _forwardDigest(ERC2771Forwarder.ForwardRequestData memory req) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
                ),
                req.from,
                req.to,
                req.value,
                req.gas,
                forwarder.nonces(req.from),
                req.deadline,
                keccak256(req.data)
            )
        );
        (, string memory name, string memory version, uint256 chainId, address verifying,,) = forwarder.eip712Domain();
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifying
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    // ------------------------------------------------------------------ INV-04 / INV-07 accounting

    /// @dev Replays the USDC movements recorded since `mark`: pulls into the circle must not exceed `allowed` per
    /// slot (INV-04) and everything the circle sent out must go to a member or the organizer (INV-07).
    /// Returns the total pulled into the circle.
    function _audit(uint256 mark, uint256[6] memory allowed) internal returns (uint256 totalPulled) {
        uint256 end = usdc.recordCount();
        uint256[6] memory pulled;
        for (uint256 r = mark; r < end; r++) {
            (address from, address to, uint256 amount) = usdc.recordAt(r);
            if (to == address(circle)) {
                uint256 idx = _idx(from);
                if (idx == NONE) {
                    if (from != address(0)) _flagOverPull(from, amount, 0);
                } else {
                    pulled[idx] += amount;
                }
                totalPulled += amount;
            } else if (from == address(circle)) {
                if (_idx(to) == NONE) ghostUnexpectedRecipient += 1;
                if (to == admin) ghostAdminReceived += amount;
            }
        }
        for (uint256 i = 0; i < 6; i++) {
            if (pulled[i] > allowed[i]) _flagOverPull(_addr(i), pulled[i], allowed[i]);
        }
    }

    function _flagOverPull(address who, uint256 pulled, uint256 allowed) internal {
        if (ghostOverPull == 0) {
            ghostOverPullWho = who;
            ghostOverPullPulled = pulled;
            ghostOverPullAllowed = allowed;
        }
        ghostOverPull += 1;
    }

    function _none() internal pure returns (uint256[6] memory z) {}

    // ================================================================== time

    /// @notice Move the clock forward 1..300 seconds.
    function warp(uint256 secs) external {
        _hit("warp");
        vm.warp(_now() + bound(secs, 1, 300));
    }

    // ================================================================== sealed bids (members M1..M5)

    /// @dev Commit `bid` with `salt` as member `i` for round `k`; records it for the later reveal.
    function _doCommit(uint256 i, uint32 k, uint256 bid, bytes32 salt) internal {
        bytes32 h = keccak256(abi.encode(address(circle), k, members[i], bid, salt));
        uint256[6] memory allowed;
        allowed[i] = circle.commitOf(k, members[i]).commitIndex == 0 ? circle.revealBond() : 0;
        uint256 start = circle.roundStart(k);
        bool inWindow = _now() >= start && _now() < start + circle.params().commitWindow;
        bool wasPaused = _is(CircleState.Paused);
        uint256 liveBefore = _liveNow();
        uint256 mark = usdc.recordCount();
        bool ok = _callAs(i, abi.encodeCall(circle.commitBid, (h)));
        _audit(mark, allowed);
        if (!ok) return;
        if (wasPaused) ghostPausedBreach += 1;
        if (!inWindow) ghostWindowBreach += 1;
        if (_payersSnap[k] == 0 && liveBefore > 0) _payersSnap[k] = liveBefore - 1;
        ghostCommits += 1;
        _bids[k][i] = BidRec({bid: bid, salt: salt, exists: true, revealed: false});
    }

    /// @dev Reveal the recorded bid of member `i` (with `salt`, which may be wrong on purpose).
    function _doReveal(uint256 i, uint32 k, bytes32 salt) internal {
        BidRec memory rec = _bids[k][i];
        uint256 revealStart = circle.roundStart(k) + circle.params().commitWindow;
        bool inWindow = _now() >= revealStart && _now() < revealStart + circle.params().revealWindow;
        uint256 maxB = _maxBid(k);
        bool wasPaused = _is(CircleState.Paused);
        uint256 mark = usdc.recordCount();
        bool ok = _callAs(i, abi.encodeCall(circle.revealBid, (rec.bid, salt)));
        _audit(mark, _none());
        if (!ok) return;
        if (wasPaused) ghostPausedBreach += 1;
        if (!inWindow) ghostWindowBreach += 1;
        if (rec.bid > maxB || rec.bid >= C) ghostBidCapBreach += 1;
        _bids[k][i].revealed = true;
        ghostReveals += 1;
    }

    /// @notice A member commits a bid for the current round. Bids are bounded by `maxBid(k)` (< C); one commit in
    /// eight is deliberately one unit above the cap, which can never be revealed and forfeits the reveal bond.
    function commit(uint256 seed, uint256 bidSeed, bytes32 salt) external {
        _hit("commit");
        if (!_is(CircleState.Active) && !_is(CircleState.Paused)) return;
        uint32 k = circle.currentRound();
        uint256 maxB = _maxBid(k);
        uint256 bid = uint8(salt[0]) % 8 == 0 ? maxB + 1 : bound(bidSeed, 0, maxB);
        _doCommit(bound(seed, 0, N - 1), k, bid, salt);
    }

    /// @notice A member opens the bid it committed. `mode % 4 == 0` deliberately skips the reveal (the bond is
    /// forfeited and the member counts as late); `mode % 16 == 1` reveals with a wrong salt. Moves the clock to the
    /// start of the reveal window when it is still in the commit window. Prefers a member that has a commit.
    function reveal(uint256 seed, uint256 mode) external {
        _hit("reveal");
        uint32 k = circle.currentRound();
        uint256 i = bound(seed, 0, N - 1);
        for (uint256 t = 0; t < N; t++) {
            uint256 j = (i + t) % N;
            if (_bids[k][j].exists && !_bids[k][j].revealed) {
                i = j;
                break;
            }
        }
        BidRec memory rec = _bids[k][i];
        if (!rec.exists || rec.revealed) return;
        if (mode % 4 == 0) {
            ghostSkippedReveals += 1;
            return;
        }
        if (_is(CircleState.Active)) {
            uint256 revealStart = circle.roundStart(k) + circle.params().commitWindow;
            if (_now() < revealStart) vm.warp(revealStart);
        }
        _doReveal(i, k, mode % 16 == 1 ? ~rec.salt : rec.salt);
    }

    /// @notice A whole bidding round in one call: at the start of the current round a random subset of members
    /// commits (bids from a small set so that ties happen, one in sixteen above the cap), the clock moves to the
    /// reveal window, most reveal, some skip on purpose or use a wrong salt. The clock stays inside the reveal window.
    function bidRound(uint256 seed) external {
        _hit("bidRound");
        if (!_is(CircleState.Active)) return;
        uint32 k = circle.currentRound();
        if (circle.roundInfo(k).settled) return;
        CircleParams memory p = circle.params();
        uint256 start = circle.roundStart(k);
        if (_now() < start) vm.warp(start);
        if (_now() >= start + p.commitWindow) return; // commit window already over
        uint256 maxB = _maxBid(k);
        uint256 live;
        for (uint256 i = 0; i < N; i++) {
            uint256 h = uint256(keccak256(abi.encode(seed, i, "commit")));
            if (h % 4 == 0) continue;
            uint256 bid = (h >> 8) % 16 == 0
                ? maxB + 1
                : ((h >> 12) % 2 == 0 ? ((h >> 16) % 4) * maxB / 3 : (h >> 16) % (maxB + 1));
            _doCommit(i, k, bid, keccak256(abi.encode(seed, i, "salt")));
            live++;
        }
        if (live == 0 || !_is(CircleState.Active)) return;
        vm.warp(start + p.commitWindow);
        for (uint256 i = 0; i < N; i++) {
            BidRec memory rec = _bids[k][i];
            if (!rec.exists || rec.revealed) continue;
            uint256 h = uint256(keccak256(abi.encode(seed, i, "reveal")));
            if (h % 5 == 0) {
                ghostSkippedReveals += 1;
                continue;
            }
            _doReveal(i, k, (h >> 8) % 16 == 0 ? ~rec.salt : rec.salt);
        }
    }

    // ================================================================== keeper: settle, advance, default, finalize

    struct Snap {
        bool[5] received;
        bool[5] defaulted;
    }

    function _snap() internal view returns (Snap memory s) {
        for (uint256 i = 0; i < N; i++) {
            MemberInfo memory mi = circle.memberInfo(members[i]);
            s.received[i] = mi.received;
            s.defaulted[i] = mi.defaulted;
        }
    }

    /// @dev `settleRound()` plus all the bookkeeping behind INV-02, 03, 04, 05, 06, 07 and 09.
    function _trySettle() internal returns (bool done) {
        bool wasPaused = _is(CircleState.Paused);
        uint32 k = circle.currentRound();
        uint256 dl = circle.deadline(k);
        bool already = circle.roundInfo(k).settled;
        uint256 maxB = _maxBid(k);
        uint256 payersK = _payersNow(k);
        uint256 roomK = HuiMath.commissionRoom(_statutory(k, payersK), payersK);
        // Liveness (M-01): Active, round k - 1 settled (`currentRound`), round k open and its deadline reached.
        bool due = _is(CircleState.Active) && !already && _now() >= dl && (k == 1 || circle.roundInfo(k - 1).settled);
        Snap memory pre = _snap();
        uint256 mark = usdc.recordCount();
        vm.recordLogs();
        try circle.settleRound() {
            done = true;
        } catch (bytes memory reason) {
            if (due) {
                if (ghostStuckSettle == 0) {
                    ghostStuckSettleSelector = _firstSelector(reason);
                    ghostStuckSettleRound = k;
                }
                ghostStuckSettle += 1;
            }
        }
        Vm.Log[] memory logs = vm.getRecordedLogs();
        if (!done) {
            _audit(mark, _none());
            return false;
        }
        if (wasPaused) ghostPausedBreach += 1;
        if (_now() < dl || already) ghostSettledBeforeDeadline += 1;
        ghostSettles += 1;
        ghostSettledAt[k] = _now();
        ghostPausedTotalAtSettle[k] = circle.pausedTotal();

        RoundInfo memory ri = circle.roundInfo(k);
        ghostWins[ri.winner] += 1;
        ghostPaidOut += ri.payout;
        ghostMaxBidAtSettle[k] = maxB;
        ghostPayersAtSettle[k] = payersK;
        ghostRoomAtSettle[k] = roomK;
        ghostFullH[ri.winner] = ri.holdback == HuiMath.holdbackFor(circle.params().alphaBps, N, k, C);
        ghostWinnerOf[k] = ri.winner;
        if (circle.params().mode == CircleMode.Fixed) _checkFixedOrder(k, ri, pre);

        uint256[6] memory allowed;
        for (uint256 i = 0; i < N; i++) {
            if (members[i] == ri.winner) continue;
            bool frozen = pre.defaulted[i] && !pre.received[i];
            allowed[i] = frozen ? 0 : (pre.received[i] ? C : C - ri.winningBid);
        }
        ghostPulledAtSettle[k] = _audit(mark, allowed);
        _parseSettle(k, logs);
    }

    /// @dev docs/03 section 6.4, Fixed: the winner of round k is the member with `joinIndex = k - 1` if it is alive;
    /// frozen members go to the back of the queue and the ones after them move up in the same relative order; with
    /// no live member left the frozen member with the smallest `joinIndex` wins. The bid is always 0.
    function _checkFixedOrder(uint32 k, RoundInfo memory ri, Snap memory pre) internal {
        address[5] memory byIndex;
        for (uint256 i = 0; i < N; i++) {
            MemberInfo memory mi = circle.memberInfo(members[i]);
            if (mi.joined) byIndex[mi.joinIndex] = members[i];
        }
        address expected;
        address firstFrozen;
        bool anyFrozen;
        for (uint256 j = 0; j < N; j++) {
            address m = byIndex[j];
            if (m == address(0)) continue;
            uint256 i = _idx(m);
            if (pre.received[i]) continue;
            if (pre.defaulted[i]) {
                anyFrozen = true;
                if (firstFrozen == address(0)) firstFrozen = m;
            } else if (expected == address(0)) {
                expected = m;
            }
        }
        if (expected == address(0)) expected = firstFrozen;
        ghostFixedExpected[k] = expected;
        ghostFixedFrozenAtSettle[k] = anyFrozen;
        ghostFixedChecked += 1;
        if (anyFrozen) ghostFixedFrozenRounds += 1;
        if (ri.winner != expected || ri.winningBid != 0) ghostFixedOrderBreak += 1;
        if (!anyFrozen && ri.winner != byIndex[k - 1]) ghostFixedStrictBreak += 1;
    }

    function _parseSettle(uint32 k, Vm.Log[] memory logs) internal {
        uint256 repaid;
        uint256 covered;
        uint256 uncovered;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != address(circle) || logs[i].topics.length == 0) continue;
            bytes32 t = logs[i].topics[0];
            if (t == IHuiCircle.DebtRepaid.selector) {
                (uint256 principal, uint256 fee) = abi.decode(logs[i].data, (uint256, uint256));
                repaid += principal + fee;
            } else if (t == IHuiCircle.ShortfallCovered.selector) {
                (uint8 source, uint256 amount) = abi.decode(logs[i].data, (uint8, uint256));
                if (source == 3) uncovered += amount;
                else covered += amount;
            } else if (t == IHuiCircle.ContributionShortfall.selector) {
                ghostAnyShortfall = true;
                ghostShortfallsAtSettle[k] += 1;
            } else if (t == IHuiCircle.FeePaid.selector) {
                uint256 amount = abi.decode(logs[i].data, (uint256));
                ghostFeePaidAtSettle[k] += amount;
                ghostFeePaidTotal += amount;
            }
        }
        ghostRepaidAtSettle[k] = repaid;
        ghostCoveredAtSettle[k] = covered;
        ghostUncoveredAtSettle[k] = uncovered;
    }

    /// @notice A keeper calls `settleRound()` as it is, at the current time (mostly reverts with `TooEarly`).
    function settle() external {
        _hit("settle");
        _trySettle();
    }

    /// @notice Warp to `deadline(k)` and settle; after round N warp past the grace period and call `finalize`. After a
    /// settlement, one call in three lets a member in debt rush to pay while the grace period is still open (the
    /// wallet is topped up first one time in two).
    function advanceRound(uint256 seed) external {
        _hit("advanceRound");
        if (!_is(CircleState.Active)) {
            _trySettle();
            return;
        }
        uint32 settled = circle.settledRounds();
        if (settled < N) {
            uint256 dl = circle.deadline(settled + 1);
            if (_now() < dl) vm.warp(dl);
            if (_trySettle() && seed % 3 == 0) {
                (bool found, uint256 j, uint32 q) = _findDebtor(seed / 3, false, true);
                if (found) {
                    if ((seed / 7) % 2 == 0) _topUp(j);
                    _doPayLate(j, q);
                }
            }
        } else {
            uint256 end = _graceEndOfLast() + 1;
            if (_now() < end) vm.warp(end);
            _tryFinalize();
        }
    }

    /// @notice Anyone marks a member in default; prefers a member that really has an expired shortfall.
    function markDefault(uint256 seed) external {
        _hit("markDefault");
        uint256 i = bound(seed, 0, N - 1);
        if (seed % 5 != 0) {
            for (uint256 t = 0; t < N; t++) {
                uint256 j = (i + t) % N;
                MemberInfo memory mi = circle.memberInfo(members[j]);
                if (mi.debt != 0 && !mi.defaulted) {
                    i = j;
                    break;
                }
            }
        }
        bool wasPaused = _is(CircleState.Paused);
        address m = members[i];
        uint256 mark = usdc.recordCount();
        bool ok;
        try circle.markDefault(m) {
            ok = true;
            ghostDefaults += 1;
            if (wasPaused) ghostPausedBreach += 1;
        } catch {}
        _audit(mark, _none());
        // The defaulter sometimes regrets at once and repays part of the debt (topped up two times out of three).
        if (ok && (seed / 5) % 3 == 0) {
            if ((seed / 15) % 3 != 0) _topUp(i);
            _doRepay(i, seed / 45);
        }
    }

    /// @dev End of the grace period of round N from the Handler's own records: settledAt + G + the time the circle
    /// was paused since (docs/03 section 6.8). 0 when the Handler never saw round N settle.
    function _graceEndOfLast() internal view returns (uint256) {
        uint32 n = uint32(N);
        if (ghostSettledAt[n] == 0) return 0;
        return ghostSettledAt[n] + circle.params().graceSeconds + (circle.pausedTotal() - ghostPausedTotalAtSettle[n]);
    }

    /// @dev `CircleFinalized` (fees paid from escrow, reserve distributed) and the `ReserveShared` events (ADR-24).
    function _parseFinalize(Vm.Log[] memory logs) internal {
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != address(circle) || logs[i].topics.length == 0) continue;
            bytes32 t = logs[i].topics[0];
            if (t == IHuiCircle.CircleFinalized.selector) {
                (, uint256 fees, uint256 distributed) = abi.decode(logs[i].data, (uint256, uint256, uint256));
                ghostFinalizeFees = fees;
                ghostReserveDistributed = distributed;
            } else if (t == IHuiCircle.ReserveShared.selector) {
                address m = address(uint160(uint256(logs[i].topics[1])));
                (uint256 amount, uint16 weight) = abi.decode(logs[i].data, (uint256, uint16));
                ghostReserveShare[m] += amount;
                ghostReserveWeight[m] = weight;
                ghostReserveSharedSum += amount;
                ghostReserveSharedCount += 1;
            }
        }
    }

    function _tryFinalize() internal {
        bool wasPaused = _is(CircleState.Paused);
        // Liveness (M-01): Active, all N rounds settled and strictly past the grace period of round N: docs/03
        // section 5.3 has no other condition, so `finalize` must not revert (it marks expired debtors itself).
        uint256 graceEnd = _graceEndOfLast();
        bool due = _is(CircleState.Active) && circle.settledRounds() == N && graceEnd != 0 && _now() > graceEnd;
        uint256 mark = usdc.recordCount();
        vm.recordLogs();
        try circle.finalize() {
            ghostFinalized = true;
            if (wasPaused) ghostPausedBreach += 1;
            _parseFinalize(vm.getRecordedLogs());
        } catch (bytes memory reason) {
            if (due) {
                if (ghostStuckFinalize == 0) ghostStuckFinalizeSelector = _firstSelector(reason);
                ghostStuckFinalize += 1;
            }
        }
        _audit(mark, _none());
    }

    /// @notice A keeper calls `finalize()` as it is.
    function finalize() external {
        _hit("finalize");
        _tryFinalize();
    }

    // ================================================================== members in trouble

    /// @dev The first member from `from` on with an open shortfall (and, with `needDefault`, already defaulted), and
    /// its oldest (or, with `newestFirst`, newest) round with one. `found = false` when nobody qualifies.
    function _findDebtor(uint256 from, bool needDefault, bool newestFirst)
        internal
        view
        returns (bool found, uint256 i, uint32 r)
    {
        uint32 m = circle.settledRounds();
        for (uint256 t = 0; t < N; t++) {
            uint256 j = (from + t) % N;
            if (needDefault && !circle.memberInfo(members[j]).defaulted) continue;
            for (uint32 u = 1; u <= m; u++) {
                uint32 q = newestFirst ? m + 1 - u : u;
                Shortfall memory sf = circle.shortfallOf(q, members[j]);
                if (sf.amount != 0 && !sf.resolved) return (true, j, q);
            }
        }
        return (false, 0, 0);
    }

    /// @dev Gives member `i` plenty of USDC and an unlimited allowance, so it is able to pay what it owes.
    function _topUp(uint256 i) internal {
        address m = members[i];
        if (usdc.balanceOf(m) < 2000e6) usdc.mint(m, 5000e6);
        address spender = address(circle);
        vm.prank(m);
        usdc.approve(spender, type(uint256).max);
    }

    /// @dev `payLate(r)` as member `i` with the INV-04 allowance: open principal plus the late fee of today.
    function _doPayLate(uint256 i, uint32 r) internal {
        address who = members[i];
        Shortfall memory sf = circle.shortfallOf(r, who);
        uint256[6] memory allowed;
        if (sf.amount != 0 && !sf.resolved) {
            allowed[i] =
                uint256(sf.uncovered) + sf.fromReserve + sf.fromBond + sf.fromHoldback + circle.lateFeeOf(who, r);
        }
        bool wasPaused = _is(CircleState.Paused);
        uint256 mark = usdc.recordCount();
        bool ok = _callAs(i, abi.encodeCall(circle.payLate, (r)));
        _audit(mark, allowed);
        if (!ok) return;
        if (wasPaused) ghostPausedBreach += 1;
        ghostAnyLate = true;
        ghostLatePaid += 1;
    }

    /// @notice A member pays a late shortfall inside the grace period (principal + late fee); one call in two tops
    /// the wallet up first.
    function payLate(uint256 seed, uint256 roundSeed) external {
        _hit("payLate");
        uint32 m = circle.settledRounds();
        if (m == 0) return;
        uint256 i = bound(seed, 0, N - 1);
        uint32 r = uint32(bound(roundSeed, 1, m));
        if (seed % 5 != 0) {
            (bool found, uint256 j, uint32 q) = _findDebtor(i, false, true);
            if (found) (i, r) = (j, q);
        }
        if (roundSeed % 2 == 0) _topUp(i);
        _doPayLate(i, r);
    }

    /// @dev `repayDebt(a)` as member `i` (`a` bounded to its debt; 1 when it has none) with the INV-04 allowance.
    function _doRepay(uint256 i, uint256 amount) internal {
        address who = members[i];
        uint256 debt = circle.memberInfo(who).debt;
        uint256 a = debt == 0 ? 1 : bound(amount, 1, debt);
        // Upper bound of the late fee: the whole amount at the age of the oldest open shortfall. A sum of rounded
        // down per-part fees never exceeds the rounded down fee of the sum.
        uint256 oldest;
        uint32 m = circle.settledRounds();
        for (uint32 q = 1; q <= m; q++) {
            Shortfall memory sf = circle.shortfallOf(q, who);
            if (sf.amount != 0 && !sf.resolved) {
                oldest = _now() - sf.since;
                break;
            }
        }
        uint256[6] memory allowed;
        allowed[i] = a
            + HuiMath.lateFee(
                a, circle.lateRateBps(), oldest, circle.params().periodSeconds, circle.params().roundDuration
            );
        bool wasPaused = _is(CircleState.Paused);
        uint256 mark = usdc.recordCount();
        bool ok = _callAs(i, abi.encodeCall(circle.repayDebt, (a)));
        _audit(mark, allowed);
        if (!ok) return;
        if (wasPaused) ghostPausedBreach += 1;
        ghostRepaid += 1;
    }

    /// @notice A defaulted member repays part or all of its debt (principal plus late fee).
    function repayDebt(uint256 seed, uint256 amount) external {
        _hit("repayDebt");
        uint256 i = bound(seed, 0, N - 1);
        if (seed % 5 != 0) {
            (bool found, uint256 j,) = _findDebtor(i, true, false);
            if (found && amount % 2 == 0) _topUp(j);
            if (found) i = j;
        }
        _doRepay(i, amount);
    }

    /// @notice A member (or the organizer) claims a deferred payment.
    function claim(uint256 seed) external {
        _hit("claim");
        uint256 i = bound(seed, 0, N);
        bool ok;
        uint256 mark = usdc.recordCount();
        if (i == ORG) {
            vm.prank(organizer);
            try circle.claim() {
                ok = true;
            } catch {}
        } else {
            ok = _callAs(i, abi.encodeCall(circle.claim, ()));
        }
        ok; // silence: the outcome does not matter here, the recipient audit does
        _audit(mark, _none());
    }

    /// @notice The member's wallet is emptied (USDC goes to a sink), so its next pull fails.
    function drainWallet(uint256 seed) external {
        _hit("drainWallet");
        address m = members[bound(seed, 0, N - 1)];
        uint256 bal = usdc.balanceOf(m);
        if (bal == 0) return;
        vm.prank(m);
        try usdc.transfer(sink, bal) {} catch {}
    }

    /// @notice The member revokes the allowance of the circle.
    function revokeAllowance(uint256 seed) external {
        _hit("revokeAllowance");
        address m = members[bound(seed, 0, N - 1)];
        address spender = address(circle);
        vm.prank(m);
        usdc.approve(spender, 0);
    }

    /// @notice The member gets USDC back and approves the circle again, so it can pay late or repay.
    function refund(uint256 seed, uint256 amount) external {
        _hit("refund");
        address m = members[bound(seed, 0, N - 1)];
        usdc.mint(m, bound(amount, 1, 5000e6));
        address spender = address(circle);
        vm.prank(m);
        usdc.approve(spender, type(uint256).max);
    }

    /// @notice The issuer blocks or unblocks a member or the organizer (payments to it become `claimable`).
    function toggleBlacklist(uint256 seed) external {
        _hit("toggleBlacklist");
        address a = _addr(bound(seed, 0, N));
        usdc.setBlacklisted(a, !usdc.isBlacklisted(a));
    }

    /// @notice docs/03 section 7.3, bounded form used by HuiInvariantsFullCoverage: once, and only after some
    /// members already received, a non-empty subset of the receivers stops paying (allowance revoked). Members that
    /// have not received never stop; later receivers keep paying. All stopping happens in this one call.
    function stopReceivers(uint256 seed) external {
        _hit("stopReceivers");
        if (ghostStoppedReceivers) return;
        address[] memory got = new address[](N);
        uint256 count;
        for (uint256 i = 0; i < N; i++) {
            if (circle.memberInfo(members[i]).received) got[count++] = members[i];
        }
        if (count == 0) return;
        uint256 mask = bound(seed, 1, (1 << count) - 1);
        address spender = address(circle);
        for (uint256 b = 0; b < count; b++) {
            if ((mask >> b) & 1 == 0) continue;
            vm.prank(got[b]);
            usdc.approve(spender, 0);
        }
        ghostStoppedReceivers = true;
    }

    // ================================================================== admin through the factory

    /// @notice The admin pauses the circle (one call in three).
    function pauseCircle(uint256 seed) external {
        _hit("pause");
        if (seed % 3 != 0) return;
        vm.prank(admin);
        try factory.pauseCircle(address(circle)) {
            ghostPauseStart = _now();
        } catch {}
    }

    /// @notice The admin unpauses (one call in two); the schedule must shift by exactly the paused time (INV-09).
    function unpauseCircle(uint256 seed) external {
        _hit("unpause");
        if (seed % 2 != 0 || !_is(CircleState.Paused)) return;
        uint32 k = circle.currentRound();
        bool open = !circle.roundInfo(k).settled;
        uint256 before = circle.roundStart(k);
        uint256 pausedFor = _now() - ghostPauseStart;
        vm.prank(admin);
        try factory.unpauseCircle(address(circle)) {
            if (open && circle.roundStart(k) != before + pausedFor) ghostScheduleBreak += 1;
            ghostPauseStart = 0;
        } catch {}
    }

    /// @notice The admin tries an emergency unwind: too early it must fail; after 48 hours of pause it works.
    function unwind(uint256 seed) external {
        _hit("unwind");
        if (!_is(CircleState.Paused)) return;
        uint256 minAt = ghostPauseStart + 48 hours;
        bool late = seed % 4 == 0;
        if (late && _now() < minAt) vm.warp(minAt);
        bool tooEarly = _now() < minAt;
        uint256 mark = usdc.recordCount();
        vm.prank(admin);
        try factory.unwindCircle(address(circle)) {
            if (tooEarly) ghostUnauthorizedSuccess += 1;
            ghostUnwound = true;
        } catch {}
        _audit(mark, _none());
    }

    // ================================================================== attacker

    /// @notice The attacker calls privileged functions of the circle, the factory or the implementation without the
    /// right to. Any success counts in `ghostUnauthorizedSuccess`.
    function attackPrivileged(uint256 sel) external {
        _hit("attackPrivileged");
        uint256 s = bound(sel, 0, 13);
        address target = address(circle);
        bytes memory data;
        if (s == 0) {
            data = abi.encodeCall(circle.initialize, (attacker, circle.params(), factory.config()));
        } else if (s == 1) {
            data = abi.encodeCall(circle.pause, ());
        } else if (s == 2) {
            data = abi.encodeCall(circle.unpause, ());
        } else if (s == 3) {
            data = abi.encodeCall(circle.emergencyUnwind, ());
        } else if (s == 4) {
            data = abi.encodeCall(circle.withdrawBond, ());
        } else if (s == 5) {
            data = abi.encodeCall(circle.depositBond, (1e6, PermitSig(0, 0, 0, bytes32(0), bytes32(0))));
        } else if (s == 6) {
            data = abi.encodeCall(circle.activate, ());
        } else if (s == 7) {
            target = address(factory);
            data = abi.encodeCall(factory.pauseCircle, (address(circle)));
        } else if (s == 8) {
            target = address(factory);
            data = abi.encodeCall(factory.unpauseCircle, (address(circle)));
        } else if (s == 9) {
            target = address(factory);
            data = abi.encodeCall(factory.unwindCircle, (address(circle)));
        } else if (s == 10) {
            target = address(factory);
            data = abi.encodeCall(factory.setConfig, (factory.config()));
        } else if (s == 11) {
            target = address(factory);
            data = abi.encodeCall(factory.onActivated, (attacker));
        } else if (s == 12) {
            target = address(factory);
            data = abi.encodeCall(factory.onFinished, (attacker));
        } else {
            target = implementation;
            data = abi.encodeCall(circle.initialize, (attacker, circle.params(), factory.config()));
        }
        uint256 mark = usdc.recordCount();
        vm.prank(attacker);
        (bool ok,) = target.call(data);
        if (ok) ghostUnauthorizedSuccess += 1;
        _audit(mark, _none());
    }

    /// @notice The attacker submits an ERC-2771 request claiming to be a member: signed with its own key (`kind` 0)
    /// or carrying data the member never signed (`kind` 1). Neither may verify or execute.
    function attackForgedRequest(uint256 seed, uint256 kind) external {
        _hit("attackForgedRequest");
        uint256 i = bound(seed, 0, N - 1);
        ERC2771Forwarder.ForwardRequestData memory req = ERC2771Forwarder.ForwardRequestData({
            from: members[i],
            to: address(circle),
            value: 0,
            gas: 500_000,
            deadline: uint48(_now() + 1 hours),
            data: abi.encodeCall(circle.claim, ()),
            signature: ""
        });
        uint256 key = kind % 2 == 0 ? _attackerKey : _keys[i];
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, _forwardDigest(req));
        req.signature = abi.encodePacked(r, s, v);
        if (kind % 2 == 1) req.data = abi.encodeCall(circle.repayDebt, (1)); // tampered after signing
        uint256 mark = usdc.recordCount();
        if (forwarder.verify(req)) ghostUnauthorizedSuccess += 1;
        vm.prank(attacker);
        try forwarder.execute(req) {
            ghostUnauthorizedSuccess += 1;
        } catch {}
        _audit(mark, _none());
    }

    /// @notice The attacker calls the circle directly with a member's address appended to the calldata, as the
    /// forwarder would: a non-trusted caller must not be able to impersonate anyone.
    function attackSpoofSender(uint256 seed, uint256 which) external {
        _hit("attackSpoofSender");
        address victim = members[bound(seed, 0, N - 1)];
        uint256 w = bound(which, 0, 3);
        bytes memory data;
        if (w == 0) {
            data = abi.encodeCall(circle.claim, ());
        } else if (w == 1) {
            data = abi.encodeCall(circle.repayDebt, (1));
        } else if (w == 2) {
            data = abi.encodeCall(circle.payLate, (1));
        } else {
            data = abi.encodeCall(circle.commitBid, (bytes32(uint256(1))));
        }
        uint256 mark = usdc.recordCount();
        address target = address(circle);
        vm.prank(attacker);
        (bool ok,) = target.call(abi.encodePacked(data, victim));
        if (ok) ghostUnauthorizedSuccess += 1;
        _audit(mark, _none());
    }

    /// @notice The attacker tries `multicall(bytes[])` on the circle and the factory (ADR-06: there must be none).
    function attackMulticall() external {
        _hit("attackMulticall");
        bytes memory data = abi.encodeWithSignature("multicall(bytes[])", new bytes[](0));
        vm.prank(attacker);
        (bool ok1,) = address(circle).call(data);
        vm.prank(attacker);
        (bool ok2,) = address(factory).call(data);
        if (ok1 || ok2) ghostUnauthorizedSuccess += 1;
    }

    // ================================================================== Forming phase (used by the Forming variant)

    function _attestationSig(MemberAttestation memory att) internal view returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("HuiSafe"),
                keccak256("1"),
                block.chainid,
                att.circle
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("MemberAttestation(address member,address circle,bytes32 attestationId,uint64 expiry)"),
                att.member,
                att.circle,
                att.attestationId,
                att.expiry
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(_attesterKey, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _permitSig(uint256 i, uint256 value) internal view returns (PermitSig memory sig) {
        uint256 deadline = _now() + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                members[i],
                address(circle),
                value,
                usdc.nonces(members[i]),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(_keys[i], digest);
        sig = PermitSig({value: value, deadline: deadline, v: v, r: r, s: s});
    }

    /// @notice A member joins with an attester signature and a permit (also tries to re-join after leaving).
    function joinCircle(uint256 seed) external {
        _hit("join");
        if (!_is(CircleState.Forming)) return;
        uint256 i = bound(seed, 0, N - 1);
        if (seed % 4 != 0) {
            // Usually pick a member that can still join; one call in four may hit AlreadyMember or AlreadyLeft.
            for (uint256 t = 0; t < N; t++) {
                uint256 j = (i + t) % N;
                if (!circle.memberInfo(members[j]).joined && !circle.hasLeft(members[j])) {
                    i = j;
                    break;
                }
            }
        }
        address m = members[i];
        if (usdc.balanceOf(m) < 10_000e6) usdc.mint(m, 10_000e6);
        MemberAttestation memory att = MemberAttestation({
            member: m,
            circle: address(circle),
            attestationId: keccak256(abi.encode("attestation", m, address(circle))),
            expiry: uint64(_now() + 1 hours)
        });
        bytes memory sig = _attestationSig(att);
        PermitSig memory permit = _permitSig(i, circle.requiredAllowance());
        vm.prank(m);
        try circle.join(att, sig, permit) {
            address spender = address(circle);
            vm.prank(m);
            usdc.approve(spender, type(uint256).max);
        } catch {}
    }

    /// @notice A member leaves before activation (one call in six: a member that left can never join this circle
    /// again, and with N = 5 actors that ends any chance to fill it).
    function leaveCircle(uint256 seed) external {
        _hit("leave");
        if (seed % 6 != 0) return;
        address m = members[bound(seed, 0, N - 1)];
        vm.prank(m);
        try circle.leave() {} catch {}
    }

    /// @notice The organizer adds bond (up to 400 USDC at a time) while Forming.
    function depositMore(uint256 amount) external {
        _hit("depositBond");
        uint256 a = bound(amount, 1, 400e6);
        usdc.mint(organizer, a);
        address spender = address(circle);
        vm.prank(organizer);
        usdc.approve(spender, a);
        uint256[6] memory allowed;
        allowed[ORG] = a;
        uint256 mark = usdc.recordCount();
        PermitSig memory none = PermitSig(0, 0, 0, bytes32(0), bytes32(0));
        vm.prank(organizer);
        try circle.depositBond(a, none) {} catch {}
        _audit(mark, allowed);
    }

    /// @notice The organizer activates the circle.
    function activateCircle() external {
        _hit("activate");
        vm.prank(organizer);
        try circle.activate() {} catch {}
    }

    /// @notice One call in 64: warp past `joinDeadline` and cancel the circle if it is still Forming.
    function cancelCircle(uint256 seed) external {
        _hit("cancel");
        if (seed % 64 != 0 || !_is(CircleState.Forming)) return;
        uint256 dl = uint256(circle.params().joinDeadline) + 1;
        if (_now() < dl) vm.warp(dl);
        try circle.cancel() {} catch {}
    }

    /// @notice The organizer takes the bond back from a cancelled circle.
    function withdrawBondAction() external {
        _hit("withdrawBond");
        uint256 mark = usdc.recordCount();
        vm.prank(organizer);
        try circle.withdrawBond() {} catch {}
        _audit(mark, _none());
    }
}
