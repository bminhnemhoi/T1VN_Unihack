// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IHuiCircle} from "./interfaces/IHuiCircle.sol";
import {IHuiFactory} from "./interfaces/IHuiFactory.sol";
import {IReputationRegistry, Reputation} from "./interfaces/IReputationRegistry.sol";
import {IUSDCPermit} from "./interfaces/IUSDCPermit.sol";
import {HuiMath} from "./libraries/HuiMath.sol";
import {
    Commit,
    CircleParams,
    CircleState,
    FactoryConfig,
    MemberAttestation,
    MemberInfo,
    PermitSig,
    RoundInfo,
    RoundPhase
} from "./libraries/HuiTypes.sol";

/// @title HuiCircle
/// @notice One rotating-savings circle. This version carries the Forming flow (task C4: bond, join, leave, activate,
/// cancel) and the sealed-bid flow with deterministic winner selection (task C5: commit, reveal). `settleRound`, late
/// payment, default, finalize and emergency functions are added by tasks C6-C7 (docs/03 sections 5-6).
/// @dev Deployed once as an implementation; every circle is an EIP-1167 clone of it. The forwarder is an immutable of
/// the implementation (ERC2771Context), so every clone shares it. Use `_msgSender()`, never `msg.sender`. No Multicall.
/// Events and errors are those declared in `IHuiCircle`; this contract does not inherit the interface yet because it
/// does not implement all of it (C6-C7 will).
contract HuiCircle is ERC2771Context, EIP712, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 private constant _ATTESTATION_TYPEHASH =
        keccak256("MemberAttestation(address member,address circle,bytes32 attestationId,uint64 expiry)");

    // ------------------------------------------------------------------ storage (docs/05 section 2.1, partial)
    IHuiFactory public factory;
    address public organizer;
    IERC20 public usdc;
    address public reputation;
    address public attester;
    uint16 public lateRateBps; // copied from the factory config at initialize
    uint16 public minCoverageBps;

    CircleParams internal _params;
    CircleState public state;
    uint64 public startTime;
    uint64 public pausedTotal;
    uint32 public settledRounds; // number of rounds already paid out

    address[] internal _members; // by joinIndex
    mapping(address => MemberInfo) internal _info;
    mapping(uint32 => RoundInfo) internal _rounds;
    mapping(uint32 => mapping(address => Commit)) internal _commits;
    mapping(uint32 => address) internal _leader; // best valid revealed bid so far, per round
    mapping(uint32 => uint32) internal _commitCounter;
    mapping(bytes32 => bool) public usedAttestation;

    uint256 public bondDeposited;
    uint256 public bondRemaining;
    uint256 public reserve;
    uint256 public revealBondsHeld;
    mapping(address => uint256) public claimable;
    uint256 public totalClaimable;

    /// @param forwarder_ ERC-2771 trusted forwarder shared by all clones.
    constructor(address forwarder_) ERC2771Context(forwarder_) EIP712("HuiSafe", "1") {
        _disableInitializers();
    }

    modifier onlyOrganizer() {
        if (_msgSender() != organizer) revert IHuiCircle.NotOrganizer();
        _;
    }

    /// @notice Initialize a freshly cloned circle. Callable exactly once; the caller becomes the recorded factory.
    /// @dev The factory clones and initializes in the same transaction, so nobody else can front-run this call.
    /// @param organizer_ The circle organizer (the factory passes its `_msgSender()`).
    /// @param p Creation parameters, already validated by the factory.
    /// @param cfg Factory configuration snapshot at creation time.
    function initialize(address organizer_, CircleParams calldata p, FactoryConfig calldata cfg) external initializer {
        factory = IHuiFactory(_msgSender());
        organizer = organizer_;
        usdc = IERC20(cfg.usdc);
        reputation = cfg.reputation;
        attester = cfg.attester;
        lateRateBps = cfg.lateRateBps;
        minCoverageBps = cfg.minCoverageBps;
        _params = p;
        state = CircleState.Forming;
    }

    // ================================================================== Forming (docs/03 section 5.1)

    /// @notice Organizer deposits (more) bond while the circle is Forming. May be called several times.
    /// @dev Pulls USDC with `transferFrom`; a permit signed for `permit.value` is tried first and a failing permit
    /// (already used, expired, or none supplied) is ignored, in which case the existing allowance must suffice.
    /// @param amount Bond to add, in USDC base units.
    /// @param permit Optional EIP-2612 signature by the organizer for this circle.
    function depositBond(uint256 amount, PermitSig calldata permit) external nonReentrant onlyOrganizer {
        _requireState(CircleState.Forming);
        address from = _msgSender();
        _tryPermit(from, permit.value, permit);
        bondDeposited += amount;
        bondRemaining += amount;
        emit IHuiCircle.BondDeposited(from, amount, bondDeposited);
        usdc.safeTransferFrom(from, address(this), amount);
    }

    /// @notice Organizer takes back the whole bond of a Cancelled circle.
    function withdrawBond() external nonReentrant onlyOrganizer {
        _requireState(CircleState.Cancelled);
        uint256 amount = bondRemaining;
        if (amount == 0) revert IHuiCircle.NothingToWithdraw();
        bondRemaining = 0;
        emit IHuiCircle.BondWithdrawn(_msgSender(), amount);
        _pay(_msgSender(), amount);
    }

    /// @notice Join the circle with an attester-signed `MemberAttestation` and an EIP-2612 permit for the allowance.
    /// @dev Checks, in order: attestation member and circle, expiry, attester signature, attestation not used, caller
    /// not already a member, circle not full. The permit (value = `requiredAllowance()`) runs inside `try`; if it
    /// reverts (for example front-run) the join still succeeds when the allowance is already enough.
    /// @param att The attestation (one wallet per person per circle).
    /// @param attSig The attester's EIP-712 signature over `att`.
    /// @param permit USDC permit signature by the caller, spender = this circle.
    function join(MemberAttestation calldata att, bytes calldata attSig, PermitSig calldata permit)
        external
        nonReentrant
    {
        _requireState(CircleState.Forming);
        address member = _msgSender();
        if (block.timestamp > _params.joinDeadline) revert IHuiCircle.JoinClosed();
        if (att.member != member || att.circle != address(this)) revert IHuiCircle.BadAttestation();
        if (att.expiry < block.timestamp) revert IHuiCircle.AttestationExpired();
        if (!_validAttesterSignature(att, attSig)) revert IHuiCircle.BadAttestation();
        if (usedAttestation[att.attestationId]) revert IHuiCircle.AttestationUsed();
        if (_info[member].joined) revert IHuiCircle.AlreadyMember();
        if (_members.length >= _params.memberCount) revert IHuiCircle.CircleFull();

        uint256 needed = requiredAllowance();
        _tryPermit(member, needed, permit);
        uint256 actual = usdc.allowance(member, address(this));
        if (actual < needed) revert IHuiCircle.InsufficientAllowance(needed, actual);

        usedAttestation[att.attestationId] = true;
        uint8 index = uint8(_members.length);
        _members.push(member);
        _info[member].joined = true;
        _info[member].joinIndex = index;
        emit IHuiCircle.MemberJoined(member, index, att.attestationId);
    }

    /// @notice Leave the circle before activation. Later members move up one slot keeping their relative order, so
    /// `joinIndex` stays contiguous from 0. The attestation stays used: the caller cannot rejoin this circle.
    function leave() external {
        _requireState(CircleState.Forming);
        address member = _msgSender();
        MemberInfo storage mi = _info[member];
        if (!mi.joined) revert IHuiCircle.NotMember();
        uint256 last = _members.length - 1;
        for (uint256 i = mi.joinIndex; i < last; i++) {
            address next = _members[i + 1];
            _members[i] = next;
            _info[next].joinIndex = uint8(i);
        }
        _members.pop();
        delete _info[member];
        emit IHuiCircle.MemberLeft(member);
    }

    /// @notice Organizer starts the circle: full, before `joinDeadline`, guaranteed coverage >= `minCoverageBps`.
    /// @dev Sets `startTime`, moves to Active and tells the factory (it counts active circles per organizer).
    function activate() external nonReentrant onlyOrganizer {
        _requireState(CircleState.Forming);
        if (block.timestamp > _params.joinDeadline) revert IHuiCircle.JoinClosed();
        if (_members.length != _params.memberCount) {
            revert IHuiCircle.CircleNotFull(uint8(_members.length), _params.memberCount);
        }
        uint256 coverage = guaranteedCoverageBps();
        if (coverage < minCoverageBps) revert IHuiCircle.CoverageTooLow(coverage, minCoverageBps);
        startTime = uint64(block.timestamp);
        state = CircleState.Active;
        emit IHuiCircle.CircleActivated(startTime, coverage);
        factory.onActivated(organizer);
    }

    /// @notice Anyone cancels a circle that is still Forming after `joinDeadline`; the organizer then withdraws the bond.
    function cancel() external {
        _requireState(CircleState.Forming);
        uint64 deadline_ = _params.joinDeadline;
        if (block.timestamp <= deadline_) revert IHuiCircle.TooEarly(deadline_ + 1);
        state = CircleState.Cancelled;
        emit IHuiCircle.CircleCancelled();
    }

    // ================================================================== Sealed bids (docs/03 sections 6.1-6.4)

    /// @notice Commit a sealed bid for the current round, inside its commit window.
    /// @dev `commitHash = keccak256(abi.encode(address(this), round, member, bid, salt))`. The first commit of a round
    /// pulls the reveal bond; committing again before the window closes overwrites the hash, keeps the bond and takes
    /// a new (later) `commitIndex`. Fixed circles have zero-length windows, so this always reverts there.
    /// @param commitHash The sealed bid.
    function commitBid(bytes32 commitHash) external nonReentrant {
        _requireState(CircleState.Active);
        address member = _msgSender();
        uint32 k = currentRound();
        if (_rounds[k].settled) revert IHuiCircle.RoundAlreadySettled();
        uint256 start = _roundStart(k);
        if (block.timestamp < start || block.timestamp >= start + _params.commitWindow) {
            revert IHuiCircle.NotInCommitWindow();
        }
        _requireEligible(member);

        Commit storage c = _commits[k][member];
        uint32 index = ++_commitCounter[k];
        uint256 bond;
        if (c.commitIndex == 0) {
            bond = revealBond();
            c.bondHeld = uint128(bond);
            revealBondsHeld += bond;
        }
        c.hash = commitHash;
        c.commitIndex = index;
        emit IHuiCircle.BidCommitted(k, member, commitHash, index);
        if (bond != 0) usdc.safeTransferFrom(member, address(this), bond);
    }

    /// @notice Open the sealed bid of the current round, inside its reveal window.
    /// @dev Reverts `BidTooHigh` if `bid > maxBid(k)` (which is always < C); the committer then never reveals and
    /// forfeits the bond at settlement. A valid reveal refunds the bond and updates the round leader by the order of
    /// docs/03 section 6.4: higher bid, then fewer late payments, then smaller `commitIndex`.
    /// @param bid The bid, in USDC base units, per live member.
    /// @param salt The secret used in the commit.
    function revealBid(uint256 bid, bytes32 salt) external nonReentrant {
        _requireState(CircleState.Active);
        address member = _msgSender();
        uint32 k = currentRound();
        if (_rounds[k].settled) revert IHuiCircle.RoundAlreadySettled();
        uint256 revealStart = _roundStart(k) + _params.commitWindow;
        if (block.timestamp < revealStart || block.timestamp >= revealStart + _params.revealWindow) {
            revert IHuiCircle.NotInRevealWindow();
        }
        Commit storage c = _commits[k][member];
        if (c.commitIndex == 0) revert IHuiCircle.NoCommit();
        if (c.revealed) revert IHuiCircle.AlreadyRevealed();
        if (keccak256(abi.encode(address(this), k, member, bid, salt)) != c.hash) revert IHuiCircle.CommitMismatch();
        _requireEligible(member);
        uint256 max = _maxBid(k);
        if (bid > max) revert IHuiCircle.BidTooHigh(bid, max);

        c.revealed = true;
        c.bid = uint128(bid);
        uint256 bond = c.bondHeld;
        c.bondHeld = 0;
        revealBondsHeld -= bond;
        address leader = _leader[k];
        if (leader == address(0) || _beats(k, member, leader)) _leader[k] = member;
        emit IHuiCircle.BidRevealed(k, member, bid);
        _pay(member, bond);
    }

    /// @notice Deterministic winner of round `k` (docs/03 section 6.4); no randomness anywhere.
    /// @dev Leader of the revealed bids if there is one. Otherwise (Fixed circles, nobody bid validly, or a single
    /// live member left) the live member with the smallest `joinIndex` wins with bid 0; if no live member is left,
    /// the frozen member with the smallest `joinIndex`. This matches Fixed order: members receive in `joinIndex`
    /// order, frozen ones pushed to the end. Returns (address(0), 0) only when everybody has already received; the
    /// caller (`settleRound`, C6) never asks in that state. A leader cannot become frozen between reveal and
    /// settlement: a shortfall only appears inside `settleRound`, and `commitBid`/`revealBid` need `debt == 0`.
    function _selectWinner(uint32 k) internal view returns (address winner, uint256 bid) {
        address leader = _leader[k];
        if (leader != address(0)) return (leader, _commits[k][leader].bid);
        address firstFrozen;
        uint256 n = _members.length;
        for (uint256 i = 0; i < n; i++) {
            address m = _members[i];
            MemberInfo storage mi = _info[m];
            if (mi.received) continue;
            if (!mi.defaulted) return (m, 0);
            if (firstFrozen == address(0)) firstFrozen = m;
        }
        return (firstFrozen, 0);
    }

    /// @dev True if `challenger` (just revealed) beats the current `leader`: higher bid, then fewer late payments
    /// (in this circle plus global ones in the registry), then earlier `commitIndex`. Total order: indexes differ.
    function _beats(uint32 k, address challenger, address leader) private view returns (bool) {
        Commit storage cc = _commits[k][challenger];
        Commit storage lc = _commits[k][leader];
        if (cc.bid != lc.bid) return cc.bid > lc.bid;
        uint256 lateC = _lateness(challenger);
        uint256 lateL = _lateness(leader);
        if (lateC != lateL) return lateC < lateL;
        return cc.commitIndex < lc.commitIndex;
    }

    /// @dev Late payments in this circle plus the global count in the ReputationRegistry. A registry that reverts
    /// counts as zero so it can never block a reveal.
    function _lateness(address m) private view returns (uint256) {
        uint256 local = _info[m].lateCount;
        try IReputationRegistry(reputation).reputationOf(m) returns (Reputation memory r) {
            return local + r.late;
        } catch {
            return local;
        }
    }

    /// @dev A member may bid when joined, still live (not received, not defaulted) and with no open shortfall.
    function _requireEligible(address m) private view {
        MemberInfo storage mi = _info[m];
        if (!mi.joined) revert IHuiCircle.NotMember();
        if (mi.received || mi.defaulted || mi.debt != 0) revert IHuiCircle.NotEligibleToBid();
    }

    /// @dev Number of live members (joined, not received, not defaulted). N <= 30 keeps the loop cheap.
    function _liveCount() internal view returns (uint256 count) {
        uint256 n = _members.length;
        for (uint256 i = 0; i < n; i++) {
            MemberInfo storage mi = _info[_members[i]];
            if (!mi.received && !mi.defaulted) count++;
        }
    }

    /// @dev Bid ceiling for round `k` with the current number of paying live members (live minus the winner).
    function _maxBid(uint32 k) private view returns (uint256) {
        uint256 live = _liveCount();
        uint256 payers = live > 0 ? live - 1 : 0;
        return
            HuiMath.maxBid(_params.capBps, _params.memberCount, k, _params.contribution, _params.periodSeconds, payers);
    }

    // ================================================================== Payouts

    /// @notice Pull a deferred payment recorded when a direct transfer failed (docs/03 section 6.7).
    function claim() external nonReentrant {
        address to = _msgSender();
        uint256 amount = claimable[to];
        if (amount == 0) revert IHuiCircle.NothingToClaim();
        claimable[to] = 0;
        totalClaimable -= amount;
        emit IHuiCircle.Claimed(to, amount);
        usdc.safeTransfer(to, amount);
    }

    /// @dev Safe payout (docs/03 section 6.7): try a direct transfer; if it fails (for example a blocked address),
    /// record it in `claimable` so one bad recipient never blocks the caller.
    function _pay(address to, uint256 amount) internal {
        if (amount == 0) return;
        try usdc.transfer(to, amount) returns (bool ok) {
            if (ok) return;
        } catch {}
        claimable[to] += amount;
        totalClaimable += amount;
        emit IHuiCircle.PaymentDeferred(to, amount);
    }

    // ================================================================== Helpers

    /// @dev Reverts `CircleIsPaused` while Paused, `WrongState` for any other state than `expected`.
    function _requireState(CircleState expected) private view {
        CircleState s = state;
        if (s == CircleState.Paused) revert IHuiCircle.CircleIsPaused();
        if (s != expected) revert IHuiCircle.WrongState(expected, s);
    }

    /// @dev EIP-2612 permit with this circle as spender, tolerated to fail (front-run, expired, none supplied).
    function _tryPermit(address owner, uint256 value, PermitSig calldata p) private {
        try IUSDCPermit(address(usdc)).permit(owner, address(this), value, p.deadline, p.v, p.r, p.s) {} catch {}
    }

    /// @dev Attester's EIP-712 signature over `att` (domain "HuiSafe" "1", verifyingContract = this clone).
    function _validAttesterSignature(MemberAttestation calldata att, bytes calldata sig) private view returns (bool) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(_ATTESTATION_TYPEHASH, att.member, att.circle, att.attestationId, att.expiry))
        );
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, sig);
        return err == ECDSA.RecoverError.NoError && signer == attester;
    }

    function _roundStart(uint32 k) private view returns (uint256) {
        return uint256(startTime) + uint256(k - 1) * _params.roundDuration + pausedTotal;
    }

    // ================================================================== Views

    /// @notice Creation parameters, immutable after `activate()` (docs/03 section 3.1).
    function params() external view returns (CircleParams memory) {
        return _params;
    }

    /// @notice Members in `joinIndex` order.
    function members() external view returns (address[] memory) {
        return _members;
    }

    /// @notice Bookkeeping of one member.
    function memberInfo(address m) external view returns (MemberInfo memory) {
        return _info[m];
    }

    /// @notice `settledRounds + 1`, capped at N.
    function currentRound() public view returns (uint32) {
        uint32 k = settledRounds + 1;
        return k > _params.memberCount ? _params.memberCount : k;
    }

    /// @notice Phase of the current round (`settledRounds + 1`) by time: NotStarted before activation or while the
    /// round has not opened yet (previous round settled early), Commit, Reveal, then AwaitingSettle once the reveal
    /// window ends. Done once the round is settled. While round k-1 is still unsettled the current round stays k-1,
    /// so after its reveal window this reports AwaitingSettle even if round k's commit window has already started.
    function phase() external view returns (RoundPhase) {
        CircleState s = state;
        if (s == CircleState.Completed) return RoundPhase.Done;
        if (s != CircleState.Active) return RoundPhase.NotStarted;
        uint32 k = currentRound();
        if (_rounds[k].settled) return RoundPhase.Done;
        uint256 start = _roundStart(k);
        if (block.timestamp < start) return RoundPhase.NotStarted;
        uint256 revealStart = start + _params.commitWindow;
        if (block.timestamp < revealStart) return RoundPhase.Commit;
        if (block.timestamp < revealStart + _params.revealWindow) return RoundPhase.Reveal;
        return RoundPhase.AwaitingSettle;
    }

    /// @notice Start of round `k` (1..N): `startTime + (k - 1) * roundDuration + pausedTotal`.
    function roundStart(uint32 k) external view returns (uint64) {
        return uint64(_roundStart(k));
    }

    /// @notice Earliest time `settleRound` may run for round `k`.
    function deadline(uint32 k) external view returns (uint64) {
        return uint64(_roundStart(k) + _params.roundDuration);
    }

    /// @notice Stored result of round `k` (empty until settled).
    function roundInfo(uint32 k) external view returns (RoundInfo memory) {
        return _rounds[k];
    }

    /// @notice Sealed bid state of member `m` in round `k`.
    function commitOf(uint32 k, address m) external view returns (Commit memory) {
        return _commits[k][m];
    }

    /// @notice Bid ceiling of round `k` for the current number of live members (docs/03 section 2.4).
    function maxBid(uint32 k) external view returns (uint256) {
        return _maxBid(k);
    }

    /// @notice O(k) = k * (N - k) * C.
    function exposure(uint32 k) external view returns (uint256) {
        return HuiMath.exposure(_params.memberCount, k, _params.contribution);
    }

    /// @notice O_max, the peak exposure.
    function maxExposure() public view returns (uint256) {
        return HuiMath.maxExposure(_params.memberCount, _params.contribution);
    }

    /// @notice Coverage index in bps using the current reserve.
    function coverageIndexBps() external view returns (uint256) {
        return
            HuiMath.coverageIndexBps(
                _params.alphaBps, bondRemaining, reserve, _params.memberCount, _params.contribution
            );
    }

    /// @notice Coverage index in bps with reserve = 0: the minimum guarantee shown before joining.
    function guaranteedCoverageBps() public view returns (uint256) {
        return HuiMath.coverageIndexBps(_params.alphaBps, bondRemaining, 0, _params.memberCount, _params.contribution);
    }

    /// @notice Allowance a member signs when joining: (N - 1) * (C + revealBond).
    function requiredAllowance() public view returns (uint256) {
        return (uint256(_params.memberCount) - 1) * (uint256(_params.contribution) + revealBond());
    }

    /// @notice Reveal bond: `revealBondBps` of C, rounded down.
    function revealBond() public view returns (uint256) {
        return HuiMath.bpsOf(_params.contribution, _params.revealBondBps);
    }
}
