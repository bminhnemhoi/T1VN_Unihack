// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Kind of circle: `Fixed` = no interest (payout order is join order), `Bidding` = sealed-bid circle.
enum CircleMode {
    Fixed,
    Bidding
}

/// @notice Lifecycle state of a circle (docs/03 section 5).
enum CircleState {
    Forming,
    Active,
    Paused,
    Completed,
    Cancelled,
    Unwound
}

/// @notice Phase of the current round, derived from timestamps.
enum RoundPhase {
    NotStarted,
    Commit,
    Reveal,
    AwaitingSettle,
    Done
}

/// @notice Source that covered (or is owed back for) a shortfall.
enum CoverSource {
    Holdback,
    Bond,
    Reserve,
    Uncovered
}

/// @notice Parameters fixed when a circle is created (docs/03 section 3.1).
struct CircleParams {
    CircleMode mode;
    uint8 memberCount; // N, 3..30
    uint96 contribution; // C, USDC 6 decimals
    uint32 periodSeconds; // nominal period P (interest cap, late fee)
    uint32 roundDuration; // real time between two rounds
    uint32 commitWindow; // Fixed: 0
    uint32 revealWindow; // Fixed: 0
    uint32 graceSeconds; // grace period
    uint16 alphaBps; // holdback
    bool commissionMode; // commission circle (Decree 19 Art. 4 cl. 8)
    uint16 feeBps; // organizer fee; = 0 if !commissionMode
    uint16 reserveBps; // reserve premium
    uint16 revealBondBps; // reveal bond, on C
    uint16 capBps; // annual interest cap, <= factory.maxCapBps
    uint64 joinDeadline;
    bool organizerIsMember;
    bytes32 label; // short name, never a person's name
    // ---- v1.2 (A13): appended at the END of the struct only ----
    uint16 commissionShareBps; // phi, 0..5000; 0 = fixed fee feeBps*pot, > 0 = commission inside the interest cap
    bytes32 termsHash; // keccak256 of the circle's agreement text (ADR-27), non-zero, immutable
}

/// @notice Per-member state inside a circle.
struct MemberInfo {
    bool joined;
    bool received; // already took the pot
    bool defaulted; // marked by markDefault
    uint8 joinIndex; // 0..N-1
    uint8 receivedRound; // 0 if not yet
    uint16 lateCount; // late count inside this circle
    uint128 holdback; // currently withheld
    uint128 debt; // total unpaid shortfall (including virtual part when Frozen)
}

// Derived status:
//   Live          = joined && !received && !defaulted
//   Dead          = received && !defaulted
//   Frozen        = !received && defaulted
//   DefaultedDead = received && defaulted

/// @notice A sealed bid commitment.
struct Commit {
    bytes32 hash;
    uint32 commitIndex;
    bool revealed;
    uint128 bid;
    uint128 bondHeld;
}

/// @notice A missed contribution. The four from*/uncovered fields are amounts STILL TO BE RESTORED, shrinking as paid
/// (docs/03 section 6.8).
struct Shortfall {
    uint128 amount; // part that could not be pulled (original principal, never changes)
    uint128 fromHoldback;
    uint128 fromBond;
    uint128 fromReserve;
    uint128 uncovered; // the round winner received exactly this much less
    uint64 since; // = settledAt of the round; start of late-fee accrual
    bool resolved; // true once the four fields above are all zero
}

/// @notice Result of a settled round.
struct RoundInfo {
    address winner;
    uint128 winningBid;
    uint128 pot;
    uint128 payout;
    uint128 holdback;
    uint128 fee;
    uint128 premium;
    uint128 uncovered;
    uint64 settledAt;
    uint32 commitCount;
    bool settled;
    bool feeForfeited;
}

/// @notice EIP-2612 permit for USDC.
struct PermitSig {
    uint256 value;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

/// @notice Attestation signed by the HuiSafe attester (EIP-712).
struct MemberAttestation {
    address member;
    address circle;
    bytes32 attestationId; // irreversible hash, no personal data
    uint64 expiry;
}

/// @notice Factory configuration; changes only affect circles created afterwards.
struct FactoryConfig {
    address usdc;
    address forwarder; // ERC2771Forwarder
    address reputation;
    address attester;
    uint16 maxCapBps; // 2000
    uint16 lateRateBps; // 1000
    uint16 minCoverageBps; // 5000
    uint16 maxFeeBps; // 300
    uint16 maxReserveBps; // 300
    uint8 minMembers; // 3
    uint8 maxMembers; // 30
    uint96 maxContribution; // 10_000 USDC on testnet
}
