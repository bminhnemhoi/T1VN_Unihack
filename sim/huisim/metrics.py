"""Six metrics of docs/08 section 3 plus 95% confidence intervals (section 6, rule 4)."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import numpy as np

from . import math as hm
from .model import CircleOutcome

BOOT_REPS = 400
Z95 = 1.959963984540054


@dataclass(frozen=True)
class DesignMetrics:
    """The six schema fields (``None`` = not applicable) and their intervals."""

    values: dict[str, float | None]
    ci: dict[str, tuple[float, float] | None]


def wilson(successes: int, total: int) -> tuple[float, float]:
    """Wilson 95% interval for a proportion, in percent of ``[0, 1]`` scaled by nothing."""
    if total == 0:
        return (0.0, 0.0)
    p = successes / total
    denom = 1 + Z95**2 / total
    centre = (p + Z95**2 / (2 * total)) / denom
    half = Z95 * math.sqrt(p * (1 - p) / total + Z95**2 / (4 * total**2)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


def _boot_mean(values: np.ndarray, rng: np.random.Generator) -> tuple[float, float]:
    idx = rng.integers(0, len(values), size=(BOOT_REPS, len(values)))
    means = values[idx].mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def _late_matrix(outcomes: Sequence[CircleOutcome]) -> np.ndarray:
    """Circles x late receivers of LossPct, NaN padded (circle-level resampling)."""
    width = max((len(o.late_losses) for o in outcomes), default=0) or 1
    mat = np.full((len(outcomes), width), np.nan)
    for r, o in enumerate(outcomes):
        for c, (loss, paid) in enumerate(o.late_losses):
            mat[r, c] = 100.0 * loss / paid
    return mat


def late_loss_stats(
    outcomes: Sequence[CircleOutcome], rng: np.random.Generator
) -> tuple[float, float, tuple[float, float] | None, tuple[float, float] | None]:
    """Mean, P95 of LossPct over honest late receivers, with circle-level bootstrap CIs."""
    mat = _late_matrix(outcomes)
    flat = mat[~np.isnan(mat)]
    if flat.size == 0:
        return 0.0, 0.0, None, None
    means, p95s = [], []
    for _ in range(BOOT_REPS // 2):
        sample = mat[rng.integers(0, len(mat), size=len(mat))]
        vals = sample[~np.isnan(sample)]
        if vals.size:
            means.append(vals.mean())
            p95s.append(np.percentile(vals, 95))
    ci_m = (float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5)))
    ci_p = (float(np.percentile(p95s, 2.5)), float(np.percentile(p95s, 97.5)))
    return float(flat.mean()), float(np.percentile(flat, 95)), ci_m, ci_p


def compute_metrics(outcomes: Sequence[CircleOutcome], rng: np.random.Generator) -> DesignMetrics:
    """Aggregate the outcomes of one design into the six schema fields."""
    mean_loss, p95_loss, ci_mean, ci_p95 = late_loss_stats(outcomes, rng)
    n = len(outcomes)
    fails = sum(o.honest_short for o in outcomes)
    unc = np.array([o.uncovered_end / hm.USDC for o in outcomes])
    with_bond = [o for o in outcomes if o.bond0 > 0]
    bond_use = np.array([100.0 * o.bond_peak_used / o.bond0 for o in with_bond])
    net = np.array([100.0 * o.organizer_net / o.bond0 for o in with_bond])
    values: dict[str, float | None] = {
        "lateReceiverExpectedLossPct": mean_loss,
        "lateReceiverP95LossPct": p95_loss,
        "circleFailureProb": fails / n,
        "uncoveredMeanUsdc": float(unc.mean()),
        "bondUsageMeanPct": float(bond_use.mean()) if len(with_bond) else None,
        "organizerNetReturnPct": float(net.mean()) if len(with_bond) else None,
    }
    ci: dict[str, tuple[float, float] | None] = {
        "lateReceiverExpectedLossPct": ci_mean,
        "lateReceiverP95LossPct": ci_p95,
        "circleFailureProb": wilson(fails, n),
        "uncoveredMeanUsdc": _boot_mean(unc, rng),
        "bondUsageMeanPct": _boot_mean(bond_use, rng) if len(with_bond) else None,
        "organizerNetReturnPct": _boot_mean(net, rng) if len(with_bond) else None,
    }
    return DesignMetrics(values, ci)


def diagnostics(outcomes: Sequence[CircleOutcome]) -> dict[str, Any]:
    """Default patterns and how often ``uncovered`` appears with them (INV-08 reading aid)."""
    n = len(outcomes)
    dead_rounds = [{r for _, r, dead in o.defaults if dead} for o in outcomes]
    n_dead = [sum(1 for _, _, dead in o.defaults if dead) for o in outcomes]
    seq = [i for i in range(n) if len(dead_rounds[i]) >= 2]
    sim_ = [i for i in range(n) if n_dead[i] >= 2 and len(dead_rounds[i]) == 1]
    one = [i for i in range(n) if n_dead[i] == 1]

    def group(idx: list[int]) -> dict[str, float | int | None]:
        if not idx:
            return {"circles": 0, "uncoveredShare": None, "uncoveredMeanUsdc": None}
        hit = sum(1 for i in idx if outcomes[i].uncovered_created > 0)
        mean = sum(outcomes[i].uncovered_created for i in idx) / len(idx) / hm.USDC
        return {"circles": len(idx), "uncoveredShare": hit / len(idx), "uncoveredMeanUsdc": mean}

    return {
        "circles": n,
        "withAnyDefault": sum(1 for o in outcomes if o.defaults) / n,
        "withUncovered": sum(1 for o in outcomes if o.uncovered_created > 0) / n,
        "deadDefaultsOneReceiver": group(one),
        "deadDefaultsSameRound": group(sim_),
        "deadDefaultsDifferentRounds": group(seq),
    }
