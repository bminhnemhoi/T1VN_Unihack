"""Run a scenario (E1) and the INV-08 default-timing experiment; write the outputs."""

from __future__ import annotations

import dataclasses
import json
import platform
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from . import math as hm
from .metrics import DesignMetrics, compute_metrics, diagnostics
from .model import CircleOutcome, circle_streams, draw_circle, simulate_circle
from .policies import DefaultPlan, build_design
from .scenarios import Scenario

SCHEMA_FIELDS = (
    "lateReceiverExpectedLossPct",
    "lateReceiverP95LossPct",
    "circleFailureProb",
    "uncoveredMeanUsdc",
    "bondUsageMeanPct",
    "organizerNetReturnPct",
)
FORMAT_DIGITS = 6


def simulate_all(
    sc: Scenario,
    designs: tuple[str, ...] | None = None,
    plan: DefaultPlan | None = None,
    huisafe_bond: float | None = None,
) -> dict[str, list[CircleOutcome]]:
    """Run ``sc.circles`` circles; the designs share each circle's draws (docs/08 section 6)."""
    if huisafe_bond is not None:
        sc = dataclasses.replace(
            sc, huisafe=dataclasses.replace(sc.huisafe, bond_ratio=huisafe_bond)
        )
    names = designs or sc.designs
    built = {name: build_design(name, sc) for name in names}
    result: dict[str, list[CircleOutcome]] = {name: [] for name in names}
    for rng in circle_streams(sc.seed, sc.circles):
        draws = draw_circle(rng, sc.n)
        for name, design in built.items():
            result[name].append(simulate_circle(sc, design, draws, plan))
    return result


def _round(x: float | None) -> float | None:
    return None if x is None else round(x, FORMAT_DIGITS)


def result_doc(
    sc: Scenario, metrics: dict[str, DesignMetrics], generated_at: str
) -> dict[str, Any]:
    """The docs/05 section 11.2 document: nothing but the six fields per design."""
    return {
        "scenario": sc.id,
        "generatedAt": generated_at,
        "results": [
            {"design": d, **{f: _round(m.values[f]) for f in SCHEMA_FIELDS}}
            for d, m in metrics.items()
        ],
        "charts": [f"outputs/{sc.id}_loss.png"],
    }


def git_commit() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True
        )
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def meta_doc(
    sc: Scenario,
    sha: str,
    elapsed: float,
    metrics: dict[str, DesignMetrics],
    diag: dict[str, Any],
) -> dict[str, Any]:
    """Everything the schema has no room for (docs/08 section 6, rule 4)."""
    return {
        "scenario": sc.id,
        "seed": sc.seed,
        "circles": sc.circles,
        "scenarioSha256": sha,
        "gitCommit": git_commit(),
        "python": platform.python_version(),
        "numpy": np.__version__,
        "elapsedSeconds": round(elapsed, 2),
        "ci95": {
            d: {
                f: (None if ci is None else [_round(ci[0]), _round(ci[1])])
                for f, ci in m.ci.items()
            }
            for d, m in metrics.items()
        },
        "diagnostics": diag,
        "assumptions": "Behavioural parameters are assumptions (docs/08 section 9), "
        "not measurements.",
    }


