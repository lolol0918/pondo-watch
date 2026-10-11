"""JSON export stage for Pondo Watch.

This is the last, read-only step of the pipeline. It reads the processed
projects (built by ``pipeline.clean``) and the flagged cost anomalies (built
by ``pipeline.anomaly``) and writes two files the React dashboard consumes::

    data/processed/projects.json
    data/processed/cost_anomalies.json

It changes nothing upstream. Anomaly detection lives entirely in
``pipeline.anomaly``; this module only selects fields, makes every value
JSON-safe, and writes compact UTF-8 JSON.

Two kinds of helpers are kept deliberately separate:

* pure *serialization* helpers (``to_jsonable``, ``project_to_record``,
  ``projects_to_records``, ``anomalies_to_records``) turn frames into plain
  Python records and can be unit-tested without touching the filesystem;
* a thin *file-writing* helper (``write_json``) that only encodes and saves.
"""

import datetime
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.anomaly import (
    ANOMALY_COLUMNS,
    flagged_projects,
    load_projects,
    compute_baselines,
)
from pipeline.regions import build_region_summary

ROOT = Path(__file__).resolve().parents[1]

PROJECTS_JSON = ROOT / "data" / "processed" / "projects.json"
ANOMALIES_JSON = ROOT / "data" / "processed" / "cost_anomalies.json"
REGION_SUMMARY_JSON = ROOT / "data" / "processed" / "region_summary.json"

# Every field the dashboard needs from a project. ``location`` is not here:
# its nested contents are flattened into ``region`` and ``province`` by
# ``project_to_record``. ``amountPaid``, ``isLive`` and ``hasSatelliteImage``
# are intentionally left out of the MVP export.
PROJECT_FIELDS = [
    "contractId",
    "description",
    "category",
    "componentCategories",
    "status",
    "budget",
    "region",
    "province",
    "infraYear",
    "contractor",
    "startDate",
    "completionDate",
    "latitude",
    "longitude",
    "progress",
    "eligible_for_cost_analysis",
]


def to_jsonable(value):
    """Return ``value`` as a plain JSON-safe Python object.

    Missing values (``None``, ``NaN``, ``pd.NA``, ``NaT``) and non-finite
    numbers (``inf``/``-inf``) become ``None`` (JSON ``null``). Dates and
    datetimes become ISO-8601 strings. NumPy scalars are unwrapped to native
    ``int``/``float``/``bool``. Anything already native is returned as is.

    ``pd.isna`` is checked first because it recognises pandas' sentinels
    before we try to unwrap them.
    """
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, np.generic):
        value = value.item()

    if value is None:
        return None
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    return value


def project_to_record(row):
    """Turn one project row into a record holding exactly ``PROJECT_FIELDS``.

    ``region`` and ``province`` are pulled out of the nested ``location``
    dictionary so the dashboard never has to reach into a nested object.
    Fields listed in ``PROJECT_FIELDS`` but absent from the row become null.
    """
    location = row.get("location")
    if not isinstance(location, dict):
        location = {}

    record = {}
    for field in PROJECT_FIELDS:
        if field == "region":
            record[field] = to_jsonable(location.get("region"))
        elif field == "province":
            record[field] = to_jsonable(location.get("province"))
        else:
            record[field] = to_jsonable(row.get(field))
    return record


def projects_to_records(df):
    """Convert a processed projects frame into a list of JSON-safe records."""
    return [project_to_record(row) for row in df.to_dict(orient="records")]


def anomalies_to_records(flagged_df):
    """Convert flagged anomalies into records keyed by ``ANOMALY_COLUMNS``.

    ``ANOMALY_COLUMNS`` is imported from ``pipeline.anomaly`` so the exported
    evidence schema can never drift from the detector's own definition.
    """
    columns = [col for col in ANOMALY_COLUMNS if col in flagged_df.columns]
    return [
        {col: to_jsonable(row[col]) for col in columns}
        for row in flagged_df[columns].to_dict(orient="records")
    ]


def write_json(records, path):
    """Encode ``records`` as compact UTF-8 JSON and write them to ``path``.

    ``ensure_ascii=False`` keeps Filipino place names readable in the file;
    ``allow_nan=False`` makes any leaked ``NaN``/``Infinity`` raise instead of
    silently producing invalid JSON.
    """
    text = json.dumps(
        records, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main():
    projects = load_projects()
    baselines = compute_baselines(projects)
    flagged = flagged_projects(projects, baselines)

    project_records = projects_to_records(projects)
    anomaly_records = anomalies_to_records(flagged)
    region_summary = build_region_summary(project_records, anomaly_records)

    write_json(project_records, PROJECTS_JSON)
    write_json(anomaly_records, ANOMALIES_JSON)
    write_json(region_summary, REGION_SUMMARY_JSON)

    print(f"Projects exported: {len(project_records):,}")
    print(f"Anomalies exported: {len(anomaly_records):,}")
    print(f"Regions summarized: {len(region_summary['regions']):,}")
    for path in (PROJECTS_JSON, ANOMALIES_JSON, REGION_SUMMARY_JSON):
        size_mb = path.stat().st_size / 1_000_000
        print(f"Saved to: {path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
