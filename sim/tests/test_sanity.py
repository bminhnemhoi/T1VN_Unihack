"""Model sanity checks S1 to S8 of docs/08 section 7, plus INV-08 timing."""

from __future__ import annotations

import dataclasses

import numpy as np
from helpers import with_hazards

from huisim import math as hm
from huisim.experiments import simulate_all
from huisim.metrics import compute_metrics
from huisim.policies import DefaultPlan
from huisim.scenarios import Scenario

ALL = ("traditional", "naive_onchain", "huisafe")


def _no_abscond(sc: Scenario) -> Scenario:
    return dataclasses.replace(
        sc, traditional=dataclasses.replace(sc.traditional, abscond_prob=0.0)
    )


def _mean_loss(outs: list) -> float:  # type: ignore[type-arg]
    return (
        compute_metrics(outs, np.random.default_rng(0)).values["lateReceiverExpectedLossPct"] or 0.0
    )


def test_s1_nobody_defaults_no_loss_and_ledger_empty(base: Scenario) -> None:
    sc = _no_abscond(with_hazards(base, 0.0, 0.0))
    for name, outs in simulate_all(sc).items():  # a broken ledger raises inside the model
        assert all(o.uncovered_end == 0 and not o.honest_short for o in outs), name
        assert all(not o.defaults and len(o.rounds) == sc.n for o in outs), name


def test_s5_total_holdback_is_alpha_times_exposure(base: Scenario) -> None:
    sc = _no_abscond(with_hazards(base, 0.0, 0.0, circles=20))
    c = sc.c * hm.USDC
    for o in simulate_all(sc, ("huisafe",))["huisafe"]:
        for m in range(1, sc.n + 1):
            want = hm.bps_of(hm.exposure(sc.n, m, c), sc.huisafe.alpha_bps)
            assert abs(o.holdback_after[m - 1] - want) <= sc.n, (m, o.holdback_after[m - 1], want)


def test_s2_ci_100_same_round_shock_leaves_nothing_uncovered(base: Scenario) -> None:
    # CI = alpha + bondRatio = 100% and every receiver of the first half defaults together.
    assert base.huisafe.alpha_bps + round(base.huisafe.bond_ratio * 10_000) >= 10_000
    for q in (0.25, 1.0):
        outs = simulate_all(
            with_hazards(base, 0.0, 0.0), ("huisafe",), DefaultPlan("peak_all_at_once", q)
        )
        assert any(o.defaults for o in outs["huisafe"])
        assert all(o.uncovered_created == 0 and not o.honest_short for o in outs["huisafe"])


def test_inv08_sequential_defaults_can_leave_uncovered_at_ci_100(base: Scenario) -> None:
    # Documented limit: CI = 100% only covers the same-round peak (user decision 08/11).
    sc = with_hazards(base, 0.0, 0.0)
    outs = simulate_all(sc, ("huisafe",), DefaultPlan("sequential_all", 1.0))["huisafe"]
    assert all(o.uncovered_created > 0 for o in outs)
    assert _mean_loss(outs) > 0
    # ...and a bond large enough for the spread-out worst case removes it.
    big = simulate_all(sc, ("huisafe",), DefaultPlan("sequential_all", 1.0), huisafe_bond=2.0)
    assert all(o.uncovered_created == 0 for o in big["huisafe"])


def test_s3_naive_loses_and_it_lands_on_late_receivers(base: Scenario) -> None:
    sc = _no_abscond(with_hazards(base, 0.02, 0.0, circles=500))
    outs = simulate_all(sc, ("naive_onchain",))["naive_onchain"]
    assert _mean_loss(outs) > 0
    late = [100 * a / b for o in outs for a, b in o.late_losses]
    # early receivers only get short when somebody defaulted before them; compare by round
    early = [
        100 * o.uncovered_left[i] / o.contributed[i]
        for o in outs
        for i in range(sc.n)
        if 0 < o.receipt_round[i] <= sc.n // 2
        and not any(m == i for m, _, _ in o.defaults)
        and o.contributed[i]
    ]
    assert np.mean(late) > np.mean(early)


def test_s4_more_bond_never_increases_loss(base: Scenario) -> None:
    sc = _no_abscond(with_hazards(base, 0.02, 0.0, circles=400))
    losses = [
        _mean_loss(simulate_all(sc, ("huisafe",), None, huisafe_bond=b)["huisafe"])
        for b in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)
    ]
    assert all(a >= b - 1e-12 for a, b in zip(losses, losses[1:], strict=False)), losses


def test_s7_traditional_with_enough_budget_and_no_abscond(base: Scenario) -> None:
    trad = dataclasses.replace(
        base.traditional, abscond_prob=0.0, covers_defaults=True, capacity_ratio=1.0
    )
    sc = dataclasses.replace(with_hazards(base, 0.0, 0.0), traditional=trad)
    outs = simulate_all(sc, ("traditional",), DefaultPlan("peak_all_at_once", 1.0))["traditional"]
    assert all(o.uncovered_created == 0 and not o.honest_short for o in outs)


def test_traditional_organizer_abscond_hits_late_receivers(base: Scenario) -> None:
    sc = with_hazards(base, 0.0, 0.0)
    trad = dataclasses.replace(sc.traditional, abscond_prob=0.2)
    outs = simulate_all(dataclasses.replace(sc, traditional=trad), ("traditional",))["traditional"]
    hit = [o for o in outs if o.absconded]
    assert hit and all(o.honest_short for o in hit)
    assert all(o.abscond_cash > 0 for o in hit)


def test_s8_standard_error_halves_with_four_times_the_circles(base: Scenario) -> None:
    sc = _no_abscond(with_hazards(base, 0.02, 0.003))

    def se(circles: int, seeds: range) -> float:
        means = []
        for s in seeds:
            run = dataclasses.replace(sc, circles=circles, seed=s)
            means.append(_mean_loss(simulate_all(run, ("naive_onchain",))["naive_onchain"]))
        return float(np.std(means, ddof=1))

    ratio = se(400, range(20)) / se(100, range(20))
    assert 0.3 < ratio < 0.75, ratio


def test_common_random_numbers_same_defaults_across_designs(base: Scenario) -> None:
    # A default is fixed by the shared draws: huisafe never defaults more than naive here
    # because both see the same u; with identical paths the default lists coincide.
    sc = _no_abscond(with_hazards(base, 0.0, 0.01, circles=200))
    outs = simulate_all(sc, ("naive_onchain", "huisafe"))
    same = sum(
        1
        for a, b in zip(outs["naive_onchain"], outs["huisafe"], strict=True)
        if a.defaults == b.defaults
    )
    assert same > 150
