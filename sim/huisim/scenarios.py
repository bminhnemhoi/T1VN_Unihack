"""Scenario files (docs/05 section 11.1) and the Klonner & Rai calibration (docs/08 section 2.2).

All behavioural parameters are ASSUMPTIONS for an offline simulation, never measurements.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCENARIO_DIR = Path(__file__).resolve().parents[1] / "scenarios"
KNOWN_DESIGNS = ("traditional", "naive_onchain", "huisafe")
KNOWN_BID_MODELS = ("uniform_fraction_of_cap",)

CAP_BPS = 2000  # ND 19 Article 21 cap (factory maxCapBps)
LATE_RATE_BPS = 1000  # ND 19 Article 22 clause 1 (factory lateRateBps)


class ScenarioError(ValueError):
    """Raised when a scenario file violates the docs/05 section 11.1 schema."""


@dataclass(frozen=True)
class HuisafeCfg:
    alpha_bps: int
    bond_ratio: float
    reserve_bps: int
    fee_bps: int


@dataclass(frozen=True)
class TraditionalCfg:
    abscond_prob: float
    covers_defaults: bool
    capacity_ratio: float


@dataclass(frozen=True)
class Behaviour:
    dead_early: float
    dead_late: float
    live: float
    bid_model: str
    shock_prob: float
    shock_multiplier: float


@dataclass(frozen=True)
class Scenario:
    id: str
    seed: int
    circles: int
    n: int
    c: int  # contribution in whole USDC
    period_days: int
    designs: tuple[str, ...]
    huisafe: HuisafeCfg
    traditional: TraditionalCfg
    behaviour: Behaviour


def _prob(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ScenarioError(f"{name} must be a number")
    if not 0.0 <= float(value) <= 1.0:
        raise ScenarioError(f"{name} must be in [0, 1], got {value}")
    return float(value)


def _int(value: Any, name: str, lo: int, hi: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ScenarioError(f"{name} must be an integer")
    if not lo <= value <= hi:
        raise ScenarioError(f"{name} must be in [{lo}, {hi}], got {value}")
    return value


def parse_scenario(raw: dict[str, Any]) -> Scenario:
    """Validate ``raw`` (parsed JSON) and build a ``Scenario``."""
    try:
        hs, tr, bh = raw["huisafe"], raw["traditional"], raw["behaviour"]
        designs = tuple(raw["designs"])
        if not designs or any(d not in KNOWN_DESIGNS for d in designs):
            raise ScenarioError(f"designs must be a non-empty subset of {KNOWN_DESIGNS}")
        bond_ratio = float(hs["bondRatio"])
        if not 0.0 <= bond_ratio <= 2.0:
            raise ScenarioError("huisafe.bondRatio must be in [0, 2]")
        bid_model = str(bh["bidModel"])
        if bid_model not in KNOWN_BID_MODELS:
            raise ScenarioError(f"bidModel must be one of {KNOWN_BID_MODELS}")
        mult = float(bh["correlatedShock"]["multiplier"])
        if mult < 1.0:
            raise ScenarioError("correlatedShock.multiplier must be >= 1")
        return Scenario(
            id=str(raw["id"]),
            seed=_int(raw["seed"], "seed", 0, 2**63 - 1),
            circles=_int(raw["circles"], "circles", 1, 10**7),
            n=_int(raw["N"], "N", 3, 30),
            c=_int(raw["C"], "C", 1, 10_000),
            period_days=_int(raw["periodDays"], "periodDays", 1, 31),
            designs=designs,
            huisafe=HuisafeCfg(
                alpha_bps=_int(hs["alphaBps"], "huisafe.alphaBps", 0, 10_000),
                bond_ratio=bond_ratio,
                reserve_bps=_int(hs["reserveBps"], "huisafe.reserveBps", 0, 300),
                fee_bps=_int(hs["feeBps"], "huisafe.feeBps", 0, 300),
            ),
            traditional=TraditionalCfg(
                abscond_prob=_prob(
                    tr["organizerAbscondProbPerRound"], "organizerAbscondProbPerRound"
                ),
                covers_defaults=bool(tr["organizerCoversDefaults"]),
                capacity_ratio=float(tr["organizerCapacityRatio"]),
            ),
            behaviour=Behaviour(
                dead_early=_prob(bh["deadDefaultHazardPerRound"]["early"], "hazard.early"),
                dead_late=_prob(bh["deadDefaultHazardPerRound"]["late"], "hazard.late"),
                live=_prob(bh["liveDefaultHazardPerRound"], "liveDefaultHazardPerRound"),
                bid_model=bid_model,
                shock_prob=_prob(bh["correlatedShock"]["prob"], "correlatedShock.prob"),
                shock_multiplier=mult,
            ),
        )
    except KeyError as exc:
        raise ScenarioError(f"missing field {exc}") from exc


def scenario_path(name_or_path: str) -> Path:
    """``baseline`` -> ``sim/scenarios/baseline.json``; an existing path is used as is."""
    direct = Path(name_or_path)
    if direct.suffix == ".json" and direct.is_file():
        return direct
    return SCENARIO_DIR / f"{name_or_path}.json"


def load_scenario(name_or_path: str) -> tuple[Scenario, str]:
    """Return the validated scenario and the sha256 of its file."""
    path = scenario_path(name_or_path)
    data = path.read_bytes()
    return parse_scenario(json.loads(data)), hashlib.sha256(data).hexdigest()


def calibrate_kr(n: int, p_early: float, p_late: float) -> tuple[float, float]:
    """Per-round hazards from lifetime default rates (docs/08 section 2.2).

    ``h = 1 - (1 - p) ** (1 / m)`` where m is the mean number of rounds still to pay for
    receivers in the early half (k <= n // 2) or the late half (k > n // 2). Receiver k
    still pays n - k rounds.
    """
    half = n // 2
    m_early = sum(n - k for k in range(1, half + 1)) / half
    m_late = sum(n - k for k in range(half + 1, n + 1)) / (n - half)
    return 1 - (1 - p_early) ** (1 / m_early), 1 - (1 - p_late) ** (1 / m_late)
