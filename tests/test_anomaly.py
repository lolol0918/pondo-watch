"""Tests for the cost anomaly detector.

The regression tests run against the real DPWH transparency dataset. They
pin a handful of projects that a human would consider obviously out of line
with their peers (multi-billion peso bridges and buildings) and a handful
that are clearly typical, and assert the detector gets both right.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from pipeline.anomaly import (
    ANOMALY_COLUMNS,
    GROUP_KEYS,
    MAD_SCALE,
    MAD_SIGMAS,
    MIN_GROUP_SIZE,
    PROCESSED_FILE,
    compute_baselines,
    detect_anomalies,
    flagged_projects,
    load_projects,
)

pytestmark = pytest.mark.skipif(
    not Path(PROCESSED_FILE).exists(),
    reason="processed projects.parquet has not been built yet",
)


# Real projects that are wildly expensive for their peer group.
# Each is a flagship project whose budget dwarfs everything comparable.
KNOWN_ANOMALIES = [
    "21L00041",  # Talomo-Matina bridge, P1.75B vs ~P4.6M median bridges in Region XI 2021
    "23O00090",  # new DOJ building, P1.78B vs ~P14.7M median NCR buildings 2023
    "23I00039",  # storm surge protection, P1.06B vs ~P48.5M median Region VIII 2023
    "23Z00026",  # small river impounding project, P1.45B vs ~P144M Central Office 2023
    "18B00075",  # missing links/interchange, P2.10B vs ~P9.6M median Region II bridges 2019
]

# Real projects that sit right in line with their peers.
KNOWN_TYPICAL = [
    "25DI0029",  # Mt Makiling eco garden road, ~1.4x its group median
    "21NA0052",  # barangay farm-to-market road, below its group median
]


@pytest.fixture(scope="module")
def projects():
    return load_projects()


@pytest.fixture(scope="module")
def baselines(projects):
    return compute_baselines(projects)


@pytest.fixture(scope="module")
def scored(projects, baselines):
    return detect_anomalies(projects, baselines)


@pytest.fixture(scope="module")
def flagged(scored):
    return scored[scored["is_cost_anomaly"]].copy()


def row_for(scored, contract_id):
    return scored[scored["contractId"] == contract_id].iloc[0]


@pytest.mark.parametrize("contract_id", KNOWN_ANOMALIES)
def test_known_mega_projects_are_flagged(scored, contract_id):
    row = row_for(scored, contract_id)
    assert row["is_cost_anomaly"], (
        f"{contract_id} ({row['description'][:50]}) was not flagged: "
        f"P{row['budget']:,.0f} vs P{row['median_budget']:,.0f} median"
    )


@pytest.mark.parametrize("contract_id", KNOWN_TYPICAL)
def test_typical_projects_are_not_flagged(scored, contract_id):
    row = row_for(scored, contract_id)
    assert not row["is_cost_anomaly"], (
        f"{contract_id} should be typical but was flagged at "
        f"{row['anomaly_score']:.2f} robust sigmas"
    )


def test_flags_sit_above_their_group_median(flagged):
    assert (flagged["budget"] > flagged["median_budget"]).all()
    assert (flagged["median_multiple"] > 1).all()


def test_flags_come_from_large_enough_groups(flagged):
    assert (flagged["group_size"] >= MIN_GROUP_SIZE).all()


def test_flags_have_positive_budget(flagged):
    assert (flagged["budget"] > 0).all()


def test_anomalies_are_passed_the_robust_fence(flagged):
    expected = flagged["median_log"] + MAD_SIGMAS * MAD_SCALE * flagged["mad_log"]
    assert (np.log10(flagged["budget"]) > expected).all()


def test_anomaly_score_matches_definition(flagged):
    expected = (flagged["log_budget"] - flagged["median_log"]) / (
        MAD_SCALE * flagged["mad_log"]
    )
    np.testing.assert_allclose(flagged["anomaly_score"], expected)


def test_flagging_is_rare(projects, flagged):
    eligible = projects["eligible_for_cost_analysis"].sum()
    assert len(flagged) / eligible < 0.05


def test_baseline_is_the_group_median(projects, baselines):
    group = {"componentCategories": "Roads", "region": "Region III", "infraYear": "2023"}
    eligible = projects[projects["eligible_for_cost_analysis"]]
    for key, value in group.items():
        eligible = eligible[eligible[key] == value]
    assert not eligible.empty

    baseline = baselines
    for key, value in group.items():
        baseline = baseline[baseline[key] == value]
    assert len(baseline) == 1

    assert baseline.iloc[0]["median_budget"] == pytest.approx(
        eligible["budget"].median()
    )
    assert baseline.iloc[0]["group_size"] == len(eligible)


def test_detection_is_deterministic(projects, baselines):
    first = flagged_projects(projects, baselines)["contractId"].tolist()
    second = flagged_projects(projects, baselines)["contractId"].tolist()
    assert first == second


def test_flagged_output_has_expected_columns(flagged):
    missing = set(ANOMALY_COLUMNS) - set(flagged.columns)
    assert not missing, f"missing columns: {missing}"


def test_senate_building_peer_group_is_too_small(projects, scored):
    # The P8.76B Senate building is the largest eligible budget in the data,
    # but its peer group (Central Office buildings, 2018) has only 5 projects,
    # which is too few for a trustworthy median/MAD baseline. The detector
    # deliberately declines to flag it rather than guess.
    row = row_for(scored, "18Z00036")
    assert np.isnan(row["group_size"])
    assert not row["is_cost_anomaly"]


# --- Synthetic edge cases -------------------------------------------------


def make_projects(rows):
    """Build a minimal frame shaped like the processed projects data."""
    frame = pd.DataFrame(rows)
    frame["contractId"] = [f"C{i:03d}" for i in range(len(frame))]
    frame["eligible_for_cost_analysis"] = True
    return frame


def score_single_group(budgets, **kwargs):
    rows = [
        {
            "componentCategories": "Roads",
            "region": "Region I",
            "infraYear": "2020",
            "budget": float(b),
        }
        for b in budgets
    ]
    df = make_projects(rows)
    baselines = compute_baselines(df, **kwargs)
    return detect_anomalies(df, baselines), baselines


def test_obvious_outlier_is_flagged():
    budgets = [1_000_000] * (MIN_GROUP_SIZE - 1) + [1_000_000_000]
    scored, _ = score_single_group(budgets)
    assert scored.iloc[-1]["is_cost_anomaly"]
    assert not scored.iloc[:-1]["is_cost_anomaly"].any()


def test_small_group_is_never_flagged():
    budgets = [1_000_000] * 5 + [1_000_000_000]
    scored, baselines = score_single_group(budgets)
    assert baselines.empty
    assert not scored["is_cost_anomaly"].any()


def test_degenerate_group_does_not_crash():
    budgets = [2_000_000] * MIN_GROUP_SIZE
    scored, baselines = score_single_group(budgets)
    assert len(baselines) == 1
    assert not scored["is_cost_anomaly"].any()
    assert np.isfinite(baselines.iloc[0]["fence_budget"])


def test_extreme_budget_does_not_poison_the_median():
    # A single 1B outlier should not drag the fence up past a second 500M
    # project: the robust statistics are driven by the 1M majority.
    budgets = [1_000_000] * MIN_GROUP_SIZE + [500_000_000, 1_000_000_000]
    scored, baselines = score_single_group(budgets)
    assert baselines.iloc[0]["median_budget"] == pytest.approx(1_000_000)
    assert scored["is_cost_anomaly"].sum() == 2
