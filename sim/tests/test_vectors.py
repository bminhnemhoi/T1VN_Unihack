"""The committed contracts/test/vectors/huimath.json must equal what the generator writes."""

import json
from pathlib import Path

from huisim.cli import FUNCTIONS, generate_vectors, main, render_vectors
from huisim.hashing import commit_hash

SEED = 7
REPO_ROOT = Path(__file__).resolve().parents[2]
VECTOR_FILE = REPO_ROOT / "contracts" / "test" / "vectors" / "huimath.json"


def test_generation_is_deterministic() -> None:
    assert render_vectors(generate_vectors(SEED)) == render_vectors(generate_vectors(SEED))
    assert render_vectors(generate_vectors(SEED)) != render_vectors(generate_vectors(SEED + 1))


def test_cli_writes_the_same_bytes(tmp_path: Path) -> None:
    out = tmp_path / "nested" / "huimath.json"
    assert main(["vectors", "--seed", str(SEED), "--out", str(out)]) == 0
    assert out.read_text(encoding="utf-8") == render_vectors(generate_vectors(SEED))


def test_committed_file_is_up_to_date() -> None:
    assert VECTOR_FILE.read_text(encoding="utf-8") == render_vectors(generate_vectors(SEED))


def test_committed_file_recomputes_with_math_module() -> None:
    doc = json.loads(VECTOR_FILE.read_text(encoding="utf-8"))
    assert doc["version"] == 1 and doc["seed"] == SEED
    total = 0
    for name, (fn, params) in FUNCTIONS.items():
        cases = doc["functions"][name]
        assert cases, name
        total += len(cases)
        for case in cases:
            assert list(case["in"]) == list(params)
            args = [int(case["in"][p]) for p in params]
            assert fn(*args) == int(case["out"]), (name, case)
    for case in doc["commitHash"]:
        total += 1
        assert case["hash"] == commit_hash(
            case["circle"], int(case["round"]), case["member"], int(case["bid"]), case["salt"]
        )
    assert total == 2630  # 2000 of v1.1 + 630 for the five v1.2 functions


def test_all_numbers_are_decimal_strings_and_edges_present() -> None:
    doc = json.loads(VECTOR_FILE.read_text(encoding="utf-8"))
    for cases in doc["functions"].values():
        for case in cases:
            assert all(isinstance(v, str) and v.isdigit() for v in case["in"].values())
            assert isinstance(case["out"], str) and case["out"].isdigit()
    fns = doc["functions"]
    ins = [c["in"] for c in fns["maxBid"]]
    assert any(i["payers"] == "0" for i in ins)  # L = 0
    assert any(i["n"] == "3" for i in ins) and any(i["n"] == "30" for i in ins)
    assert any(i["c"] == "10000000000" for i in ins)  # 10,000 USDC
    assert any(i["k"] == "1" for i in ins) and any(i["k"] == "29" and i["n"] == "30" for i in ins)
    assert {c["out"] for c in fns["maxBid"] if c["in"]["n"] == "5"} >= {
        "6575342",
        "4931506",
        "3287671",
        "1643835",
    }
    assert any(c["in"]["n"] == "25" and c["out"] == "657534" for c in fns["maxBid"])
    assert any(c["out"] == "27397" for c in fns["lateFee"])


def test_v12_functions_match_the_worked_numbers() -> None:
    from huisim import math as hm

    assert hm.bid_cap_after_share(6_575_342, 5000) == 3_287_671
    assert hm.commission_room(6_575_342, 4) == 26_301_368
    assert hm.commission(388_000_000, 300, 5000, 26_301_368) == 11_640_000
    assert hm.commission(392_800_000, 300, 5000, 14_794_518) == 7_397_259
    assert hm.commission(376_000_000, 100, 0, 0) == 3_760_000
    assert hm.reserve_share(19_697_396, 4, 19) == 4_146_820
    assert hm.reserve_share(19_697_396, 3, 19) == 3_110_115
    assert [hm.on_time_weight(5, late, 0) for late in (0, 1, 4, 6)] == [4, 3, 0, 0]
    assert hm.on_time_weight(5, 0, 1) == 0
