// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {HuiCircleBase} from "./HuiCircleBase.sol";
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
    Shortfall
} from "./libraries/HuiTypes.sol";

/// @title HuiCircle
/// @notice One rotating-savings circle: Forming flow (bond, join, leave, activate, cancel), sealed bids (commit,
/// reveal), `settleRound` (winner selection, pulls, cover cascade, payout) and, from task C7, late payment,
/// default, debt repayment, `finalize`, the factory-only pause / unpause / emergency unwind and `claim`
/// (docs/03 sections 5-6).
/// @dev Deployed once as an implementation; every circle is an EIP-1167 clone of it. The forwarder is an immutable of
/// the implementation (ERC2771Context), so every clone shares it. Use `_msgSender()`, never `msg.sender`. No Multicall.
/// Events and errors are those declared in `IHuiCircle`; this contract does not inherit the interface because it
/// serves part of it through the lens.
///
/// Size (EIP-170): the read-only functions of docs/05 section 3.2 (`HuiCircleViews`) live in the immutable
/// `HuiCircleLens`. Any call whose selector is not defined here falls into `fallback()` and is DELEGATECALLed to the
/// lens, so views read the circle's own storage and callers see one ABI. The lens contains only `view` functions
/// (storage layout shared through `HuiCircleBase`), so even a non-static call to the fallback cannot change state or
/// move funds. Plain ETH is rejected (no `receive`, `fallback` is not payable).
contract HuiCircle is HuiCircleBase {
    using SafeERC20 for IERC20;

    bytes32 private constant _ATTESTATION_TYPEHASH =
        keccak256("MemberAttestation(address member,address circle,bytes32 attestationId,uint64 expiry)");

    /// @notice The `HuiCircleLens` that serves the read-only functions (immutable, shared by all clones).
    address public immutable lens;

    /// @param forwarder_ ERC-2771 trusted forwarder shared by all clones.
    /// @param lens_ Deployed `HuiCircleLens`.
    constructor(address forwarder_, address lens_) HuiCircleBase(forwarder_) {
        lens = lens_;
        _disableInitializers();
    }

    /// @dev Serves every selector not defined on the circle (the views of `HuiCircleViews`) by delegating to `lens`.
    fallback() external {
        address target = lens;
        assembly ("memory-safe") {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    modifier onlyOrganizer() {
        if (_msgSender() != organizer) revert IHuiCircle.NotOrganizer();
        _;
    }

    modifier onlyFactory() {
        if (_msgSender() != address(factory)) revert IHuiCircle.NotFactory();
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

        // Effects before any external call (audit I-01): the round is closed before tokens move.
        address w = st.winner;
        MemberInfo storage wi = _info[w];
        wi.received = true;
        wi.receivedRound = uint8(k);
        settledRounds = k;
        _pausedAtSettle[k] = pausedTotal;
        RoundInfo storage ri = _rounds[k];
        ri.winner = w;
        ri.winningBid = uint128(st.bid);
        ri.settledAt = uint64(block.timestamp);
        ri.commitCount = _commitCounter[k];
        ri.settled = true;

        _collect(st);
        _distribute(st);

        ri.pot = uint128(st.pot);
        ri.payout = uint128(st.payout);
        ri.holdback = uint128(st.holdback);
        ri.fee = uint128(st.fee);
        ri.premium = uint128(st.premium);
        ri.uncovered = uint128(st.uncovered);

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
            if (c.commitIndex == 0 || c.revealed) continue;
            uint256 bond = c.bondHeld;
            _info[m].lateCount += 1;
            if (bond != 0) {
                c.bondHeld = 0;
                revealBondsHeld -= bond;
                reserve += bond;
                emit IHuiCircle.RevealBondForfeited(k, m, bond);
            }
            _record(m, IReputationRegistry.recordLate.selector);
        }
    }

    /// @dev docs/03 sections 6.6 and 6.8: spend up to `budget` of a pot (or of the debtor's own holdback at
    /// `finalize`) on the debtor's open shortfalls of rounds `< upToRound`, oldest first. All principal comes first;
    /// late fees (docs/03 section 2.5) are taken from what is left and go to the reserve; a fee the budget cannot
    /// cover is announced with `LateFeeUnpaid`, never stored. Returns the total spent (principal + fees).
    function _repayFromPot(address debtor, uint256 budget, uint32 upToRound) internal returns (uint256 spent) {
        (uint256 principal, uint256 feeDue) = _restoreAll(debtor, budget, upToRound);
        uint256 fee = _min(feeDue, budget - principal);
        reserve += fee;
        if (fee < feeDue) emit IHuiCircle.LateFeeUnpaid(debtor, feeDue - fee);
        emit IHuiCircle.DebtRepaid(debtor, principal, fee);
        return principal + fee;
    }

    /// @dev Restore up to `budget` principal across the open shortfalls of `debtor` in rounds `< upToRound`, oldest
    /// first, and lower `debt` by it. Returns the principal restored and the late fee it owes (not yet collected).
    function _restoreAll(address debtor, uint256 budget, uint32 upToRound)
        private
        returns (uint256 principal, uint256 feeDue)
    {
        for (uint32 r = 1; r < upToRound && budget > 0; r++) {
            (uint256 p, uint256 f) = _restoreRound(r, debtor, budget);
            budget -= p;
            principal += p;
            feeDue += f;
        }
        _info[debtor].debt -= uint128(principal);
    }

    /// @dev Restore up to `budget` of one shortfall in the refund order of docs/03 section 6.8 (reverse of the
    /// cascade): `uncovered` (paid straight to that round's winner), reserve, bond, holdback. Closes the record when
    /// every part is back to zero. Does NOT touch `debt`; callers do.
    function _restoreRound(uint32 r, address debtor, uint256 budget)
        private
        returns (uint256 principal, uint256 feeDue)
    {
        Shortfall storage sf = _shortfalls[r][debtor];
        if (sf.resolved || sf.amount == 0) return (0, 0);
        for (uint8 i = 4; i > 0 && budget > 0; i--) {
            CoverSource source = CoverSource(i - 1); // Uncovered(3), Reserve(2), Bond(1), Holdback(0)
            uint256 owed = _owed(sf, source);
            uint256 p = _min(owed, budget);
            if (p == 0) continue;
            _setOwed(sf, source, owed - p);
            budget -= p;
            principal += p;
            feeDue += _restorePart(r, debtor, source, p, sf.since);
        }
        if (sf.uncovered == 0 && sf.fromReserve == 0 && sf.fromBond == 0 && sf.fromHoldback == 0) sf.resolved = true;
    }

    /// @dev Send `p` of one source back to where the cascade took it from. Returns the late fee `p` owes for the
    /// time since the shortfall appeared.
    function _restorePart(uint32 r, address debtor, CoverSource source, uint256 p, uint256 since)
        private
        returns (uint256 f)
    {
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

    function _owed(Shortfall storage sf, CoverSource source) private view returns (uint256) {
        if (source == CoverSource.Uncovered) return sf.uncovered;
        if (source == CoverSource.Reserve) return sf.fromReserve;
        if (source == CoverSource.Bond) return sf.fromBond;
        return sf.fromHoldback;
    }

    function _setOwed(Shortfall storage sf, CoverSource source, uint256 v) private {
        if (source == CoverSource.Uncovered) sf.uncovered = uint128(v);
        else if (source == CoverSource.Reserve) sf.fromReserve = uint128(v);
        else if (source == CoverSource.Bond) sf.fromBond = uint128(v);
        else sf.fromHoldback = uint128(v);
    }

    /// @dev Reputation writes never block a round: the call is made with `selector` and its result, including a
    /// revert, is ignored (the registry is a trusted contract of the deployment). No return data is copied.
    function _record(address m, bytes4 selector) private {
        address reg = reputation;
        bytes memory data = abi.encodeWithSelector(selector, m);
        assembly ("memory-safe") {
            pop(call(gas(), reg, 0, add(data, 0x20), mload(data), 0, 0))
        }
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    // ================================================================== Late payment, default, repayment (docs/03 6.8)

    /// @notice Pay the whole open principal of your shortfall of `round` plus its late fee, inside the grace period.
    /// @dev Principal is pulled first, applied in the refund order of docs/03 section 6.8 (uncovered straight to the
    /// round winner, then reserve, bond, holdback), then the late fee is pulled and goes to the reserve. A member who
    /// had already received before `round` and is not defaulted gets the skipped `alpha * C` holdback release of
    /// that round back, which restores INV-06. The lateness was already recorded when the round settled.
    /// @param round The round whose shortfall is paid.
    function payLate(uint32 round) external nonReentrant {
        _requireState(CircleState.Active);
        address m = _msgSender();
        Shortfall storage sf = _shortfalls[round][m];
        if (sf.resolved || sf.amount == 0) revert IHuiCircle.NoShortfall();
        if (block.timestamp > _graceEnd(round)) revert IHuiCircle.GraceExpired();
        uint256 owed = uint256(sf.uncovered) + sf.fromReserve + sf.fromBond + sf.fromHoldback;
        usdc.safeTransferFrom(m, address(this), owed);
        (uint256 principal, uint256 fee) = _restoreRound(round, m, owed);
        MemberInfo storage mi = _info[m];
        mi.debt -= uint128(principal);
        if (fee != 0) {
            reserve += fee;
            usdc.safeTransferFrom(m, address(this), fee);
        }
        emit IHuiCircle.LatePaid(round, m, principal, fee);
        if (mi.received && !mi.defaulted && mi.receivedRound < round && mi.holdback != 0) {
            _release(m, round, mi, HuiMath.releasePerRound(_params.alphaBps, _params.contribution));
        }
    }

    /// @notice Mark `member` as defaulted once a shortfall is past its grace period. Anyone may call.
    /// @dev The oldest shortfall past `graceEnd` names the round `r`. A member who already received becomes
    /// DefaultedDead; one who has not becomes Frozen and leaves the live set. The fee escrow of round `r` moves to
    /// the reserve and the registry records the default.
    /// @param member The late member.
    function markDefault(address member) external nonReentrant {
        _requireState(CircleState.Active);
        MemberInfo storage mi = _info[member];
        if (!mi.joined) revert IHuiCircle.NotMember();
        if (mi.defaulted) revert IHuiCircle.AlreadyDefaulted();
        if (mi.debt == 0) revert IHuiCircle.NoShortfall();
        uint32 r = _expiredShortfall(member);
        if (r == 0) revert IHuiCircle.GraceNotOver();
        _default(member, mi, r);
    }

    /// @notice A defaulted member repays `amount` of principal at any time, plus the late fee of that principal.
    /// @dev Principal is applied oldest round first in the refund order of docs/03 section 6.8; the fee of each
    /// restored part (time since its shortfall) goes to the reserve. Holdback is not released: a defaulted member no
    /// longer earns per-round releases. `recordRepaid` is written once the debt reaches zero.
    /// @param amount Principal to repay, at most the member's `debt`.
    function repayDebt(uint256 amount) external nonReentrant {
        _requireState(CircleState.Active);
        address m = _msgSender();
        MemberInfo storage mi = _info[m];
        if (!mi.joined) revert IHuiCircle.NotMember();
        if (!mi.defaulted || mi.debt == 0 || amount == 0) revert IHuiCircle.NoShortfall();
        if (amount > mi.debt) revert IHuiCircle.RepayTooLarge(amount, mi.debt);
        usdc.safeTransferFrom(m, address(this), amount);
        (uint256 principal, uint256 fee) = _restoreAll(m, amount, settledRounds + 1);
        if (fee != 0) {
            reserve += fee;
            usdc.safeTransferFrom(m, address(this), fee);
        }
        emit IHuiCircle.DebtRepaid(m, principal, fee);
        if (mi.debt == 0) _record(m, IReputationRegistry.recordRepaid.selector);
    }

    /// @dev Oldest round whose shortfall of `m` is open and past its grace period, or 0 if there is none.
    function _expiredShortfall(address m) private view returns (uint32) {
        uint32 n = settledRounds;
        for (uint32 r = 1; r <= n; r++) {
            Shortfall storage sf = _shortfalls[r][m];
            if (!sf.resolved && sf.amount != 0 && block.timestamp > _graceEnd(r)) return r;
        }
        return 0;
    }

    /// @dev Default effects (docs/03 section 6.8), shared by `markDefault` and `finalize`.
    function _default(address m, MemberInfo storage mi, uint32 r) private {
        mi.defaulted = true;
        bool frozen = !mi.received;
        if (frozen) liveCount -= 1;
        uint256 fee = feeEscrow[r];
        if (fee != 0) {
            feeEscrow[r] = 0;
            totalFeeEscrow -= fee;
            reserve += fee;
            _rounds[r].feeForfeited = true;
            emit IHuiCircle.FeeForfeited(r, fee);
        }
        emit IHuiCircle.MemberDefaulted(m, r, frozen);
        _record(m, IReputationRegistry.recordDefault.selector);
    }

    // ================================================================== finalize (docs/03 section 5.3)

    /// @notice Close the circle after round N: pay back what is left, in the order of docs/03 section 5.3. Anyone may
    /// call once round N is settled and its grace period is over.
    /// @dev Members with a shortfall past grace are defaulted first; one still inside grace reverts `GraceNotOver`.
    /// Then: holdback of non-defaulted members back to them; holdback of defaulted members repays their debt in the
    /// refund order (late fee last, an unpaid fee is announced) and the rest returns to them; unforfeited fee
    /// escrows and the remaining bond go to the organizer; the reserve is shared equally among non-defaulted members
    /// (rounding dust to the smallest `joinIndex`, everything to the organizer if all defaulted); registry records
    /// completion; the factory is told. Every payment goes through the safe path, so one blocked address cannot block
    /// the others.
    function finalize() external nonReentrant {
        _requireState(CircleState.Active);
        uint32 n = _params.memberCount;
        if (settledRounds < n) revert IHuiCircle.PreviousRoundNotSettled();
        if (block.timestamp < _graceEnd(n)) revert IHuiCircle.GraceNotOver();
        uint256 count = _members.length;
        for (uint256 i = 0; i < count; i++) {
            address m = _members[i];
            MemberInfo storage mi = _info[m];
            if (mi.defaulted || mi.debt == 0) continue;
            uint32 r = _expiredShortfall(m);
            if (r == 0) revert IHuiCircle.GraceNotOver();
            _default(m, mi, r);
        }
        state = CircleState.Completed;

        for (uint256 i = 0; i < count; i++) {
            address m = _members[i];
            MemberInfo storage mi = _info[m];
            uint256 h = mi.holdback;
            mi.holdback = 0;
            totalHoldback -= h;
            if (mi.defaulted && mi.debt != 0 && h != 0) {
                h -= _repayFromPot(m, h, n + 1);
                // Parts of the debt that the member's own holdback had covered are restored into `holdback`.
                h += mi.holdback;
                totalHoldback -= mi.holdback;
                mi.holdback = 0;
            }
            if (h != 0) {
                emit IHuiCircle.HoldbackReleased(m, n, h);
                _pay(m, h);
            }
        }

        uint256 feesPaid;
        for (uint32 r = 1; r <= n; r++) {
            uint256 f = feeEscrow[r];
            if (f == 0) continue;
            feeEscrow[r] = 0;
            feesPaid += f;
        }
        totalFeeEscrow -= feesPaid;
        uint256 bondReturned = bondRemaining;
        bondRemaining = 0;
        _pay(organizer, feesPaid + bondReturned);

        uint256 shared = _shareReserve(true);
        emit IHuiCircle.CircleFinalized(bondReturned, feesPaid, shared);
        _notifyFinished();
    }

    /// @dev Split the whole reserve equally among non-defaulted members, dust to the smallest `joinIndex`; if all
    /// defaulted it goes to the organizer, never to the admin. With `completed`, also records completion for them.
    function _shareReserve(bool completed) private returns (uint256 total) {
        total = reserve;
        reserve = 0;
        uint256 count = _members.length;
        uint256 eligible;
        for (uint256 i = 0; i < count; i++) {
            if (!_info[_members[i]].defaulted) eligible++;
        }
        if (eligible == 0) {
            _pay(organizer, total);
            return total;
        }
        uint256 share = total / eligible;
        uint256 dust = total - share * eligible;
        for (uint256 i = 0; i < count; i++) {
            address m = _members[i];
            if (_info[m].defaulted) continue;
            _pay(m, share + dust);
            dust = 0;
            if (completed) _record(m, IReputationRegistry.recordCompleted.selector);
        }
    }

    /// @dev The factory only counts active circles; a failing factory must never lock the money.
    function _notifyFinished() private {
        try factory.onFinished(organizer) {} catch {}
    }

    // ================================================================== Pause and emergency unwind (docs/03 5.4)

    /// @notice Factory only (the admin goes through `factory.pauseCircle`). Active circles only.
    function pause() external onlyFactory {
        _requireState(CircleState.Active);
        state = CircleState.Paused;
        pausedAt = uint64(block.timestamp);
        emit IHuiCircle.CirclePaused(pausedAt);
    }

    /// @notice Factory only. The paused time is added to `pausedTotal`, so the schedule and every grace period move.
    function unpause() external onlyFactory {
        if (state != CircleState.Paused) revert IHuiCircle.WrongState(CircleState.Paused, state);
        pausedTotal += uint64(block.timestamp) - pausedAt;
        pausedAt = 0;
        state = CircleState.Active;
        emit IHuiCircle.CircleUnpaused(uint64(block.timestamp), pausedTotal);
    }

    /// @notice Factory only, after 48 hours of continuous pause. Pays everything according to the ledger: bond to the
    /// organizer, holdback to its owner, open reveal bonds to their senders, fee escrows to the reserve, and the
    /// reserve equally to non-defaulted members. There is no branch that sends money to the admin.
    function emergencyUnwind() external onlyFactory nonReentrant {
        if (state != CircleState.Paused) revert IHuiCircle.WrongState(CircleState.Paused, state);
        if (block.timestamp < uint256(pausedAt) + 48 hours) revert IHuiCircle.UnwindTooEarly();
        state = CircleState.Unwound;

        uint32 settled = settledRounds;
        for (uint32 r = 1; r <= settled; r++) {
            uint256 f = feeEscrow[r];
            if (f == 0) continue;
            feeEscrow[r] = 0;
            totalFeeEscrow -= f;
            reserve += f;
            emit IHuiCircle.FeeForfeited(r, f);
        }
        uint256 bond = bondRemaining;
        bondRemaining = 0;
        _pay(organizer, bond);

        uint32 k = currentRound();
        uint256 count = _members.length;
        for (uint256 i = 0; i < count; i++) {
            address m = _members[i];
            MemberInfo storage mi = _info[m];
            uint256 h = mi.holdback;
            if (h != 0) {
                mi.holdback = 0;
                totalHoldback -= h;
                emit IHuiCircle.HoldbackReleased(m, settled, h);
                _pay(m, h);
            }
            Commit storage c = _commits[k][m];
            uint256 rb = c.bondHeld;
            if (rb != 0) {
                c.bondHeld = 0;
                revealBondsHeld -= rb;
                _pay(m, rb);
            }
        }
        _shareReserve(false);
        emit IHuiCircle.CircleUnwound();
        _notifyFinished();
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

    /// @dev End of the grace period of a shortfall of round `r`: `settledAt(r) + G`, extended by the time the circle
    /// stayed paused after that settlement (docs/03 section 6.8).
    function _graceEnd(uint32 r) private view returns (uint256) {
        return uint256(_rounds[r].settledAt) + _params.graceSeconds + (pausedTotal - _pausedAtSettle[r]);
    }

    // ================================================================== Views

    /// @notice Coverage index in bps with reserve = 0: the minimum guarantee shown before joining.
    function guaranteedCoverageBps() public view returns (uint256) {
        return HuiMath.coverageIndexBps(_params.alphaBps, bondRemaining, 0, _params.memberCount, _params.contribution);
    }

    /// @notice Allowance a member signs when joining: (N - 1) * (C + revealBond).
    function requiredAllowance() public view returns (uint256) {
        return (uint256(_params.memberCount) - 1) * (uint256(_params.contribution) + revealBond());
    }
}
