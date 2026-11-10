"""Designs, bid model and stress default plans (docs/08 sections 2.4 to 2.6).

Everything here is an offline-simulation assumption, never part of the product.
"""

from __future__ import annotations

from dataclasses import dataclass

from . import math as hm
from .scenarios import Scenario

DESIGN_LABELS_VI = {
    "traditional": "Hụi truyền thống",
    "naive_onchain": "On-chain ngây thơ",
    "huisafe": "HụiSafe",
}


@dataclass(frozen=True)
class Design:
    """One accounting regime. ``bond_bps`` is the bond (HụiSafe) or the organizer's
    cover budget (traditional) as basis points of O_max."""

    name: str
    alpha_bps: int
    bond_bps: int
    reserve_bps: int
    fee_bps: int
    forfeit_fee: bool  # fee sits in escrow and is lost in a round with a new default
    abscond_prob: float  # per-round probability that the organizer runs off with the pot
    share_bps: int = 0  # phi (docs/03 section 2.7): 0 keeps the fixed fee ``fee_bps`` x pot


def build_design(name: str, sc: Scenario) -> Design:
    """Build the design ``name`` for scenario ``sc`` (docs/08 section 2.6)."""
    if name == "huisafe":
        h = sc.huisafe
        return Design(
            name=name,
            alpha_bps=h.alpha_bps,
            bond_bps=round(h.bond_ratio * hm.BPS),
            reserve_bps=h.reserve_bps,
            fee_bps=h.fee_bps,
            forfeit_fee=True,
            abscond_prob=0.0,
            share_bps=h.share_bps,
        )
    if name == "naive_onchain":
        return Design(name, 0, 0, 0, 0, False, 0.0)
    if name == "traditional":
        t = sc.traditional
        budget_bps = round(t.capacity_ratio * hm.BPS) if t.covers_defaults else 0
        return Design(name, 0, budget_bps, 0, sc.huisafe.fee_bps, False, t.abscond_prob)
    raise ValueError(f"unknown design {name!r}")


class UniformFractionOfCap:
    """``b = floor(u * cap)`` with u ~ U(0, 1) (docs/08 section 2.4)."""

    def bid(self, cap: int, u: float) -> int:
        return int(u * cap)

    def bid_for(self, member: int, round_: int, cap: int, u: float) -> int:
        return self.bid(cap, u)


class ScriptedBids:
    """Deterministic bids for the organizer scenarios (no randomness, docs/08 section 2.7).

    ``order[k]`` is the member who takes round k: only that member bids ``fraction_bps`` of the
    ceiling; everybody else bids 0, so the smallest joinIndex among the live members wins a
    tie. Rounds absent from ``order`` have nobody bidding (the smallest live joinIndex takes
    the pot).
    """

    def __init__(self, order: dict[int, int], fraction_bps: int) -> None:
        self.order, self.fraction_bps = dict(order), fraction_bps

    def bid_for(self, member: int, round_: int, cap: int, u: float) -> int:
        return cap * self.fraction_bps // hm.BPS if self.order.get(round_) == member else 0


PLAN_KINDS = ("fixed", "peak_all_at_once", "peak_sequential", "sequential_all")


@dataclass(frozen=True)
class DefaultPlan:
    """Deterministic default schedule replacing the hazards (stress tests, INV-08).

    Decided when a member receives its pot in round r (draw ``u``):

    - ``fixed``: ``fixed`` maps joinIndex -> round of default (worked example, tests).
    - ``peak_all_at_once``: with probability q, a receiver of the first m = N // 2
      rounds defaults at round m + 1 together with the others (the INV-08 premise).
    - ``peak_sequential``: the same receivers, but each defaults at round r + 1.
    - ``sequential_all``: with probability q, any receiver defaults at round r + 1.
    """

    kind: str
    q: float = 0.0
    fixed: tuple[tuple[int, int], ...] = ()

    def __post_init__(self) -> None:
        if self.kind not in PLAN_KINDS:
            raise ValueError(f"unknown plan kind {self.kind!r}")

    def default_round(self, n: int, receipt_round: int, u: float) -> int | None:
        """Round at which a receiver of round ``receipt_round`` defaults, or ``None``."""
        if self.kind == "fixed" or u >= self.q:
            return None
        half = n // 2
        if self.kind == "sequential_all":
            target = receipt_round + 1
        elif receipt_round > half:
            return None
        elif self.kind == "peak_all_at_once":
            target = half + 1
        else:
            target = receipt_round + 1
        return target if target <= n else None
