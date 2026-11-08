"""Test helpers."""

from __future__ import annotations

import dataclasses

from huisim.scenarios import Scenario


def with_hazards(
    sc: Scenario, dead: float, live: float, shock_prob: float = 0.0, circles: int = 300
) -> Scenario:
    """``sc`` with the same per-round hazard for early and late receivers."""
    beh = dataclasses.replace(
        sc.behaviour, dead_early=dead, dead_late=dead, live=live, shock_prob=shock_prob
    )
    return dataclasses.replace(sc, behaviour=beh, circles=circles)
