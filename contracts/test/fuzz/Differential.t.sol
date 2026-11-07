// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HuiMath} from "../../src/libraries/HuiMath.sol";

/// @notice Differential test: the Solidity HuiMath and the commit-hash formula must match the shared vectors in
/// `test/vectors/huimath.json`, which are produced by the Python reference (`sim/huisim/math.py`) and also consumed
/// by the TypeScript SDK. Every integer in the file is a decimal string.
contract DifferentialTest is Test {
    string internal json;

    function setUp() public {
        json = vm.readFile("test/vectors/huimath.json");
    }

    // ------------------------------------------------------------ helpers

    /// @dev Reads one input column of a function's cases in a single JSON parse (per-case parsing exhausts gas).
    function _col(string memory fn, string memory field) internal view returns (uint256[] memory out) {
        string[] memory raw =
            abi.decode(vm.parseJson(json, string.concat(".functions.", fn, "[*].in.", field)), (string[]));
        out = new uint256[](raw.length);
        for (uint256 i = 0; i < raw.length; i++) {
            out[i] = vm.parseUint(raw[i]);
        }
    }

    function _outs(string memory fn) internal view returns (uint256[] memory out) {
        string[] memory raw = abi.decode(vm.parseJson(json, string.concat(".functions.", fn, "[*].out")), (string[]));
        out = new uint256[](raw.length);
        for (uint256 i = 0; i < raw.length; i++) {
            out[i] = vm.parseUint(raw[i]);
        }
    }

    function _msg(string memory fn, uint256 i) internal pure returns (string memory) {
        return string.concat(fn, " #", vm.toString(i));
    }

    // ------------------------------------------------------------ metadata

    function test_Vectors_Metadata() public view {
        assertEq(vm.parseJsonUint(json, ".version"), 1, "vector file version");
        assertGt(vm.parseJsonUint(json, ".seed"), 0, "seed present");
    }

    // ------------------------------------------------------------ HuiMath

    function test_Differential_Exposure() public view {
        uint256[] memory outs = _outs("exposure");
        uint256[] memory n = _col("exposure", "n");
        uint256[] memory k = _col("exposure", "k");
        uint256[] memory c = _col("exposure", "c");
        assertGt(outs.length, 0);
        for (uint256 i = 0; i < outs.length; i++) {
            assertEq(HuiMath.exposure(n[i], k[i], c[i]), outs[i], _msg("exposure", i));
        }
    }

    function test_Differential_MaxExposure() public view {
        uint256[] memory outs = _outs("maxExposure");
        uint256[] memory n = _col("maxExposure", "n");
        uint256[] memory c = _col("maxExposure", "c");
        assertGt(outs.length, 0);
        for (uint256 i = 0; i < outs.length; i++) {
            assertEq(HuiMath.maxExposure(n[i], c[i]), outs[i], _msg("maxExposure", i));
        }
    }

    function test_Differential_HoldbackFor() public view {
        uint256[] memory outs = _outs("holdbackFor");
        uint256[] memory alpha = _col("holdbackFor", "alphaBps");
        uint256[] memory n = _col("holdbackFor", "n");
        uint256[] memory k = _col("holdbackFor", "k");
        uint256[] memory c = _col("holdbackFor", "c");
        assertGt(outs.length, 0);
        for (uint256 i = 0; i < outs.length; i++) {
            assertEq(HuiMath.holdbackFor(alpha[i], n[i], k[i], c[i]), outs[i], _msg("holdbackFor", i));
        }
    }

    function test_Differential_ReleasePerRound() public view {
        uint256[] memory outs = _outs("releasePerRound");
        uint256[] memory alpha = _col("releasePerRound", "alphaBps");
        uint256[] memory c = _col("releasePerRound", "c");
        assertGt(outs.length, 0);
        for (uint256 i = 0; i < outs.length; i++) {
            assertEq(HuiMath.releasePerRound(alpha[i], c[i]), outs[i], _msg("releasePerRound", i));
        }
    }

    function test_Differential_CoverageIndexBps() public view {
        uint256[] memory outs = _outs("coverageIndexBps");
        uint256[] memory alpha = _col("coverageIndexBps", "alphaBps");
        uint256[] memory bond = _col("coverageIndexBps", "bond");
        uint256[] memory reserve = _col("coverageIndexBps", "reserve");
        uint256[] memory n = _col("coverageIndexBps", "n");
        uint256[] memory c = _col("coverageIndexBps", "c");
        assertGt(outs.length, 0);
        for (uint256 i = 0; i < outs.length; i++) {
            assertEq(
                HuiMath.coverageIndexBps(alpha[i], bond[i], reserve[i], n[i], c[i]),
                outs[i],
                _msg("coverageIndexBps", i)
            );
        }
    }

    function test_Differential_MaxBid() public view {
        uint256[] memory outs = _outs("maxBid");
        uint256[] memory cap = _col("maxBid", "capBps");
        uint256[] memory n = _col("maxBid", "n");
        uint256[] memory k = _col("maxBid", "k");
        uint256[] memory c = _col("maxBid", "c");
        uint256[] memory period = _col("maxBid", "periodSec");
        uint256[] memory payers = _col("maxBid", "payers");
        assertGt(outs.length, 0);
        for (uint256 i = 0; i < outs.length; i++) {
            assertEq(HuiMath.maxBid(cap[i], n[i], k[i], c[i], period[i], payers[i]), outs[i], _msg("maxBid", i));
        }
    }

    function test_Differential_LateFee() public view {
        uint256[] memory outs = _outs("lateFee");
        uint256[] memory amount = _col("lateFee", "amount");
        uint256[] memory rate = _col("lateFee", "lateRateBps");
        uint256[] memory elapsed = _col("lateFee", "elapsedSec");
        uint256[] memory period = _col("lateFee", "periodSec");
        uint256[] memory dur = _col("lateFee", "roundDuration");
        assertGt(outs.length, 0);
        for (uint256 i = 0; i < outs.length; i++) {
            assertEq(HuiMath.lateFee(amount[i], rate[i], elapsed[i], period[i], dur[i]), outs[i], _msg("lateFee", i));
        }
    }

    function test_Differential_BpsOf() public view {
        uint256[] memory outs = _outs("bpsOf");
        uint256[] memory amount = _col("bpsOf", "amount");
        uint256[] memory bps = _col("bpsOf", "bps");
        assertGt(outs.length, 0);
        for (uint256 i = 0; i < outs.length; i++) {
            assertEq(HuiMath.bpsOf(amount[i], bps[i]), outs[i], _msg("bpsOf", i));
        }
    }

    // ------------------------------------------------------------ commit hash

    function test_Differential_CommitHash() public {
        uint256 cases = 100;
        for (uint256 i = 0; i < cases; i++) {
            string memory p = string.concat(".commitHash[", vm.toString(i), "].");
            // Same formula as docs/03 section 6.2 and docs/05 section 5.4 (round is uint32, bid is uint256).
            bytes32 got = keccak256(
                abi.encode(
                    vm.parseJsonAddress(json, string.concat(p, "circle")),
                    uint32(vm.parseJsonUint(json, string.concat(p, "round"))),
                    vm.parseJsonAddress(json, string.concat(p, "member")),
                    vm.parseJsonUint(json, string.concat(p, "bid")),
                    vm.parseJsonBytes32(json, string.concat(p, "salt"))
                )
            );
            assertEq(got, vm.parseJsonBytes32(json, string.concat(p, "hash")), _msg("commitHash", i));
        }
        // The file must hold exactly `cases` entries.
        vm.expectRevert();
        this.parseAt(string.concat(".commitHash[", vm.toString(cases), "].hash"));
    }

    function parseAt(string memory key) external view returns (bytes32) {
        return vm.parseJsonBytes32(json, key);
    }
}
