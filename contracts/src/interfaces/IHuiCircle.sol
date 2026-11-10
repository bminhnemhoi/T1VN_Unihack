// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    CircleParams,
    CircleState,
    CoverSource,
    Commit,
    FactoryConfig,
    MemberAttestation,
    MemberInfo,
    PermitSig,
    RoundInfo,
    RoundPhase,
    Shortfall
} from "../libraries/HuiTypes.sol";

/// @title IHuiCircle
/// @notice One rotating-savings circle (docs/05 sections 3.2, 4.1, 4.2). Events and errors live here so that
/// the implementation and its tests share one definition.
interface IHuiCircle {
    // ------------------------------------------------------------------ events (docs/05 4.1)
    event BondDeposited(address indexed organizer, uint256 amount, uint256 bondTotal);
    event BondWithdrawn(address indexed organizer, uint256 amount);
    event MemberJoined(address indexed member, uint8 joinIndex, bytes32 attestationId);
    event MemberLeft(address indexed member);
    event CircleActivated(uint64 startTime, uint256 guaranteedCoverageBps);
    event CircleCancelled();
    /// @dev Emitted once in `initialize` (ADR-27); both values are immutable from then on.
    event CircleTermsSet(bytes32 termsHash, uint16 commissionShareBps);

    event BidCommitted(uint32 indexed round, address indexed member, bytes32 commitHash, uint32 commitIndex);
    event BidRevealed(uint32 indexed round, address indexed member, uint256 bid);
    event RevealBondForfeited(uint32 indexed round, address indexed member, uint256 amount);

    /// @dev Fee of a round without any shortfall, paid to the organizer in the settling transaction (docs/03 6.5 step 6).
    event FeePaid(uint32 indexed round, address indexed organizer, uint256 amount);
    event ContributionPulled(uint32 indexed round, address indexed member, uint256 amount);
    event ContributionShortfall(uint32 indexed round, address indexed member, uint256 amount);
    event ShortfallCovered(uint32 indexed round, address indexed member, CoverSource source, uint256 amount);
    event RoundSettled(
        uint32 indexed round,
        address indexed winner,
        uint256 bid,
        uint256 pot,
        uint256 payout,
        uint256 holdback,
        uint256 fee,
        uint256 premium,
        uint256 uncovered
    );
    event HoldbackReleased(address indexed member, uint32 indexed round, uint256 amount);

    event LatePaid(uint32 indexed round, address indexed member, uint256 amount, uint256 lateFee);
    event DebtRepaid(address indexed member, uint256 principal, uint256 lateFee);
    /// @dev Late fee that could not be collected because the pot or holdback ran out (docs/03 section 6.8): not
    /// stored as debt, only announced as a public off-chain claim.
    event LateFeeUnpaid(address indexed member, uint256 amount);
    /// @dev Each restored part follows docs/03 section 6.8. source = Uncovered means paid straight to the round winner;
    /// the other sources are reserve, bond, holdback refills.
    event ShortfallRestored(uint32 indexed round, address indexed member, CoverSource source, uint256 amount);
    event MemberDefaulted(address indexed member, uint32 indexed round, bool frozen);
    event FeeForfeited(uint32 indexed round, uint256 amount);

    /// @dev Transfer failed, amount recorded in claimable.
    event PaymentDeferred(address indexed to, uint256 amount);
    event Claimed(address indexed to, uint256 amount);
    /// @dev Reserve split by on-time weight at `finalize` (ADR-24); weight 0 for defaulted members.
    event ReserveShared(address indexed member, uint256 amount, uint16 weight);
    event CircleFinalized(uint256 bondReturned, uint256 feesPaid, uint256 reserveDistributed);
    event CirclePaused(uint64 at);
    event CircleUnpaused(uint64 at, uint64 pausedTotal);
    event CircleUnwound();

