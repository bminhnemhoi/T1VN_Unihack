// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HuiMath
/// @notice Pure formulas of the HuiSafe protocol (docs/03 section 2, docs/05 section 3.5). One source of truth for
/// every money computation; `packages/sdk/src/huiMath.ts` and `sim/huisim/math.py` must match it unit for unit.
/// @dev All amounts are USDC base units (6 decimals), all rates are basis points (10_000 = 100%), all durations are
/// seconds. Every division truncates toward zero (rounds DOWN); the rounding direction is repeated at each division.
/// Arithmetic is checked, so an input outside the documented domain (for example k > n) reverts.
library HuiMath {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant YEAR = 365 days;

    /// @notice Total obligation still unpaid after round k is settled: O(k) = k * (n - k) * c.
    /// @dev Exact, no division. Reverts if k > n.
    function exposure(uint256 n, uint256 k, uint256 c) internal pure returns (uint256) {
        return k * (n - k) * c;
    }

    /// @notice Peak exposure O_max = floor(n/2) * ceil(n/2) * c, reached at k = floor(n/2).
    /// @dev `n / 2` rounds DOWN; `n - n / 2` is therefore the ceiling of n/2. Exact otherwise.
    function maxExposure(uint256 n, uint256 c) internal pure returns (uint256) {
        uint256 half = n / 2; // rounds down: floor(n/2)
        return half * (n - half) * c;
    }

    /// @notice Holdback withheld from the pot of the member who takes round k: alpha * (n - k) * c.
    /// @dev The product is formed first and divided once by BPS, rounding DOWN.
    function holdbackFor(uint256 alphaBps, uint256 n, uint256 k, uint256 c) internal pure returns (uint256) {
        return (alphaBps * (n - k) * c) / BPS; // rounds down
    }

    /// @notice Holdback released after each round the holder pays on time: alpha * c.
    /// @dev Divides once by BPS, rounding DOWN.
    function releasePerRound(uint256 alphaBps, uint256 c) internal pure returns (uint256) {
        return (alphaBps * c) / BPS; // rounds down
    }

    /// @notice Coverage index in bps: min(10_000, alphaBps + (bond + reserve_) * 10_000 / O_max).
    /// @dev The bond/reserve term divides by O_max and rounds DOWN, so the index never overstates coverage.
    /// If O_max is zero (nothing can be exposed) coverage is full, 10_000.
    function coverageIndexBps(uint256 alphaBps, uint256 bond, uint256 reserve_, uint256 n, uint256 c)
        internal
        pure
        returns (uint256)
    {
        uint256 oMax = maxExposure(n, c);
        if (oMax == 0) return BPS;
        uint256 ci = alphaBps + ((bond + reserve_) * BPS) / oMax; // rounds down
        return ci > BPS ? BPS : ci;
    }

    /// @notice Ceiling on the winning bid for round k under Decree 19/2019 Art. 21 (HuiSafe interpretation, to be
    /// confirmed by a lawyer): capBps * (n - k) * c * (n - k) * periodSec / (10_000 * 365 days * payers), and always
    /// strictly below c (result <= c - 1).
    /// @dev `payers` = number of live members paying this round (winner excluded). payers == 0 or c == 0 returns 0.
    /// The whole numerator is formed first and divided once, rounding DOWN. Reverts if k > n.
    function maxBid(uint256 capBps, uint256 n, uint256 k, uint256 c, uint256 periodSec, uint256 payers)
        internal
        pure
        returns (uint256)
    {
        if (payers == 0 || c == 0) return 0;
        uint256 remaining = n - k;
        uint256 bound = (capBps * remaining * c * remaining * periodSec) / (BPS * YEAR * payers); // rounds down
        uint256 hardCap = c - 1;
        return bound > hardCap ? hardCap : bound;
    }

    /// @notice Late-payment fee: amount * lateRateBps * elapsedSec * timeScale / (10_000 * 365 days), where
    /// timeScale = periodSec / roundDuration (1 on a real circle, larger in demo mode).
    /// @dev Multiplies by periodSec and divides by roundDuration inside one fraction (a single division, rounding
    /// DOWN) instead of truncating timeScale first. Reverts if roundDuration is zero.
    function lateFee(uint256 amount, uint256 lateRateBps, uint256 elapsedSec, uint256 periodSec, uint256 roundDuration)
        internal
        pure
        returns (uint256)
    {
        return (amount * lateRateBps * elapsedSec * periodSec) / (BPS * YEAR * roundDuration); // rounds down
    }

    /// @notice amount * bps / 10_000, rounding DOWN.
    function bpsOf(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / BPS; // rounds down
    }
}
