"""Tests for the JSON export stage.

The serialization helpers are tested in isolation on tiny hand-built frames.
A small set of regression tests runs against the real processed dataset (when
it exists) to confirm the exported records match the detector's own output.
"""

import datetime
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from pipeline.anomaly import (
    ANOMALY_COLUMNS,
    PROCESSED_FILE,
    compute_baselines,
    flagged_projects,
    load_projects,
)
from pipeline.export_json import (
    PROJECT_FIELDS,
    anomalies_to_records,
    project_to_record,
    projects_to_records,
    to_jsonable,
    write_json,
)


# --- to_jsonable ----------------------------------------------------------


@pytest.mark.parametrize(
    "value",
    [None, np.nan, float("nan"), float("inf"), float("-inf"), pd.NA, pd.NaT],
)
def test_missing_and_non_finite_become_none(value):
    assert to_jsonable(value) is None


def test_dates_become_iso_strings():
    assert to_jsonable(datetime.date(2021, 7, 5)) == "2021-07-05"
    assert (
        to_jsonable(datetime.datetime(2021, 7, 5, 13, 30))
        == "2021-07-05T13:30:00"
    )


def test_numpy_scalars_become_native_types():
    amount = to_jsonable(np.float64(1.5))
    count = to_jsonable(np.int64(3))
    flag = to_jsonable(np.bool_(True))

    assert type(amount) is float and amount == 1.5
    assert type(count) is int and count == 3
    assert type(flag) is bool and flag is True


def test_python_primitives_pass_through():
    assert to_jsonable("Roads") == "Roads"
    assert to_jsonable(42) == 42
    assert to_jsonable(3.14) == 3.14
    assert to_jsonable(False) is False


# --- project_to_record / projects_to_records ------------------------------


def make_project_row(**overrides):
    row = {
        "contractId": "C001",
        "description": "CONSTRUCTION OF CONCRETE BRIDGE",
        "category": "Bridges",
        "componentCategories": "Bridges",
        "status": "Completed",
        "budget": np.float64(1_750_000_000.0),
        "location": {"province": "Davao City", "region": "Region XI"},
        "infraYear": "2021",
        "contractor": "ACME Builders",
        "startDate": datetime.date(2021, 7, 5),
        "completionDate": datetime.date(2022, 2, 27),
        "latitude": 7.1,
        "longitude": 125.6,
        "progress": 100.0,
        "eligible_for_cost_analysis": np.bool_(True),
    }
    row.update(overrides)
    return row


def test_project_record_has_exact_schema():
    record = project_to_record(make_project_row())
    assert list(record.keys()) == PROJECT_FIELDS


def test_region_and_province_are_flattened_from_location():
    record = project_to_record(make_project_row())
    assert record["region"] == "Region XI"
    assert record["province"] == "Davao City"


def test_missing_location_becomes_null_region_and_province():
    record = project_to_record(make_project_row(location=None))
    assert record["region"] is None
    assert record["province"] is None


def test_absent_fields_become_null():
    record = project_to_record({"contractId": "C002"})
    assert record["contractId"] == "C002"
    assert record["budget"] is None
    assert record["region"] is None
    assert set(record.keys()) == set(PROJECT_FIELDS)


def test_missing_values_in_records_are_null():
    row = make_project_row(latitude=np.nan, contractor=pd.NA)
    record = project_to_record(row)
    assert record["latitude"] is None
    assert record["contractor"] is None


def test_projects_records_are_json_serializable_and_readable():
    df = pd.DataFrame([make_project_row(), make_project_row(contractId="C002")])
    records = projects_to_records(df)

    assert len(records) == 2
    text = json.dumps(records, ensure_ascii=False, allow_nan=False)
    assert json.loads(text) == records


# --- anomalies_to_records -------------------------------------------------


def make_flagged_frame():
    data = {
        "contractId": ["A001"],
        "description": ["CONSTRUCTION OF CONCRETE BRIDGE"],
        "category": ["Bridges"],
        "componentCategories": ["Bridges"],
        "region": ["Region XI"],
        "infraYear": ["2021"],
        "budget": [np.float64(1_747_731_000.0)],
        "log_budget": [np.float64(9.24)],
        "median_budget": [np.float64(4_581_125.0)],
        "median_log": [np.float64(6.66)],
        "mad_log": [np.float64(0.37)],
        "fence_budget": [np.float64(202_231_200.0)],
        "median_multiple": [np.float64(381.5)],
        "anomaly_score": [np.float64(4.71)],
        "group_size": [np.float64(68.0)],
    }
    return pd.DataFrame(data)[ANOMALY_COLUMNS]


def test_anomaly_record_schema_matches_anomaly_columns():
    records = anomalies_to_records(make_flagged_frame())
    assert list(records[0].keys()) == ANOMALY_COLUMNS


def test_anomaly_evidence_is_native_and_serializable():
    records = anomalies_to_records(make_flagged_frame())
    record = records[0]

    assert type(record["budget"]) is float
    assert type(record["group_size"]) is float
    assert record["anomaly_score"] == pytest.approx(4.71)
    text = json.dumps(records, ensure_ascii=False, allow_nan=False)
    assert json.loads(text) == records


# --- write_json -----------------------------------------------------------


def test_write_json_is_compact_utf8_and_round_trips(tmp_path):
    records = [{"contractId": "C001", "region": "Rehiyon Ng Davao"}]
    path = tmp_path / "nested" / "out.json"

    write_json(records, path)

    text = path.read_text(encoding="utf-8")
    assert text == '[{"contractId":"C001","region":"Rehiyon Ng Davao"}]'
    assert json.loads(text) == records


def test_write_json_refuses_non_finite(tmp_path):
    with pytest.raises(ValueError):
        write_json([{"value": float("nan")}], tmp_path / "bad.json")


# --- Real-data regression -------------------------------------------------

requires_data = pytest.mark.skipif(
    not Path(PROCESSED_FILE).exists(),
    reason="processed projects.parquet has not been built yet",
)


@pytest.fixture(scope="module")
def projects():
    return load_projects()


@pytest.fixture(scope="module")
def flagged(projects):
    return flagged_projects(projects, compute_baselines(projects))


@requires_data
def test_all_projects_are_exported_with_expected_schema(projects):
    records = projects_to_records(projects)
    assert len(records) == len(projects)
    assert all(set(record.keys()) == set(PROJECT_FIELDS) for record in records)


@requires_data
def test_real_project_records_are_valid_json(projects):
    text = json.dumps(
        projects_to_records(projects), ensure_ascii=False, allow_nan=False
    )
    assert not re.search(r"\b(NaN|Infinity)\b", text)
    assert len(json.loads(text)) == len(projects)


@requires_data
def test_flagged_anomalies_are_exported_with_evidence(flagged):
    records = anomalies_to_records(flagged)
    assert len(records) == len(flagged)
    assert all(list(record.keys()) == ANOMALY_COLUMNS for record in records)
    assert all(record["anomaly_score"] is not None for record in records)
