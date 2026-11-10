// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IHuiFactory} from "./interfaces/IHuiFactory.sol";
import {HuiMath} from "./libraries/HuiMath.sol";
import {Commit, CircleParams, CircleState, MemberInfo, RoundInfo, Shortfall} from "./libraries/HuiTypes.sol";

/// @title HuiCircleBase
/// @notice Storage layout and the helpers shared by the money logic (`HuiCircle`) and the read-only views
/// (`HuiCircleViews`). Both inherit this contract, so their storage layouts are identical by construction; that is
/// what lets `HuiCircle` serve the views by delegating to a `HuiCircleLens` (the EIP-170 size limit, task A4).
/// @dev Never reorder or insert variables without re-running the lens parity tests.
abstract contract HuiCircleBase is ERC2771Context, EIP712, Initializable, ReentrancyGuard {
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
    uint64 public pausedAt; // start of the current pause, 0 while not paused
    uint64 public pausedTotal; // seconds spent paused in finished pauses
    uint32 public settledRounds; // number of rounds already paid out

    address[] internal _members; // by joinIndex
    mapping(address => MemberInfo) internal _info;
    mapping(uint32 => RoundInfo) internal _rounds;
    mapping(uint32 => mapping(address => Commit)) internal _commits;
    mapping(uint32 => mapping(address => Shortfall)) internal _shortfalls; // round => debtor => record

    /// @dev Per round: commits so far and L_k (live members minus the winner) fixed by the first commit, 0 = not
    /// fixed yet. One slot, so the first commit of a round pays for a single new storage word.
    struct RoundBids {
        uint32 count;
        uint8 payers;
    }

    mapping(uint32 => RoundBids) internal _bids;
    mapping(uint32 => uint64) internal _pausedAtSettle; // pausedTotal when round k was settled (docs/03 section 3.2)
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
    constructor(address forwarder_) ERC2771Context(forwarder_) EIP712("HuiSafe", "1") {}

    /// @dev docs/03 section 3.2: the nominal schedule, but never before round k-1 was actually settled, so a late
    /// settlement only delays round k and never removes its commit window. Pauses add their full length, also when
    /// they happen after a late settlement (audit M-01), hence the `pausedAtSettle` correction.
    function _roundStart(uint32 k) internal view returns (uint256) {
        uint256 nominal = uint256(startTime) + uint256(k - 1) * _params.roundDuration;
        if (k >= 2) {
            uint256 prev = _rounds[k - 1].settledAt; // 0 while round k - 1 is not settled
            if (prev != 0) {
                prev -= _pausedAtSettle[k - 1]; // pauses before that settlement are already inside `settledAt`
                if (prev > nominal) nominal = prev;
            }
        }
        return nominal + pausedTotal;
    }

    /// @dev L_k: paying live members of round `k` (live minus the winner). Fixed by the first commit of the round, so a
    /// `markDefault` between commit and reveal cannot push an honest sealed bid above the cap (audit M-02). Before
    /// any commit it follows the live count.
    function _payers(uint32 k) internal view returns (uint256 payers) {
        payers = _bids[k].payers;
        if (payers == 0) {
            uint256 live = liveCount;
            payers = live > 0 ? live - 1 : 0;
        }
    }

    /// @dev Statutory bid ceiling of round `k` (Decree 19 Art. 21 interpretation), before the organizer's share.
    function _statutoryMaxBid(uint32 k) internal view returns (uint256) {
        return
            HuiMath.maxBid(
                _params.capBps, _params.memberCount, k, _params.contribution, _params.periodSeconds, _payers(k)
            );
    }

    /// @dev Enforced bid ceiling: the statutory cap minus the organizer's commission share phi (docs/03 section 2.7).
    function _maxBid(uint32 k) internal view returns (uint256) {
        return HuiMath.bidCapAfterShare(_statutoryMaxBid(k), _params.commissionShareBps);
    }

    /// @notice `settledRounds + 1`, capped at N.
    function currentRound() public view returns (uint32) {
        uint32 k = settledRounds + 1;
        return k > _params.memberCount ? _params.memberCount : k;
    }

    /// @notice Reveal bond: `revealBondBps` of C, rounded down.
    function revealBond() public view returns (uint256) {
        return HuiMath.bpsOf(_params.contribution, _params.revealBondBps);
    }
}
