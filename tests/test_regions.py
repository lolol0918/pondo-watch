"""Tests for region metadata and the region-level summary.

The summary is the only data the dashboard loads on first paint, so these
tests pin its counts and its explicit label/PSGC mapping. Most run on tiny
hand-built records; one optional regression test checks the real dataset.
"""

import json
from pathlib import Path

import pytest

from pipeline.regions import (
    MAP_ATTRIBUTION,
    MAP_COVERAGE_NOTE,
    REGION_METADATA,
    REGION_ORDER,
    build_region_summary,
)

# PSGC codes present in the 2023 Faeldon low-resolution boundary file. Keeping
# the verified set here means a typo in the metadata mapping fails loudly.
MAP_PSGC_CODES = {
    100000000,
    200000000,
    300000000,
    400000000,
    500000000,
    600000000,
    700000000,
    800000000,
    900000000,
    1000000000,
    1100000000,
    1200000000,
    1300000000,
    1400000000,
    1600000000,
    1700000000,
    1900000000,
}


# --- metadata -------------------------------------------------------------


def test_every_dataset_label_has_metadata():
    labels = {
        "Central Office",
        "Cordillera Administrative Region",
        "National Capital Region",
        "Negros Island Region",
        "Region I",
        "Region II",
        "Region III",
        "Region IV-A",
        "Region IV-B",
        "Region V",
        "Region VI",
        "Region VII",
        "Region VIII",
        "Region IX",
        "Region X",
        "Region XI",
        "Region XII",
        "Region XIII",
    }
    assert set(REGION_METADATA) == labels


def test_mapped_regions_use_known_map_codes():
    mapped = {
        meta["psgc"] for meta in REGION_METADATA.values() if meta["psgc"] is not None
    }
    assert mapped <= MAP_PSGC_CODES
    assert len(mapped) == 16


def test_region_iv_b_maps_to_mimaropa_and_xiii_to_caraga():
    assert REGION_METADATA["Region IV-B"]["psgc"] == 1700000000
    assert REGION_METADATA["Region IV-B"]["map_name"] == "MIMAROPA Region"
    assert REGION_METADATA["Region XIII"]["psgc"] == 1600000000


def test_central_office_is_not_geographic():
    assert REGION_METADATA["Central Office"]["is_geographic"] is False
    assert REGION_METADATA["Central Office"]["psgc"] is None


def test_negros_island_region_is_geographic_but_not_on_map():
    nir = REGION_METADATA["Negros Island Region"]
    assert nir["is_geographic"] is True
    assert nir["on_map"] is False
    assert nir["psgc"] is None


# --- build_region_summary -------------------------------------------------


def make_project(region, eligible=True):
    return {"region": region, "eligible_for_cost_analysis": eligible}


def make_anomaly(region):
    return {"region": region, "contractId": "X"}


def test_summary_emits_every_known_region_in_order():
    summary = build_region_summary([], [])
    assert [r["region"] for r in summary["regions"]] == REGION_ORDER


def test_summary_counts_projects_flagged_and_eligible():
    projects = [
        make_project("Region XI"),
        make_project("Region XI"),
        make_project("Region XI", eligible=False),
        make_project("Central Office"),
    ]
    anomalies = [make_anomaly("Region XI")]

    summary = build_region_summary(projects, anomalies)
    by_region = {r["region"]: r for r in summary["regions"]}

    region_xi = by_region["Region XI"]
    assert region_xi["projects"] == 3
    assert region_xi["eligible"] == 2
    assert region_xi["flagged"] == 1
    assert region_xi["flagged_percentage"] == pytest.approx(33.33, abs=0.01)

    central = by_region["Central Office"]
    assert central["projects"] == 1
    assert central["flagged"] == 0


def test_summary_totals_match_inputs():
    projects = [make_project("Region I"), make_project("Region II")]
    anomalies = [make_anomaly("Region I")]

    totals = build_region_summary(projects, anomalies)["totals"]

    assert totals == {
        "projects": 2,
        "flagged": 1,
        "eligible": 2,
        "flagged_percentage": 50.0,
    }


def test_summary_handles_missing_region_and_no_projects():
    summary = build_region_summary(
        [make_project(None)], [make_anomaly(None)]
    )
    assert summary["totals"]["projects"] == 1
    assert all(r["projects"] == 0 for r in summary["regions"])


def test_summary_appends_unknown_labels_instead_of_dropping_them():
    summary = build_region_summary([make_project("Region ZZ")], [])
    labels = [r["region"] for r in summary["regions"]]
    assert "Region ZZ" in labels
    assert labels.index("Region ZZ") >= len(REGION_ORDER)


def test_summary_is_json_serializable_and_carries_map_provenance():
    summary = build_region_summary([make_project("Region I")], [])
    text = json.dumps(summary, ensure_ascii=False, allow_nan=False)
    assert json.loads(text) == summary
    assert summary["map"]["attribution"] == MAP_ATTRIBUTION
    assert summary["map"]["coverage_note"] == MAP_COVERAGE_NOTE


# --- Real-data regression -------------------------------------------------

PROCESSED_FILE = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "processed"
    / "projects.parquet"
)

requires_data = pytest.mark.skipif(
    not PROCESSED_FILE.exists(),
    reason="processed projects.parquet has not been built yet",
)


@requires_data
def test_real_summary_matches_exported_records():
    from pipeline.export_json import (
        ANOMALIES_JSON,
        PROJECTS_JSON,
        anomalies_to_records,
        projects_to_records,
    )
    from pipeline.anomaly import (
        compute_baselines,
        flagged_projects,
        load_projects,
    )

    projects = load_projects()
    flagged = flagged_projects(projects, compute_baselines(projects))

    summary = build_region_summary(
        projects_to_records(projects), anomalies_to_records(flagged)
    )

    assert summary["totals"]["projects"] == len(projects)
    assert summary["totals"]["flagged"] == len(flagged)
    assert sum(r["projects"] for r in summary["regions"]) == len(projects)
    assert sum(r["flagged"] for r in summary["regions"]) == len(flagged)

    if PROJECTS_JSON.exists() and ANOMALIES_JSON.exists():
        on_disk_projects = json.loads(PROJECTS_JSON.read_text(encoding="utf-8"))
        on_disk_anomalies = json.loads(ANOMALIES_JSON.read_text(encoding="utf-8"))
        on_disk = build_region_summary(on_disk_projects, on_disk_anomalies)
        assert on_disk == summary