def run_scenario(sc: Scenario, sha: str, out_dir: Path, charts: bool = True) -> dict[str, Any]:
    """E1: run, aggregate, write ``<id>.json``, ``<id>.meta.json`` and the PNG."""
    start = time.perf_counter()
    outcomes = simulate_all(sc)
    boot_rng = np.random.default_rng([sc.seed, 99])
    metrics = {d: compute_metrics(o, boot_rng) for d, o in outcomes.items()}
    diag = {d: diagnostics(o) for d, o in outcomes.items()}
    elapsed = time.perf_counter() - start
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = result_doc(sc, metrics, datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))
    (out_dir / f"{sc.id}.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    meta = meta_doc(sc, sha, elapsed, metrics, diag)
    (out_dir / f"{sc.id}.meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    if charts:
        from .charts import plot_loss

        plot_loss(sc, metrics, out_dir / f"{sc.id}_loss.png")
    return doc


# --- INV-08: sequential defaults versus a same-round shock --------------------------------

INV08_PLANS = ("peak_all_at_once", "peak_sequential", "sequential_all")
INV08_QS = (0.25, 0.5, 1.0)
INV08_BONDS = (0.8, 1.2, 1.6, 2.0)


def _inv08_row(sc: Scenario, outs: list[CircleOutcome], rng: np.random.Generator) -> dict[str, Any]:
    m = compute_metrics(outs, rng)
    n = len(outs)
    return {
        "uncoveredShare": sum(1 for o in outs if o.uncovered_created > 0) / n,
        "uncoveredCreatedMeanUsdc": sum(o.uncovered_created for o in outs) / n / hm.USDC,
        "uncoveredEndMeanUsdc": m.values["uncoveredMeanUsdc"],
        "lateReceiverExpectedLossPct": m.values["lateReceiverExpectedLossPct"],
        "lateReceiverP95LossPct": m.values["lateReceiverP95LossPct"],
        "circleFailureProb": m.values["circleFailureProb"],
        "bondUsageMeanPct": m.values["bondUsageMeanPct"],
    }


def run_inv08(sc: Scenario, sha: str, out_dir: Path, charts: bool = True) -> dict[str, Any]:
    """Only receivers default (no hazards), CI = 100% unless the bond is raised.

    Compares the INV-08 premise (all at once at the peak) with defaults spread over rounds.
    """
    start = time.perf_counter()
    rng = np.random.default_rng([sc.seed, 98])
    rows: list[dict[str, Any]] = []
    for kind in INV08_PLANS:
        for q in INV08_QS:
            plan = DefaultPlan(kind, q)
            outs = simulate_all(sc, ("naive_onchain", "huisafe"), plan)
            for design, o in outs.items():
                rows.append(
                    {
                        "plan": kind,
                        "q": q,
                        "design": design,
                        "bondRatio": (sc.huisafe.bond_ratio if design == "huisafe" else 0.0),
                        **_inv08_row(sc, o, rng),
                    }
                )
    for bond in INV08_BONDS[1:]:  # how much bond does the spread-out case need?
        plan = DefaultPlan("sequential_all", 1.0)
        outs = simulate_all(sc, ("huisafe",), plan, huisafe_bond=bond)
        rows.append(
            {
                "plan": "sequential_all",
                "q": 1.0,
                "design": "huisafe",
                "bondRatio": bond,
                **_inv08_row(sc, outs["huisafe"], rng),
            }
        )
    o_max = hm.max_exposure(sc.n, sc.c * hm.USDC)
    worst_total = sum((sc.n - r) for r in range(1, sc.n)) * sc.c * hm.USDC
    doc: dict[str, Any] = {
        "experiment": "inv08",
        "scenario": sc.id,
        "seed": sc.seed,
        "circles": sc.circles,
        "N": sc.n,
        "C": sc.c,
        "alphaBps": sc.huisafe.alpha_bps,
        "generatedAt": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "plans": {
            "peak_all_at_once": (
                "fraction q of the first N//2 receivers default together at round N//2 + 1"
            ),
            "peak_sequential": "the same receivers, each defaults the round after it received",
            "sequential_all": "fraction q of all receivers default the round after they received",
        },
        "maxExposureUsdc": o_max / hm.USDC,
        "worstCaseSequentialShortfallUsdc": worst_total / hm.USDC,
        "rows": [
            {k: (_round(v) if isinstance(v, float) else v) for k, v in r.items()} for r in rows
        ],
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "inv08.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    meta = {
        "seed": sc.seed,
        "circles": sc.circles,
        "scenarioSha256": sha,
        "gitCommit": git_commit(),
        "elapsedSeconds": round(time.perf_counter() - start, 2),
    }
    (out_dir / "inv08.meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    if charts:
        from .charts import plot_inv08

        plot_inv08(doc, out_dir / "inv08_uncovered.png")
    return doc