    // ------------------------------------------------------------------ errors (docs/05 4.2)
    error NotFactory();
    error NotOrganizer();
    error NotAdmin();
    error NotMember();
    error AlreadyMember();
    /// @dev join() after leave() on the same circle (docs/03 section 5.1).
    error AlreadyLeft();
    error WrongState(CircleState expected, CircleState actual);
    /// @dev Codes in docs/05 section 4.3.
    error InvalidParams(uint8 code);
    error CircleFull();
    error CircleNotFull(uint8 have, uint8 need);
    error JoinClosed();
    error BadAttestation();
    error AttestationUsed();
    error AttestationExpired();
    error InsufficientAllowance(uint256 needed, uint256 actual);
    error CoverageTooLow(uint256 bps, uint256 minBps);
    error NotInCommitWindow();
    error NotInRevealWindow();
    error NotEligibleToBid();
    error NoCommit();
    error CommitMismatch();
    error AlreadyRevealed();
    error BidTooHigh(uint256 bid, uint256 max);
    error TooEarly(uint64 at);
    error RoundAlreadySettled();
    error PreviousRoundNotSettled();
    error NoShortfall();
    error GraceExpired();
    error GraceNotOver();
    error AlreadyDefaulted();
    error NothingToClaim();
    error NothingToWithdraw();
    error RepayTooLarge(uint256 amount, uint256 debt);
    /// @dev Different name from the CirclePaused event so solc does not report a clash.
    error CircleIsPaused();
    error UnwindTooEarly();

    // ------------------------------------------------------------------ Forming
    /// @notice Factory only, once.
    function initialize(address organizer, CircleParams calldata p, FactoryConfig calldata cfg) external;
    function depositBond(uint256 amount, PermitSig calldata permit) external;
    function withdrawBond() external;
    function join(MemberAttestation calldata att, bytes calldata attSig, PermitSig calldata permit) external;
    function leave() external;
    function activate() external;
    function cancel() external;

    // ------------------------------------------------------------------ Active
    function commitBid(bytes32 commitHash) external;
    function revealBid(uint256 bid, bytes32 salt) external;
    function settleRound() external;
    function payLate(uint32 round) external;
    function markDefault(address member) external;
    function repayDebt(uint256 amount) external;
    function finalize() external;
    function claim() external;

    // ------------------------------------------------------------------ Emergency: factory only
    function pause() external;
    function unpause() external;
    /// @dev Reverts UnwindTooEarly if Paused for less than 48 hours.
    function emergencyUnwind() external;

    // ------------------------------------------------------------------ Views
    function params() external view returns (CircleParams memory);
    function members() external view returns (address[] memory);
    function memberInfo(address m) external view returns (MemberInfo memory);
    /// @notice settledRounds + 1, capped at N.
    function currentRound() external view returns (uint32);
    function phase() external view returns (RoundPhase);
    function roundStart(uint32 k) external view returns (uint64);
    function deadline(uint32 k) external view returns (uint64);
    function roundInfo(uint32 k) external view returns (RoundInfo memory);
    function commitOf(uint32 k, address m) external view returns (Commit memory);
    function shortfallOf(uint32 k, address m) external view returns (Shortfall memory);
    /// @notice Enforced bid ceiling: the statutory cap, minus the organizer's share phi when phi > 0 (docs/03 2.7).
    function maxBid(uint32 k) external view returns (uint256);
    /// @notice Statutory bid cap (Decree 19 Art. 21 interpretation), before the organizer's share.
    function statutoryMaxBid(uint32 k) external view returns (uint256);
    /// @notice room_k = statutoryMaxBid(k) * L_k, the interest room the commission lives inside.
    function commissionRoom(uint32 k) external view returns (uint256);
    /// @notice max(0, (N - 1) - lateCount); 0 for defaulted members (ADR-24).
    function onTimeWeight(address m) external view returns (uint16);
    function exposure(uint32 k) external view returns (uint256);
    function maxExposure() external view returns (uint256);
    /// @notice Uses the current reserve.
    function coverageIndexBps() external view returns (uint256);
    /// @notice Reserve = 0.
    function guaranteedCoverageBps() external view returns (uint256);
    /// @notice (N-1) * (C + revealBond).
    function requiredAllowance() external view returns (uint256);
    function revealBond() external view returns (uint256);
    function dueOf(address m, uint32 k, uint256 bid) external view returns (uint256);
    function lateFeeOf(address m, uint32 k) external view returns (uint256);
}
