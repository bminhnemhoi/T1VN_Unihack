"""The worked example of docs/03 section 8 (branch B), run through the model.

N = 5, C = 100 USDC, alpha 20%, bond 480, fee 1%, reserve 1%. M1..M5 are joinIndex 0..4.
Round 1: M2 bids 4, M4 bids 6 and wins. Round 2: M4 does not pay; M1 and M2 bid 3 and M1
wins the tie. M4 never repays (branch B).
"""

from __future__ import annotations

from huisim import math as hm
from huisim.model import Draws, simulate_circle
from huisim.policies import DefaultPlan, build_design
from huisim.scenarios import (
    Behaviour,
    HuisafeCfg,
    Scenario,
    TraditionalCfg,
)

U = hm.USDC
N, C = 5, 100 * U
M1, M2, M3, M4, M5 = range(5)


def _scenario() -> Scenario:
    return Scenario(
        id="worked",
        seed=0,
        circles=1,
        n=N,
        c=100,
        period_days=30,
        designs=("huisafe",),
        huisafe=HuisafeCfg(alpha_bps=2000, bond_ratio=0.8, reserve_bps=100, fee_bps=100),
        traditional=TraditionalCfg(0.0, True, 0.3),
        behaviour=Behaviour(0.0, 0.0, 0.0, "uniform_fraction_of_cap", 0.0, 1.0),
    )


def _u_for(bid: int, cap: int) -> float:
    return (bid + 0.5) / cap  # floor(u * cap) == bid


def _draws() -> Draws:
    bid = [[0.0] * N for _ in range(N + 1)]
    cap1 = hm.max_bid(2000, N, 1, C, 30 * hm.DAY, N - 1)
    cap2 = hm.max_bid(2000, N, 2, C, 30 * hm.DAY, N - 2)  # M4 is dead: payers = 3 live - 1
    bid[1][M2], bid[1][M4] = _u_for(4 * U, cap1), _u_for(6 * U, cap1)
    bid[2][M1] = bid[2][M2] = _u_for(3 * U, cap2)
    zeros = [[1.0] * N for _ in range(N + 1)]
    return Draws(default=zeros, bid=bid, shock=[1.0] * (N + 1), abscond=[1.0] * (N + 1))


def test_branch_b_numbers() -> None:
    sc = _scenario()
    out = simulate_circle(
        sc, build_design("huisafe", sc), _draws(), DefaultPlan("fixed", fixed=((M4, 2),))
    )
    r1, r2 = out.rounds[0], out.rounds[1]
    assert (r1.winner, r1.bid, r1.pot) == (M4, 6 * U, 376 * U)
    assert (r1.fee, r1.premium, r1.holdback, r1.payout) == (
        3_760_000,
        3_760_000,
        80 * U,
        288_480_000,
    )
    assert (r2.winner, r2.bid, r2.pot) == (M1, 3 * U, 391 * U)
    assert (r2.fee, r2.premium, r2.holdback, r2.payout) == (
        3_910_000,
        3_910_000,
        60 * U,
        323_180_000,
    )
    assert r2.uncovered == 0 and out.uncovered_end == 0 and not out.honest_short
    assert out.defaults == [(M4, 2, True)]


def test_branch_b_bond_and_fees() -> None:
    sc = _scenario()
    out = simulate_circle(
        sc, build_design("huisafe", sc), _draws(), DefaultPlan("fixed", fixed=((M4, 2),))
    )
    # Bond 480 -> 460 -> 360 -> 260 -> 160: 80 of the 400 shortfall came from M4's holdback.
    assert out.bond0 == 480 * U
    assert out.bond_returned == 160 * U
    assert out.bond_peak_used == 320 * U
    fees = sum(r.fee for i, r in enumerate(out.rounds, start=1) if i != 2)  # round 2 forfeited
    assert out.fees_to_organizer == fees
