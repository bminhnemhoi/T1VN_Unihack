"""Organizer scenarios of v1.2: numbers pinned to docs/03 section 7.3 and to tools/hui-economics."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

from huisim import math as hm
from huisim.cli import main
from huisim.model import simulate_circle
from huisim.organizer import economics_cell, raw_kind, run_organizer, sybil_case
from huisim.policies import ScriptedBids, build_design
from huisim.scenarios import SCENARIO_DIR

U = hm.USDC


def _raw(name: str) -> dict:
    return json.loads((SCENARIO_DIR / f"{name}.json").read_text(encoding="utf-8"))


def _cell(n: int, period: int, share: int, fee: int) -> dict:
    return economics_cell(
        n, period, c_usdc=100, alpha=2000, fee=fee, share=share, reserve=100, bid_pct=50,
        hazard_early=0.0204, hazard_late=0.0059, hazard_scales=(1.0, 0.5),
    )  # fmt: skip


class TestSybil:
    """docs/03 section 7.3 table, to the unit (computed by tools/hui-economics, vector V4)."""

    raw = _raw("organizer_sybil")

    def test_one_wallet_full_cover_loses_money(self) -> None:
        c = sybil_case(self.raw, 1, 8000)
        assert c["organizerNetUsdc"] == pytest.approx(-18.038354, abs=1e-6)
        assert c["uncoveredUsdc"] == 0
        assert c["lastReceiverPayoutUsdc"] == 392.0
        assert c["coverageBps"] == 10_000

    def test_two_wallets_make_money_and_short_the_last_receiver(self) -> None:
        c = sybil_case(self.raw, 2, 8000)
        assert c["organizerNetUsdc"] == pytest.approx(41.472772, abs=1e-6)
        assert c["uncoveredUsdc"] == pytest.approx(56.558906, abs=1e-6)
        assert c["lastReceiverPayoutUsdc"] == pytest.approx(336.572274, abs=1e-6)

    def test_one_wallet_at_half_cover_was_profitable_in_v11(self) -> None:
        c = sybil_case(self.raw, 1, 3000)
        assert c["organizerNetUsdc"] == pytest.approx(120.756588, abs=1e-6)
        assert c["uncoveredUsdc"] == pytest.approx(120.505645, abs=1e-6)
        assert c["lastReceiverPayoutUsdc"] == pytest.approx(297.682223, abs=1e-6)
        assert c["coverageBps"] == 5000


class TestEconomics:
    """Report 5.5 (phi = 50%, fee ceiling 3%, alpha 20%, C = 1 million = 100 USDC x 10_000)."""

    def test_monthly_ten_seats(self) -> None:
        c = _cell(10, 30, 5000, 300)
        assert c["grossFeeUsdc"] == pytest.approx(150.37, abs=0.01)  # report: 1.504k per 1M
        assert c["netAfterRiskUsdc"] == pytest.approx(86.16, abs=0.02)  # report: +862k
        assert c["annualReturnPctByHazardScale"]["1"] == pytest.approx(5.24, abs=0.01)
        assert c["annualReturnPctByHazardScale"]["0.5"] == pytest.approx(7.19, abs=0.01)
        assert c["firstSeatNetUsdc"] == pytest.approx(-59.07, abs=0.01)
        assert c["lastSeatNetUsdc"] == pytest.approx(18.38, abs=0.01)

    def test_weekly_five_seats_the_organizer_loses_after_risk(self) -> None:
        c = _cell(5, 7, 5000, 300)
        assert c["netAfterRiskUsdc"] == pytest.approx(-7.14, abs=0.01)  # report: -71k
        assert c["annualReturnPctByHazardScale"]["0.5"] < 0

    def test_commission_stays_inside_the_interest_cap_and_late_seats_never_lose(self) -> None:
        for period in (7, 30):
            for n in (5, 8, 10, 12):
                c = _cell(n, period, 5000, 300)
                assert c["insideInterestCap"] is True
                assert c["lastThirdNeverLoses"] is True

    def test_phi_zero_is_the_fixed_fee_of_v11(self) -> None:
        c = _cell(5, 30, 0, 100)
        assert c["grossFeeUsdc"] == pytest.approx(
            4 * 4 + 0, abs=20
        )  # 1% of pots of ~400 over 4 rounds
        assert c["feeBps"] == 100

    def test_matches_the_independent_calculator(self) -> None:
        """tools/hui-economics (a separate integer model) gives the same net and annual return."""
        path = Path(__file__).resolve().parents[2] / "tools" / "hui-economics" / "schedules.py"
        spec = importlib.util.spec_from_file_location("hui_schedules", path)
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for period, n in ((30, 10), (7, 8), (30, 5)):
            ref = mod.ev(n, period, ("capshare", 5000))
            ours = _cell(n, period, 5000, 300)
            assert ours["netAfterRiskUsdc"] == pytest.approx(ref["net"] / 1e4, abs=0.01)
            assert ours["annualReturnPctByHazardScale"]["1"] == pytest.approx(
                ref["ann"] * 100, abs=0.02
            )


class TestModelV12:
    def _run(self, share: int, fee: int, bid_bps: int):  # noqa: ANN202
        from huisim.organizer import _null_draws, _scenario

        sc = _scenario(5, 100, 30, 2000, 8000, fee, share, 100)
        order = {k: k - 1 for k in range(1, 6)}
        return sc, simulate_circle(
            sc, build_design("huisafe", sc), _null_draws(5), None, ScriptedBids(order, bid_bps)
        )

    def test_worked_example_8_1_scaled(self) -> None:
        """docs/03 section 8.1 (phi 50%, ceiling 3%), C = 100: round 1 bids the enforced ceiling."""
        _, out = self._run(5000, 300, 10_000)
        r1 = out.rounds[0]
        assert r1.bid == 3_287_671  # half of the legal 6,575342
        assert r1.fee == min(hm.bps_of(r1.pot, 300), 13_150_684)
        assert out.rounds[-1].fee == 0  # last round: nobody is left to pay interest

    def test_inv11_fee_plus_interest_never_above_the_room(self) -> None:
        sc, out = self._run(5000, 300, 10_000)
        c = sc.c * U
        for k, r in enumerate(out.rounds, start=1):
            payers = 5 - k
            room = hm.commission_room(hm.max_bid(2000, 5, k, c, 30 * hm.DAY, payers), payers)
            assert r.fee + r.bid * payers <= room

    def test_reserve_is_split_in_full_and_dust_goes_to_the_lowest_seat(self) -> None:
        _, out = self._run(5000, 300, 5000)
        assert sum(out.reserve_shares) == out.reserve_end > 0
        assert out.reserve_shares[0] >= max(out.reserve_shares[1:])

    def test_money_is_conserved_per_member(self) -> None:
        """Everything paid in comes back as pot, holdback and reserve, minus the organizer fee."""
        _, out = self._run(5000, 300, 5000)
        paid, got = sum(out.contributed), sum(out.got)
        assert paid - got == out.fees_to_organizer


class TestCli:
    def test_run_writes_both_files_with_meta(self, tmp_path: Path) -> None:
        for name in ("organizer_economics", "organizer_sybil"):
            assert raw_kind(name) is not None
            assert (
                main(
                    [
                        "run",
                        "--scenario",
                        name,
                        "--seed",
                        "42",
                        "--out-dir",
                        str(tmp_path),
                        "--no-charts",
                    ]
                )
                == 0
            )
            doc = json.loads((tmp_path / f"{name}.json").read_text(encoding="utf-8"))
            meta = json.loads((tmp_path / f"{name}.meta.json").read_text(encoding="utf-8"))
            assert doc["scenario"] == name
            assert meta["seed"] == 42 and meta["scenarioSha256"]
        assert raw_kind("baseline") is None

    def test_run_is_reproducible(self, tmp_path: Path) -> None:
        a, b = tmp_path / "a", tmp_path / "b"
        for out in (a, b):
            run_organizer("organizer_sybil", out, seed=42, charts=False)
        da, db = (json.loads((x / "organizer_sybil.json").read_text()) for x in (a, b))
        da.pop("generatedAt"), db.pop("generatedAt")
        assert da == db

    def test_chart_is_written(self, tmp_path: Path) -> None:
        run_organizer("organizer_sybil", tmp_path, seed=42, charts=True)
        assert (tmp_path / "organizer_sybil.png").stat().st_size > 10_000
