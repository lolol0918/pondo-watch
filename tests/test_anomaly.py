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
    MAD_FLOOR,
    MAD_SCALE,
    MAD_SIGMAS,
    MIN_GROUP_SIZE,
    PROCESSED_FILE,
    compute_baselines,
    detect_anomalies,
    find_bundled_descriptions,
    flagged_projects,
    load_projects,
    prepare_analysis_frame,
)

pytestmark = pytest.mark.skipif(
    not Path(PROCESSED_FILE).exists(),
    reason="processed projects.parquet has not been built yet",
)


# Real projects that are wildly expensive for their peer group.
# Each is a flagship project whose budget dwarfs everything comparable, and
# each sits in a peer group large enough to trust (>= MIN_GROUP_SIZE).
KNOWN_ANOMALIES = [
    "21L00041",  # Talomo-Matina bridge, P1.75B vs ~P4.6M median bridges in Region XI 2021
    "23O00090",  # new DOJ building, P1.78B vs ~P14.7M median NCR buildings 2023
    "23I00039",  # storm surge protection, P1.06B vs ~P48.5M median Region VIII 2023
    "24F00403",  # Bicol Regional Hospital, P1.38B vs ~P7.4M median Region V buildings 2024
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
    effective_mad = np.maximum(flagged["mad_log"], MAD_FLOOR)
    expected = flagged["median_log"] + MAD_SIGMAS * MAD_SCALE * effective_mad
    assert (np.log10(flagged["budget"]) > expected).all()


def test_anomaly_score_matches_definition(flagged):
    effective_mad = np.maximum(flagged["mad_log"], MAD_FLOOR)
    expected = (flagged["log_budget"] - flagged["median_log"]) / (
        MAD_SCALE * effective_mad
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


def test_river_impounding_project_group_is_below_min_size(scored):
    # 23Z00026 is a P1.45B outlier, but its peer group (Flood Control and
    # Drainage, Central Office, 2023) has only 23 projects -- below
    # MIN_GROUP_SIZE -- so it gets no baseline and stays unflagged.
    row = row_for(scored, "23Z00026")
    assert np.isnan(row["group_size"])
    assert not row["is_cost_anomaly"]


def test_min_group_size_is_thirty():
    assert MIN_GROUP_SIZE == 30


def test_flagged_scores_are_finite(flagged):
    assert np.isfinite(flagged["anomaly_score"]).all()
    assert np.isfinite(flagged["median_budget"]).all()
    assert np.isfinite(flagged["median_log"]).all()


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


# --- Group-size boundary ---------------------------------------------------


@pytest.mark.parametrize("size", [20, 29, 30])
def test_group_size_boundary(size):
    """Groups below MIN_GROUP_SIZE are never compared; 30 is the cutoff."""
    budgets = [1_000_000] * (size - 1) + [1_000_000_000]
    scored, baselines = score_single_group(budgets)

    if size >= MIN_GROUP_SIZE:
        assert len(baselines) == 1
        assert scored["is_cost_anomaly"].sum() == 1
        assert scored.iloc[-1]["is_cost_anomaly"]
    else:
        assert baselines.empty
        assert not scored["is_cost_anomaly"].any()


# --- Bundled-description exclusion ----------------------------------------


BUNDLED_DESCRIPTIONS = [
    "CONSTRUCTION OF VARIOUS WATER SUPPLY PROJECTS IN ZAMBOANGA CITY",
    "CONSTRUCTION OF VARIOUS WATER SUPPLY PROJECTS, PILAR, SORSOGON",
    "CONSTRUCTION/REPAIR/REHABILITATION/IMPROVEMENT OF VARIOUS INFRASTRUCTURE "
    "INCLUDING LOCAL PROJECTS",
    "REHABILITATION OF VARIOUS ROAD PROJECTS AS CLUSTERED IN APAYAO",
    "CLUSTER B - CONSTRUCTION OF VARIOUS BUILDING PROJECTS IN LANAO DEL SUR",
    "CONSTRUCTION OF 200 PACKAGE ROADS",
]

# Ordinary single projects that must NOT be mistaken for bundles.
ORDINARY_DESCRIPTIONS = [
    "CONSTRUCTION OF CONCRETE BRIDGE - TALOMO - MATINA BRIDGE ALONG DAVAO "
    "CITY COASTAL BYPASS ROAD, DAVAO CITY",
    "MAMPISING ROAD LEADING TO MABINI PROTECTED LANDSCAPE AND SEASCAPE MARINE "
    "CENTER AND VARIOUS BEACH RESORTS, BRGY. BAGALANGIT, MABINI, BATANGAS",
    "REHABILITATION OF VARIOUS BRIDGES ALONG THE PAN-PHILIPPINE HIGHWAY",
    "CONCRETING OF BRGY. MARAIGING FMR, BRGY. MARAIGING, JABONGA, AGUSAN DEL NORTE",
]


def frame_for_descriptions(descriptions):
    return pd.DataFrame(
        {
            "contractId": [f"C{i:03d}" for i in range(len(descriptions))],
            "description": list(descriptions),
            "componentCategories": "Roads",
            "region": "Region I",
            "infraYear": "2020",
            "budget": 1_000_000.0,
            "eligible_for_cost_analysis": True,
        }
    )


def test_bundled_descriptions_are_excluded():
    df = frame_for_descriptions(BUNDLED_DESCRIPTIONS)
    assert find_bundled_descriptions(df["description"]).all()
    assert prepare_analysis_frame(df).empty


def test_ordinary_descriptions_are_kept():
    df = frame_for_descriptions(ORDINARY_DESCRIPTIONS)
    assert not find_bundled_descriptions(df["description"]).any()
    assert len(prepare_analysis_frame(df)) == len(ORDINARY_DESCRIPTIONS)


# --- Near-zero MAD ---------------------------------------------------------


def test_near_zero_mad_produces_finite_scores():
    # 29 nearly-identical budgets plus one extreme outlier: the group MAD is
    # tiny but non-zero, so the score must stay finite and bounded instead
    # of exploding, while the real outlier still clears the fence.
    budgets = [1_000_000 + i for i in range(MIN_GROUP_SIZE - 1)] + [1_000_000_000]
    scored, baselines = score_single_group(budgets)

    assert len(baselines) == 1
    assert 0 < baselines.iloc[0]["mad_log"] < MAD_FLOOR
    assert np.isfinite(scored["anomaly_score"]).all()
    assert scored.iloc[-1]["is_cost_anomaly"]
    assert not scored.iloc[:-1]["is_cost_anomaly"].any()
