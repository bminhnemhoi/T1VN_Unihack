"""Organizer scenarios of v1.2 (docs/08 section 2.7): ``organizer_economics``, ``organizer_sybil``.

Both are deterministic: the bids are scripted (a fixed fraction of the ceiling, or the ceiling)
and the defaults come from a fixed schedule, so nothing is drawn at random and the seed is only
recorded. They run the SAME circle model as the baseline (``huisim.model``), so every number goes
through ``huisim.math`` and the ledger check of the model. ``tools/hui-economics`` is the
calculator these results are compared against (tests/test_organizer.py).

All behavioural numbers (default hazards, the share of the ceiling people bid) are ASSUMPTIONS.
"""

from __future__ import annotations

import hashlib
import json
import platform
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from . import math as hm
from .experiments import FORMAT_DIGITS, git_commit
from .model import CircleOutcome, Draws, simulate_circle
from .policies import DefaultPlan, ScriptedBids, build_design
from .scenarios import (
    SCENARIO_DIR,
    Behaviour,
    HuisafeCfg,
    Scenario,
    ScenarioError,
    TraditionalCfg,
    scenario_path,
)

KINDS = ("organizer_economics", "organizer_sybil")
USDC = hm.USDC


def raw_kind(name_or_path: str) -> str | None:
    """The ``kind`` of a scenario file, or ``None`` for the baseline schema (docs/05 11.1)."""
    path = scenario_path(name_or_path)
    if not path.is_file():
        return None
    kind = json.loads(path.read_bytes()).get("kind")
    return kind if kind in KINDS else None


def _round(x: float | None) -> float | None:
    return None if x is None else round(x, FORMAT_DIGITS)


def _usdc(units: int) -> float:
    return round(units / USDC, FORMAT_DIGITS)


def _scenario(
    n: int,
    c_usdc: int,
    period_days: int,
    alpha: int,
    bond_bps: int,
    fee: int,
    share: int,
    reserve: int,
) -> Scenario:
    """One HụiSafe circle with no random behaviour; the bond is ``bond_bps`` of O_max."""
    return Scenario(
        id="organizer",
        seed=0,
        circles=1,
        n=n,
        c=c_usdc,
        period_days=period_days,
        designs=("huisafe",),
        huisafe=HuisafeCfg(
            alpha_bps=alpha,
            bond_ratio=bond_bps / hm.BPS,
            reserve_bps=reserve,
            fee_bps=fee,
            share_bps=share,
        ),
        traditional=TraditionalCfg(0.0, True, 0.3),
        behaviour=Behaviour(0.0, 0.0, 0.0, "uniform_fraction_of_cap", 0.0, 1.0),
    )


def _null_draws(n: int) -> Draws:
    """Draws that never trigger anything: the scripted bids and the fixed plan decide everything."""
    ones = [[1.0] * n for _ in range(n + 1)]
    return Draws(default=ones, bid=ones, shock=[1.0] * (n + 1), abscond=[1.0] * (n + 1))


def _run(
    sc: Scenario, order: dict[int, int], bid_bps: int, defaults: tuple[tuple[int, int], ...] = ()
) -> CircleOutcome:
    plan = DefaultPlan("fixed", fixed=defaults) if defaults else None
    design = build_design("huisafe", sc)
    return simulate_circle(sc, design, _null_draws(sc.n), plan, ScriptedBids(order, bid_bps))


def _org_out(o: CircleOutcome) -> int:
    """What the organizer gets back from the circle: fees plus the bond that was not used."""
    return o.fees_to_organizer + o.bond_returned


# --- organizer_economics -----------------------------------------------------------------


