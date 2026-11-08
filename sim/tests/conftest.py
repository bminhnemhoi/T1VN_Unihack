"""Shared fixtures."""

from __future__ import annotations

import pytest

from huisim.scenarios import Scenario, load_scenario


@pytest.fixture
def base() -> Scenario:
    return load_scenario("baseline")[0]
