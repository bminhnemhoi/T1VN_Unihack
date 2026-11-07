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
    CoverSource,
    FactoryConfig,
    MemberAttestation,
    MemberInfo,
    PermitSig,
    RoundInfo,
    RoundPhase,
    Shortfall
} from "./libraries/HuiTypes.sol";

/// @title HuiCircle
/// @notice One rotating-savings circle. This version carries the Forming flow (task C4: bond, join, leave, activate,
/// cancel), the sealed-bid flow (task C5: commit, reveal) and `settleRound` (task C6: winner selection, pulls, cover
/// cascade, payout). Late payment, default, finalize and emergency functions are added by task C7 (docs/03 sections
/// 5-6).
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
    mapping(uint32 => mapping(address => Shortfall)) internal _shortfalls; // round => debtor => record
    mapping(uint32 => uint32) internal _commitCounter;
    mapping(bytes32 => bool) public usedAttestation;
    mapping(address => bool) public hasLeft; // left while Forming: cannot rejoin this circle (docs/03 section 5.1)
    uint32 public liveCount; // members joined, not received, not defaulted; set at activate, kept by settleRound

    uint256 public bondDeposited;
    uint256 public bondRemaining;
    uint256 public reserve;
    uint256 public revealBondsHeld;
    uint256 public totalHoldback;
    mapping(uint32 => uint256) public feeEscrow;
    uint256 public totalFeeEscrow;
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
        if (hasLeft[member]) revert IHuiCircle.AlreadyLeft();
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
        hasLeft[member] = true;
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
        liveCount = _params.memberCount;
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
        // The last live member wins with bid 0 anyway (docs/03 section 6.1); a commit would only risk the bond.
        if (liveCount <= 1) revert IHuiCircle.NotEligibleToBid();

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
    /// forfeits the bond at settlement. A valid reveal refunds the bond. The winner is chosen at settlement from one
    /// snapshot (docs/03 section 6.4), so reveal order cannot matter.
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
        emit IHuiCircle.BidRevealed(k, member, bid);
        _pay(member, bond);
    }

    /// @notice Deterministic winner of round `k` (docs/03 section 6.4); no randomness anywhere.
    /// @dev Computed from one consistent snapshot of the revealed commits (nothing depends on reveal order): higher
    /// bid, then fewer late payments (`_lateness`), then smaller `commitIndex`. With no revealed bid (Fixed circles,
    /// nobody bid validly, or a single live member left) the live member with the smallest `joinIndex` wins with bid
    /// 0; if no live member is left, the frozen member with the smallest `joinIndex`. This matches Fixed order:
    /// members receive in `joinIndex` order, frozen ones pushed to the end. Returns (address(0), 0) only when
    /// everybody has already received; `settleRound` never asks in that state. A committer cannot become frozen
    /// between reveal and settlement: a shortfall only appears inside `settleRound`, and `commitBid`/`revealBid`
    /// need `debt == 0`.
    function _selectWinner(uint32 k) internal view returns (address winner, uint256 bid) {
        uint256 n = _members.length;
        if (_commitCounter[k] != 0) {
            uint256 winnerLate = type(uint256).max; // lazily read from the registry, only needed on ties
            for (uint256 i = 0; i < n; i++) {
                address m = _members[i];
                Commit storage c = _commits[k][m];
                if (!c.revealed) continue;
                if (winner == address(0) || c.bid > bid) {
                    winner = m;
                    bid = c.bid;
                    winnerLate = type(uint256).max;
                } else if (c.bid == bid) {
                    if (winnerLate == type(uint256).max) winnerLate = _lateness(winner);
                    uint256 late = _lateness(m);
                    if (late < winnerLate || (late == winnerLate && c.commitIndex < _commits[k][winner].commitIndex)) {
                        winner = m;
                        winnerLate = late;
                    }
                }
            }
            if (winner != address(0)) return (winner, bid);
        }
        address firstFrozen;
        for (uint256 i = 0; i < n; i++) {
            address m = _members[i];
            MemberInfo storage mi = _info[m];
            if (mi.received) continue;
            if (!mi.defaulted) return (m, 0);
            if (firstFrozen == address(0)) firstFrozen = m;
        }
        return (firstFrozen, 0);
    }

    /// @dev Late payments of `m` for the tie-break (docs/03 section 6.4): the registry's `late`, which already
    /// includes the late payments in this circle (they are recorded when they happen). Only if the registry call
    /// fails is the local counter used, so a broken registry can never block settlement.
    function _lateness(address m) private view returns (uint256) {
        try IReputationRegistry(reputation).reputationOf(m) returns (Reputation memory r) {
            return r.late;
        } catch {
            return _info[m].lateCount;
        }
    }

    /// @dev A member may bid when joined, still live (not received, not defaulted) and with no open shortfall.
    function _requireEligible(address m) private view {
        MemberInfo storage mi = _info[m];
        if (!mi.joined) revert IHuiCircle.NotMember();
        if (mi.received || mi.defaulted || mi.debt != 0) revert IHuiCircle.NotEligibleToBid();
    }

    /// @dev Bid ceiling for round `k` with the current number of paying live members (live minus the winner).
    function _maxBid(uint32 k) private view returns (uint256) {
        uint256 live = liveCount;
        uint256 payers = live > 0 ? live - 1 : 0;
        return
            HuiMath.maxBid(_params.capBps, _params.memberCount, k, _params.contribution, _params.periodSeconds, payers);
    }

    // ================================================================== settleRound (docs/03 sections 6.5-6.8)

    /// @dev Working totals of one `settleRound` call, kept in memory to stay under the stack limit.
    struct Settlement {
        uint32 k;
        address winner;
        uint256 bid;
        uint256 pot; // pulled contributions + amounts covered from holdback, bond and reserve
        uint256 uncovered; // shortfall nobody covered: the winner receives that much less
        uint256 fee;
        uint256 premium;
        uint256 holdback;
        uint256 payout;
    }

    /// @notice Pay out round `k = currentRound()` once `deadline(k)` has passed. Anyone may call it.
    /// @dev One transaction, `nonReentrant`, following docs/03 section 6.5: (1) unrevealed commits forfeit their bond
    /// to the reserve and count as late, then the winner is selected; (2-3) every other member's due is pulled with
    /// `transferFrom` inside `try`, frozen members are skipped and counted as a full shortfall; (4) each shortfall is
    /// covered by cascade holdback -> bond -> reserve -> uncovered and recorded per source; (5-6) pot, fee escrow and
    /// reserve premium; (7) holdback H of the winner; (8) payout through the safe payment path; (9) holdback release
    /// for dead members who paid on time; (10) round record, reputation and events. A winner with open shortfalls
    /// (a frozen member, or a live one whose grace expired before `markDefault`) first repays them from the pot in
    /// the refund order of section 6.8. Dust from rounding always lands in the winner's payout.
    function settleRound() external nonReentrant {
        _requireState(CircleState.Active);
        Settlement memory st;
        st.k = currentRound();
        uint32 k = st.k;
        if (_rounds[k].settled) revert IHuiCircle.RoundAlreadySettled();
        uint256 due_ = _roundStart(k) + _params.roundDuration;
        if (block.timestamp < due_) revert IHuiCircle.TooEarly(uint64(due_));

        if (_commitCounter[k] != 0) _forfeitUnrevealed(k);
        (st.winner, st.bid) = _selectWinner(k);

        _collect(st);
        _distribute(st);

        address w = st.winner;
        MemberInfo storage wi = _info[w];
        wi.received = true;
        wi.receivedRound = uint8(k);
        settledRounds = k;
        RoundInfo storage ri = _rounds[k];
        ri.winner = w;
        ri.winningBid = uint128(st.bid);
        ri.pot = uint128(st.pot);
        ri.payout = uint128(st.payout);
        ri.holdback = uint128(st.holdback);
        ri.fee = uint128(st.fee);
        ri.premium = uint128(st.premium);
        ri.uncovered = uint128(st.uncovered);
        ri.settledAt = uint64(block.timestamp);
        ri.commitCount = _commitCounter[k];
        ri.settled = true;

        emit IHuiCircle.RoundSettled(k, w, st.bid, st.pot, st.payout, st.holdback, st.fee, st.premium, st.uncovered);
        _pay(w, st.payout);
    }

    /// @dev Steps 6-8 of docs/03 section 6.5: fee escrow and reserve premium off the pot, the winner's own shortfalls
    /// (section 6.6/6.8), the holdback H (none for a Frozen winner) and the payout, which absorbs all rounding dust.
    function _distribute(Settlement memory st) private {
        address w = st.winner;
        MemberInfo storage wi = _info[w];
        st.fee = _params.commissionMode ? HuiMath.bpsOf(st.pot, _params.feeBps) : 0;
        st.premium = HuiMath.bpsOf(st.pot, _params.reserveBps);
        if (st.fee != 0) {
            feeEscrow[st.k] = st.fee;
            totalFeeEscrow += st.fee;
        }
        reserve += st.premium;

        uint256 avail = st.pot - st.fee - st.premium;
        if (wi.debt != 0) avail -= _repayFromPot(w, avail, st.k);
        if (!wi.defaulted) {
            // Not received yet, so defaulted would mean Frozen; a live winner is held back and leaves the live set.
            uint256 h = HuiMath.holdbackFor(_params.alphaBps, _params.memberCount, st.k, _params.contribution);
            if (h > avail) h = avail;
            if (h != 0) {
                wi.holdback += uint128(h);
                totalHoldback += h;
            }
            st.holdback = h;
            liveCount -= 1;
        }
        st.payout = avail - st.holdback;
    }

    /// @dev Steps 2-4 of docs/03 section 6.5 for every member except the winner: compute the due, pull it (or record a
    /// shortfall) and release holdback for dead members who paid on time. Adds to `st.pot` and `st.uncovered`.
    function _collect(Settlement memory st) private {
        uint256 c = _params.contribution;
        uint256 release = HuiMath.releasePerRound(_params.alphaBps, c);
        uint256 n = _members.length;
        for (uint256 i = 0; i < n; i++) {
            address m = _members[i];
            if (m == st.winner) continue;
            MemberInfo storage mi = _info[m];
            uint256 due = mi.received ? c : c - st.bid;
            if (mi.defaulted && !mi.received) {
                // Frozen: not pulled, counted as a full shortfall (docs/03 section 6.5 step 2).
                _shortfall(st, m, due, false);
            } else if (_pull(m, due)) {
                st.pot += due;
                emit IHuiCircle.ContributionPulled(st.k, m, due);
                if (!mi.defaulted) {
                    _record(m, IReputationRegistry.recordOnTime.selector);
                    if (mi.received && mi.holdback != 0) _release(m, st.k, mi, release);
                }
            } else {
                _shortfall(st, m, due, !mi.defaulted);
            }
        }
    }

    /// @dev `transferFrom` inside `try`: a revert or a `false` return is a shortfall, never a failed round. USDC is a
    /// trusted token that returns a bool, so SafeERC20 (which would revert) is deliberately not used here.
    function _pull(address from, uint256 amount) private returns (bool) {
        try usdc.transferFrom(from, address(this), amount) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    /// @dev Pay the per-round holdback release to a dead member who contributed on time (docs/03 section 6.5 step 9).
    function _release(address m, uint32 k, MemberInfo storage mi, uint256 amount) private {
        uint256 held = mi.holdback;
        if (amount > held) amount = held;
        mi.holdback = uint128(held - amount);
        totalHoldback -= amount;
        emit IHuiCircle.HoldbackReleased(m, k, amount);
        _pay(m, amount);
    }

    /// @dev Record a shortfall of `s` for `m` in round `st.k`, cover it by the cascade of docs/03 section 6.5 step 4
    /// (holdback of the debtor, then bond, then reserve; what is left is `uncovered`) and always add `s` to `debt`.
    /// `late` is false for members that are already defaulted, so they are not punished once per round.
    function _shortfall(Settlement memory st, address m, uint256 s, bool late) private {
        MemberInfo storage mi = _info[m];
        emit IHuiCircle.ContributionShortfall(st.k, m, s);
        uint256 left = s;
        uint256 fromHoldback = _min(left, mi.holdback);
        left -= fromHoldback;
        uint256 fromBond = _min(left, bondRemaining);
        left -= fromBond;
        uint256 fromReserve = _min(left, reserve);
        left -= fromReserve;

        if (fromHoldback != 0) {
            mi.holdback -= uint128(fromHoldback);
            totalHoldback -= fromHoldback;
            emit IHuiCircle.ShortfallCovered(st.k, m, CoverSource.Holdback, fromHoldback);
        }
        if (fromBond != 0) {
            bondRemaining -= fromBond;
            emit IHuiCircle.ShortfallCovered(st.k, m, CoverSource.Bond, fromBond);
        }
        if (fromReserve != 0) {
            reserve -= fromReserve;
            emit IHuiCircle.ShortfallCovered(st.k, m, CoverSource.Reserve, fromReserve);
        }
        if (left != 0) emit IHuiCircle.ShortfallCovered(st.k, m, CoverSource.Uncovered, left);

        _shortfalls[st.k][m] = Shortfall({
            amount: uint128(s),
            fromHoldback: uint128(fromHoldback),
            fromBond: uint128(fromBond),
            fromReserve: uint128(fromReserve),
            uncovered: uint128(left),
            since: uint64(block.timestamp),
            resolved: false
        });
        mi.debt += uint128(s);
        st.pot += s - left;
        st.uncovered += left;
        if (late) {
            mi.lateCount += 1;
            _record(m, IReputationRegistry.recordLate.selector);
        }
    }

    /// @dev Commits that were never opened (including bids above the cap, which cannot be revealed) lose their
    /// reveal bond to the reserve and count as one late payment (docs/03 section 6.5 step 1).
    function _forfeitUnrevealed(uint32 k) private {
        uint256 n = _members.length;
        for (uint256 i = 0; i < n; i++) {
            address m = _members[i];
            Commit storage c = _commits[k][m];
            uint256 bond = c.bondHeld;
            if (c.commitIndex == 0 || c.revealed || bond == 0) continue;
            c.bondHeld = 0;
            revealBondsHeld -= bond;
            reserve += bond;
            _info[m].lateCount += 1;
            emit IHuiCircle.RevealBondForfeited(k, m, bond);
            _record(m, IReputationRegistry.recordLate.selector);
        }
    }

    /// @dev docs/03 sections 6.6 and 6.8: spend up to `budget` of the winner's pot on the winner's own open
    /// shortfalls, oldest round first. Inside one shortfall the refund order is the reverse of the cascade: the
    /// `uncovered` part is paid straight to that round's winner, then reserve, bond and holdback are refilled.
    /// All principal comes first; late fees (docs/03 section 2.5, on the principal and the time it was owed) are
    /// taken from what is left and go to the reserve. Returns the total spent (principal + fees).
    function _repayFromPot(address debtor, uint256 budget, uint32 upToRound) internal returns (uint256 spent) {
        uint256 feeDue;
        uint256 principal;
        for (uint32 r = 1; r < upToRound && budget > 0; r++) {
            Shortfall storage sf = _shortfalls[r][debtor];
            if (sf.resolved || sf.amount == 0) continue;
            uint256 since = sf.since;
            uint256 p;
            uint256 f;
            (p, f) = _restorePart(r, debtor, CoverSource.Uncovered, sf.uncovered, budget, since);
            sf.uncovered -= uint128(p);
            budget -= p;
            principal += p;
            feeDue += f;
            (p, f) = _restorePart(r, debtor, CoverSource.Reserve, sf.fromReserve, budget, since);
            sf.fromReserve -= uint128(p);
            budget -= p;
            principal += p;
            feeDue += f;
            (p, f) = _restorePart(r, debtor, CoverSource.Bond, sf.fromBond, budget, since);
            sf.fromBond -= uint128(p);
            budget -= p;
            principal += p;
            feeDue += f;
            (p, f) = _restorePart(r, debtor, CoverSource.Holdback, sf.fromHoldback, budget, since);
            sf.fromHoldback -= uint128(p);
            budget -= p;
            principal += p;
            feeDue += f;
            if (sf.uncovered == 0 && sf.fromReserve == 0 && sf.fromBond == 0 && sf.fromHoldback == 0) {
                sf.resolved = true;
            }
        }
        _info[debtor].debt -= uint128(principal);
        uint256 fee = _min(feeDue, budget);
        reserve += fee;
        spent = principal + fee;
        emit IHuiCircle.DebtRepaid(debtor, principal, fee);
    }

    /// @dev Restore one source of one shortfall: `p = min(owed, budget)` goes to its destination. Returns `p` and the
    /// late fee that `p` owes for the time since the shortfall appeared.
    function _restorePart(uint32 r, address debtor, CoverSource source, uint256 owed, uint256 budget, uint256 since)
        private
        returns (uint256 p, uint256 f)
    {
        p = _min(owed, budget);
        if (p == 0) return (0, 0);
        f = HuiMath.lateFee(p, lateRateBps, block.timestamp - since, _params.periodSeconds, _params.roundDuration);
        if (source == CoverSource.Reserve) {
            reserve += p;
        } else if (source == CoverSource.Bond) {
            bondRemaining += p;
        } else if (source == CoverSource.Holdback) {
            _info[debtor].holdback += uint128(p);
            totalHoldback += p;
        }
        emit IHuiCircle.ShortfallRestored(r, debtor, source, p);
        if (source == CoverSource.Uncovered) _pay(_rounds[r].winner, p);
    }

    /// @dev Reputation writes never block a round: a failing registry is ignored. Only `recordOnTime` and
    /// `recordLate` are issued here, selected by `selector`.
    function _record(address m, bytes4 selector) private {
        if (selector == IReputationRegistry.recordOnTime.selector) {
            try IReputationRegistry(reputation).recordOnTime(m) {} catch {}
        } else {
            try IReputationRegistry(reputation).recordLate(m) {} catch {}
        }
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
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

    /// @dev docs/03 section 3.2: the nominal schedule, but never before round k-1 was actually settled, so a late
    /// settlement only delays round k and never removes its commit window.
    function _roundStart(uint32 k) private view returns (uint256) {
        uint256 nominal = uint256(startTime) + uint256(k - 1) * _params.roundDuration + pausedTotal;
        if (k >= 2) {
            uint256 prev = _rounds[k - 1].settledAt;
            if (prev > nominal) return prev;
        }
        return nominal;
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
    /// so after its reveal window this reports AwaitingSettle until it is settled (round k then starts at that moment).
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

    /// @notice Start of round `k` (1..N): `max(startTime + (k - 1) * roundDuration + pausedTotal, settledAt(k - 1))`.
    function roundStart(uint32 k) external view returns (uint64) {
        return uint64(_roundStart(k));
    }

    /// @notice Earliest time `settleRound` may run for round `k`: `roundStart(k) + roundDuration`.
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

    /// @notice Shortfall record of `m` in round `k` (empty if none).
    function shortfallOf(uint32 k, address m) external view returns (Shortfall memory) {
        return _shortfalls[k][m];
    }

    /// @notice What `m` owes into the pot of any round where a winning bid `bid` is paid: C for members who already
    /// received, C - bid for the others. Zero for non-members.
    function dueOf(address m, uint32, uint256 bid) external view returns (uint256) {
        MemberInfo storage mi = _info[m];
        if (!mi.joined) return 0;
        return mi.received ? _params.contribution : _params.contribution - bid;
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
