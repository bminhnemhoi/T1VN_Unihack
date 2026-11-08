"""Same seed gives the same JSON (docs/08 section 6, rule 5)."""

from __future__ import annotations

import dataclasses
import json
from pathlib import Path

from huisim.cli import main
from huisim.scenarios import Scenario, load_scenario


def _run(out: Path, seed: int) -> dict:  # type: ignore[type-arg]
    argv = ["run", "--scenario", "baseline", "--seed", str(seed), "--circles", "60"]
    assert main([*argv, "--out-dir", str(out), "--no-charts"]) == 0
    doc = json.loads((out / "baseline.json").read_text(encoding="utf-8"))
    doc.pop("generatedAt")
    return doc  # type: ignore[no-any-return]


def test_same_seed_same_json_and_other_seed_differs(tmp_path: Path) -> None:
    a, b, c = _run(tmp_path / "a", 42), _run(tmp_path / "b", 42), _run(tmp_path / "c", 43)
    assert a == b
    assert a != c


def test_output_matches_schema_and_meta_has_intervals(tmp_path: Path) -> None:
    doc = _run(tmp_path, 42)
    assert [r["design"] for r in doc["results"]] == ["traditional", "naive_onchain", "huisafe"]
    assert all(len(r) == 7 for r in doc["results"])
    naive = doc["results"][1]
    assert naive["bondUsageMeanPct"] is None and naive["organizerNetReturnPct"] is None
    meta = json.loads((tmp_path / "baseline.meta.json").read_text(encoding="utf-8"))
    assert meta["seed"] == 42 and meta["circles"] == 60 and len(meta["scenarioSha256"]) == 64
    assert set(meta["ci95"]) == {"traditional", "naive_onchain", "huisafe"}


def test_scenario_files_parse() -> None:
    for name in ("baseline", "baseline_calibrated"):
        sc, sha = load_scenario(name)
        assert isinstance(sc, Scenario) and len(sha) == 64
        assert dataclasses.replace(sc, circles=1).circles == 1