def economics_cell(
    n: int,
    period_days: int,
    *,
    c_usdc: int,
    alpha: int,
    fee: int,
    share: int,
    reserve: int,
    bid_pct: int,
    hazard_early: float,
    hazard_late: float,
    hazard_scales: tuple[float, ...],
) -> dict[str, Any]:
    """Organizer return and every seat's net for one circle shape (receiver k = member k - 1).

    Each receiver k < N stops paying right after receiving with the hazard of its half (the
    assumed Klonner & Rai lifetime rates, applied once). The expected loss is the sum over k of
    hazard x (organizer's take if nobody defaults - organizer's take if only k defaults).
    """
    bond_bps = hm.BPS - alpha  # B_min = (1 - alpha) * O_max, the CI = 100% bond (ADR-22)
    sc = _scenario(n, c_usdc, period_days, alpha, bond_bps, fee, share, reserve)
    order = {k: k - 1 for k in range(1, n + 1)}
    clean = _run(sc, order, bid_pct * 100)
    clean_take = _org_out(clean)
    lost = []
    for k in range(1, n):
        hit = _run(sc, order, bid_pct * 100, defaults=((k - 1, k + 1),))
        h = hazard_early if k <= n // 2 else hazard_late
        lost.append((h, clean_take - _org_out(hit)))
    years = n * period_days / 365
    gross = clean.fees_to_organizer
    nets = [clean.got[i] - clean.contributed[i] for i in range(n)]
    statutory_ok = True
    for k, r in enumerate(clean.rounds, start=1):
        payers = n - k
        room = hm.commission_room(
            hm.max_bid(2000, n, k, sc.c * USDC, period_days * hm.DAY, payers), payers
        )
        statutory_ok &= r.bid * payers + r.fee <= room
    returns: dict[str, float | None] = {}
    for scale in hazard_scales:
        loss = sum(h * scale * d for h, d in lost)
        returns[f"{scale:g}"] = _round(100 * (gross - loss) / clean.bond0 / years)
    full_loss = sum(h * d for h, d in lost)
    third = nets[n - max(1, n // 3) :]
    return {
        "periodDays": period_days,
        "members": n,
        "shareBps": share,
        "feeBps": fee,
        "bondUsdc": _usdc(clean.bond0),
        "grossFeeUsdc": _usdc(gross),
        "expectedLossUsdc": _round(full_loss / USDC),
        "netAfterRiskUsdc": _round((gross - full_loss) / USDC),
        "annualReturnPctByHazardScale": returns,
        "seatNetUsdc": [_usdc(x) for x in nets],
        "firstSeatNetUsdc": _usdc(nets[0]),
        "lastSeatNetUsdc": _usdc(nets[-1]),
        "lastThirdNeverLoses": all(x >= 0 for x in third),
        "insideInterestCap": bool(statutory_ok),
    }


def run_economics(raw: dict[str, Any]) -> dict[str, Any]:
    risk = raw["risk"]
    cells = []
    for period in raw["periodDays"]:
        for n in raw["members"]:
            for cfg in raw["schedules"]:
                cell = economics_cell(
                    int(n),
                    int(period),
                    c_usdc=int(raw["C"]),
                    alpha=int(raw["alphaBps"]),
                    fee=int(cfg["feeBps"]),
                    share=int(cfg["commissionShareBps"]),
                    reserve=int(raw["reserveBps"]),
                    bid_pct=int(raw["bidPctOfCap"]),
                    hazard_early=float(risk["early"]),
                    hazard_late=float(risk["late"]),
                    hazard_scales=tuple(float(x) for x in risk["scales"]),
                )
                cells.append({"schedule": cfg["label"], **cell})
    return {
        "scenario": raw["id"],
        "C": raw["C"],
        "alphaBps": raw["alphaBps"],
        "reserveBps": raw["reserveBps"],
        "bidPctOfCap": raw["bidPctOfCap"],
        "risk": risk,
        "cells": cells,
    }


# --- organizer_sybil ---------------------------------------------------------------------


def sybil_case(raw: dict[str, Any], wallets: int, bond_bps: int) -> dict[str, Any]:
    """The organizer wins round 1 (and 2) with its own wallets at the ceiling, then stops paying.

    Members 0..wallets-1 are the organizer's; they default at the start of the round after they
    received. Everybody else is honest and bids 0, so the smallest joinIndex takes the later rounds.
    """
    n = int(raw["N"])
    sc = _scenario(
        n, int(raw["C"]), int(raw["periodDays"]), int(raw["alphaBps"]), bond_bps,
        int(raw["feeBps"]), 0, int(raw["reserveBps"]),
    )  # fmt: skip
    order = {k: k - 1 for k in range(1, wallets + 1)}
    defaults = tuple((i, i + 2) for i in range(wallets))
    out = _run(sc, order, hm.BPS, defaults)
    mine = range(wallets)
    wallet_net = sum(out.got[i] - out.contributed[i] for i in mine)
    organizer_total = wallet_net + _org_out(out) - out.bond0
    last = out.rounds[-1]
    honest_last = out.rounds[-1].winner
    full_pot = (n - 1) * sc.c * USDC  # what a clean last round pays before fee and reserve
    normal_pot = (
        full_pot
        - hm.bps_of(full_pot, sc.huisafe.fee_bps)
        - hm.bps_of(full_pot, sc.huisafe.reserve_bps)
    )
    return {
        "wallets": wallets,
        "bondUsdc": _usdc(out.bond0),
        "bondBps": bond_bps,
        "coverageBps": hm.coverage_index_bps(sc.huisafe.alpha_bps, out.bond0, 0, n, sc.c * USDC),
        "organizerNetUsdc": _usdc(organizer_total),
        "walletsNetUsdc": _usdc(wallet_net),
        "uncoveredUsdc": _usdc(out.uncovered_created),
        "lastReceiverIsHonest": honest_last >= wallets,
        "lastReceiverPayoutUsdc": _usdc(last.payout),
        "lastReceiverNormalUsdc": _usdc(normal_pot),
        "round1PayoutUsdc": _usdc(out.rounds[0].payout),
        "round2PayoutUsdc": _usdc(out.rounds[1].payout) if wallets == 2 else None,
    }  # fmt: skip


def run_sybil(raw: dict[str, Any]) -> dict[str, Any]:
    cases = []
    for cfg in raw["cases"]:
        cases.append(
            {"label": cfg["label"], **sybil_case(raw, int(cfg["wallets"]), int(cfg["bondBps"]))}
        )
    return {
        "scenario": raw["id"],
        "N": raw["N"],
        "C": raw["C"],
        "alphaBps": raw["alphaBps"],
        "cases": cases,
    }


# --- entry point -------------------------------------------------------------------------


def run_organizer(
    name_or_path: str, out_dir: Path, seed: int | None = None, charts: bool = True
) -> dict[str, Any]:
    """Run an organizer scenario file and write ``<id>.json``, ``<id>.meta.json`` and the PNG."""
    path = scenario_path(name_or_path)
    data = path.read_bytes()
    raw = json.loads(data)
    kind = raw.get("kind")
    if kind not in KINDS:
        raise ScenarioError(f"kind must be one of {KINDS}")
    start = time.perf_counter()
    doc = run_economics(raw) if kind == "organizer_economics" else run_sybil(raw)
    doc = {"kind": kind, "generatedAt": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"), **doc}
    out_dir.mkdir(parents=True, exist_ok=True)
    sid = str(raw["id"])
    if charts:
        from .charts import plot_organizer_economics, plot_organizer_sybil

        png = out_dir / f"{sid}.png"
        (plot_organizer_economics if kind == "organizer_economics" else plot_organizer_sybil)(
            doc, png
        )
        doc["charts"] = [f"outputs/{sid}.png"]
    (out_dir / f"{sid}.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    meta = {
        "scenario": sid,
        "kind": kind,
        "seed": seed if seed is not None else raw.get("seed"),
        "randomness": "none: scripted bids and fixed default schedule; the seed is recorded only",
        "scenarioSha256": hashlib.sha256(data).hexdigest(),
        "gitCommit": git_commit(),
        "python": platform.python_version(),
        "numpy": np.__version__,
        "elapsedSeconds": round(time.perf_counter() - start, 2),
        "assumptions": raw.get("assumptions", ""),
    }
    (out_dir / f"{sid}.meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    return doc


__all__ = ["KINDS", "SCENARIO_DIR", "economics_cell", "raw_kind", "run_organizer", "sybil_case"]
