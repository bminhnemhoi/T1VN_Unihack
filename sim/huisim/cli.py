"""Command line entry: ``python -m huisim.cli <command>``.

Only ``vectors`` exists for now (docs/08 section 5.2); ``run`` and ``sweep`` arrive with
the simulation model.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

import numpy as np

from . import math as hm
from .hashing import commit_hash

VECTOR_VERSION = 1
DEFAULT_SEED = 7

Case = dict[str, int]
Sampler = Callable[[np.random.Generator], Case]

C_MIN = 1 * hm.USDC
C_MAX = 10_000 * hm.USDC
C_EDGES = (C_MIN, 100 * hm.USDC, C_MAX)
PERIOD_30D = 30 * hm.DAY

# JSON function name -> (python function, ordered input names). Order = Solidity parameter order.
FUNCTIONS: dict[str, tuple[Callable[..., int], tuple[str, ...]]] = {
    "exposure": (hm.exposure, ("n", "k", "c")),
    "maxExposure": (hm.max_exposure, ("n", "c")),
    "holdbackFor": (hm.holdback_for, ("alphaBps", "n", "k", "c")),
    "releasePerRound": (hm.release_per_round, ("alphaBps", "c")),
    "coverageIndexBps": (hm.coverage_index_bps, ("alphaBps", "bond", "reserve", "n", "c")),
    "maxBid": (hm.max_bid, ("capBps", "n", "k", "c", "periodSec", "payers")),
    "lateFee": (
        hm.late_fee,
        ("amount", "lateRateBps", "elapsedSec", "periodSec", "roundDuration"),
    ),
    "bpsOf": (hm.bps_of, ("amount", "bps")),
}

# Number of cases per function; the total with commitHash is 2000 (docs/09 section 6).
TARGETS: dict[str, int] = {
    "exposure": 200,
    "maxExposure": 150,
    "holdbackFor": 250,
    "releasePerRound": 150,
    "coverageIndexBps": 300,
    "maxBid": 400,
    "lateFee": 300,
    "bpsOf": 150,
}
COMMIT_HASH_TARGET = 100


def _ri(rng: np.random.Generator, lo: int, hi: int) -> int:
    """Uniform integer in [lo, hi] as a Python int."""
    return int(rng.integers(lo, hi, endpoint=True))


def _rc(rng: np.random.Generator) -> int:
    """Random contribution in [1, 10_000] USDC: half whole USDC, half arbitrary units."""
    if rng.integers(0, 2) == 0:
        return _ri(rng, 1, 10_000) * hm.USDC
    return _ri(rng, C_MIN, C_MAX)


# --- samplers (valid protocol domain: 3 <= n <= 30, 1 <= C <= 10_000 USDC) -------------


def _s_exposure(rng: np.random.Generator) -> Case:
    n = _ri(rng, 3, 30)
    return {"n": n, "k": _ri(rng, 0, n), "c": _rc(rng)}


def _s_max_exposure(rng: np.random.Generator) -> Case:
    return {"n": _ri(rng, 3, 30), "c": _rc(rng)}


def _s_holdback_for(rng: np.random.Generator) -> Case:
    n = _ri(rng, 3, 30)
    return {"alphaBps": _ri(rng, 0, 10_000), "n": n, "k": _ri(rng, 0, n), "c": _rc(rng)}


def _s_release(rng: np.random.Generator) -> Case:
    return {"alphaBps": _ri(rng, 0, 10_000), "c": _rc(rng)}


def _s_coverage(rng: np.random.Generator) -> Case:
    n, c = _ri(rng, 3, 30), _rc(rng)
    o_max = hm.max_exposure(n, c)
    return {
        "alphaBps": _ri(rng, 0, 10_000),
        "bond": _ri(rng, 0, 2 * o_max),
        "reserve": _ri(rng, 0, o_max),
        "n": n,
        "c": c,
    }


def _s_max_bid(rng: np.random.Generator) -> Case:
    n = _ri(rng, 3, 30)
    period = PERIOD_30D if rng.integers(0, 3) == 0 else _ri(rng, hm.DAY, 31 * hm.DAY)
    return {
        "capBps": _ri(rng, 0, 2000),
        "n": n,
        "k": _ri(rng, 1, n),
        "c": _rc(rng),
        "periodSec": period,
        "payers": _ri(rng, 0, n),
    }


def _s_late_fee(rng: np.random.Generator) -> Case:
    period = _ri(rng, hm.DAY, 31 * hm.DAY)
    round_duration = period if rng.integers(0, 2) == 0 else _ri(rng, 120, period)
    return {
        "amount": _ri(rng, 0, 30 * C_MAX),
        "lateRateBps": _ri(rng, 0, 2000),
        "elapsedSec": _ri(rng, 0, 400 * hm.DAY),
        "periodSec": period,
        "roundDuration": round_duration,
    }


def _s_bps_of(rng: np.random.Generator) -> Case:
    return {"amount": _ri(rng, 0, 30 * C_MAX), "bps": _ri(rng, 0, 10_000)}


SAMPLERS: dict[str, Sampler] = {
    "exposure": _s_exposure,
    "maxExposure": _s_max_exposure,
    "holdbackFor": _s_holdback_for,
    "releasePerRound": _s_release,
    "coverageIndexBps": _s_coverage,
    "maxBid": _s_max_bid,
    "lateFee": _s_late_fee,
    "bpsOf": _s_bps_of,
}


# --- hand-picked edge cases and the numbers of docs/03 section 8 -----------------------


def _edges() -> dict[str, list[Case]]:
    edges: dict[str, list[Case]] = {name: [] for name in FUNCTIONS}
    for n in (3, 5, 10, 29, 30):
        for k in sorted({0, 1, n // 2, n - 1, n}):
            for c in C_EDGES:
                edges["exposure"].append({"n": n, "k": k, "c": c})
        for c in C_EDGES:
            edges["maxExposure"].append({"n": n, "c": c})
    for alpha in (0, 1, 2000, 10_000):
        for n in (3, 5, 30):
            for k in sorted({0, 1, n - 1, n}):
                for c in (C_MIN, 100 * hm.USDC, C_MAX):
                    edges["holdbackFor"].append({"alphaBps": alpha, "n": n, "k": k, "c": c})
        for c in C_EDGES:
            edges["releasePerRound"].append({"alphaBps": alpha, "c": c})
    o_5 = hm.max_exposure(5, 100 * hm.USDC)
    for alpha, bond, reserve, n, c in (
        (2000, 480 * hm.USDC, 0, 5, 100 * hm.USDC),  # docs/03 section 8: CI = 100%
        (2000, 0, 0, 5, 100 * hm.USDC),  # bond 0 gives exactly alpha
        (0, 0, 0, 3, C_MIN),
        (2000, 479 * hm.USDC, 0, 5, 100 * hm.USDC),
        (2000, 2 * o_5, o_5, 5, 100 * hm.USDC),  # clamp at 10_000
        (10_000, 0, 0, 30, C_MAX),
        (0, hm.max_exposure(30, C_MAX), 0, 30, C_MAX),
        (0, hm.max_exposure(3, C_MIN) - 1, 0, 3, C_MIN),
    ):
        edges["coverageIndexBps"].append(
            {"alphaBps": alpha, "bond": bond, "reserve": reserve, "n": n, "c": c}
        )
    # docs/03 section 8 table (k = 1..5 with payers = N - k, payers = 0 at k = 5), scaled C = 10.
    for c in (100 * hm.USDC, 10 * hm.USDC):
        for k in range(1, 6):
            edges["maxBid"].append(
                {"capBps": 2000, "n": 5, "k": k, "c": c, "periodSec": PERIOD_30D, "payers": 5 - k}
            )
    edges["maxBid"].append(  # Judgment 48/2024/DS-ST (VND units)
        {"capBps": 2000, "n": 25, "k": 5, "c": 2_000_000, "periodSec": PERIOD_30D, "payers": 20}
    )
    for n in (3, 30):
        for k in sorted({1, n - 1, n}):
            for c in (C_MIN, C_MAX):
                for payers in (0, 1, n - k):
                    edges["maxBid"].append(
                        {"capBps": 2000, "n": n, "k": k, "c": c,
                         "periodSec": hm.DAY, "payers": payers}
                    )  # fmt: skip
    edges["maxBid"].append(  # the c - 1 cap binds: tiny c, long period, huge cap
        {"capBps": 10_000, "n": 30, "k": 1, "c": C_MIN, "periodSec": 31 * hm.DAY, "payers": 1}
    )
    edges["lateFee"] += [
        {"amount": 100 * hm.USDC, "lateRateBps": 1000, "elapsedSec": hm.DAY,
         "periodSec": PERIOD_30D, "roundDuration": PERIOD_30D},
        {"amount": 100 * hm.USDC, "lateRateBps": 1000, "elapsedSec": 6,
         "periodSec": PERIOD_30D, "roundDuration": 180},
        {"amount": 0, "lateRateBps": 1000, "elapsedSec": hm.DAY,
         "periodSec": PERIOD_30D, "roundDuration": PERIOD_30D},
        {"amount": 100 * hm.USDC, "lateRateBps": 0, "elapsedSec": hm.DAY,
         "periodSec": PERIOD_30D, "roundDuration": PERIOD_30D},
        {"amount": 100 * hm.USDC, "lateRateBps": 1000, "elapsedSec": 0,
         "periodSec": PERIOD_30D, "roundDuration": PERIOD_30D},
        {"amount": 30 * C_MAX, "lateRateBps": 2000, "elapsedSec": 400 * hm.DAY,
         "periodSec": 31 * hm.DAY, "roundDuration": 120},
        {"amount": 1, "lateRateBps": 1, "elapsedSec": 1,
         "periodSec": hm.DAY, "roundDuration": 31 * hm.DAY},
    ]  # fmt: skip
    for amount, bps in (
        (376 * hm.USDC, 100),  # docs/03 section 8: 3.76 USDC
        (0, 100),
        (376 * hm.USDC, 0),
        (376 * hm.USDC, 10_000),
        (1, 9_999),
        (9_999, 1),
        (30 * C_MAX, 10_000),
    ):
        edges["bpsOf"].append({"amount": amount, "bps": bps})
    return edges


def _key(case: Case) -> tuple[tuple[str, int], ...]:
    return tuple(case.items())


def _function_cases(name: str, rng: np.random.Generator) -> list[dict[str, Any]]:
    fn, params = FUNCTIONS[name]
    seen: set[tuple[tuple[str, int], ...]] = set()
    inputs: list[Case] = []
    for case in _edges()[name]:
        if _key(case) not in seen:
            seen.add(_key(case))
            inputs.append(case)
    target = TARGETS[name]
    if len(inputs) > target:
        raise AssertionError(f"{name}: {len(inputs)} edge cases exceed target {target}")
    sampler = SAMPLERS[name]
    while len(inputs) < target:
        case = sampler(rng)
        if _key(case) not in seen:
            seen.add(_key(case))
            inputs.append(case)
    return [{"in": case, "out": fn(*(case[p] for p in params))} for case in inputs]


def _hex(rng: np.random.Generator, size: int) -> str:
    return "0x" + rng.bytes(size).hex()


def _commit_cases(rng: np.random.Generator) -> list[dict[str, Any]]:
    zero_addr, ones_addr = "0x" + "00" * 20, "0x" + "ff" * 20
    zero_salt, ones_salt = "0x" + "00" * 32, "0x" + "ff" * 32
    circle, member = _hex(rng, 20), _hex(rng, 20)
    cases: list[dict[str, Any]] = [
        {"circle": zero_addr, "round": 1, "member": zero_addr, "bid": 0, "salt": zero_salt},
        {"circle": ones_addr, "round": 2**32 - 1, "member": ones_addr, "bid": 2**256 - 1,
         "salt": ones_salt},
        {"circle": circle, "round": 1, "member": member, "bid": 0, "salt": _hex(rng, 32)},
        {"circle": circle, "round": 30, "member": member, "bid": C_MAX - 1, "salt": _hex(rng, 32)},
        {"circle": circle, "round": 1, "member": member, "bid": 6 * hm.USDC, "salt": _hex(rng, 32)},
    ]  # fmt: skip
    while len(cases) < COMMIT_HASH_TARGET:
        cases.append(
            {
                "circle": _hex(rng, 20),
                "round": _ri(rng, 1, 30),
                "member": _hex(rng, 20),
                "bid": _ri(rng, 0, C_MAX - 1),
                "salt": _hex(rng, 32),
            }
        )
    return [
        {**case, "hash": commit_hash(case["circle"], case["round"], case["member"],
                                     case["bid"], case["salt"])}
        for case in cases
    ]  # fmt: skip


def generate_vectors(seed: int) -> dict[str, Any]:
    """Build the whole vector document for ``seed`` (deterministic)."""
    rng = np.random.default_rng(seed)
    return {
        "version": VECTOR_VERSION,
        "seed": seed,
        "functions": {name: _function_cases(name, rng) for name in FUNCTIONS},
        "commitHash": _commit_cases(rng),
    }


def render_vectors(doc: dict[str, Any]) -> str:
    """Serialise ``doc``: every integer becomes a decimal string, one case per line."""

    def stringify(value: Any) -> Any:
        if isinstance(value, bool):
            raise TypeError("booleans are not allowed in vectors")
        if isinstance(value, int):
            return str(value)
        if isinstance(value, dict):
            return {k: stringify(v) for k, v in value.items()}
        return value

    def line(case: dict[str, Any]) -> str:
        return json.dumps(stringify(case), separators=(", ", ": "))

    def block(cases: list[dict[str, Any]], indent: str) -> str:
        return "[\n" + ",\n".join(f"{indent}  {line(c)}" for c in cases) + f"\n{indent}]"

    functions = ",\n".join(
        f'    "{name}": {block(cases, "    ")}' for name, cases in doc["functions"].items()
    )
    return (
        "{\n"
        f'  "version": {doc["version"]},\n'
        f'  "seed": {doc["seed"]},\n'
        '  "functions": {\n'
        f"{functions}\n"
        "  },\n"
        f'  "commitHash": {block(doc["commitHash"], "  ")}\n'
        "}\n"
    )


def _cmd_vectors(args: argparse.Namespace) -> int:
    out = Path(args.out)
    doc = generate_vectors(args.seed)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_vectors(doc), encoding="utf-8", newline="\n")
    total = sum(len(v) for v in doc["functions"].values()) + len(doc["commitHash"])
    print(f"wrote {total} cases to {out}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="huisim.cli", description="HuiSafe simulation room")
    sub = parser.add_subparsers(dest="command", required=True)
    p_vec = sub.add_parser("vectors", help="write the shared HuiMath differential vectors")
    p_vec.add_argument("--seed", type=int, default=DEFAULT_SEED)
    p_vec.add_argument("--out", required=True, help="e.g. ../contracts/test/vectors/huimath.json")
    p_vec.set_defaults(func=_cmd_vectors)
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
