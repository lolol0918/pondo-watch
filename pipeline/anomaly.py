"""Cost anomaly detector for Pondo Watch.

Comparable projects are grouped by ``componentCategories``, ``region`` and
``infraYear``. Within each peer group we compute the median budget and the
median absolute deviation (MAD), then a modified z-score::

    modified z = 0.6745 * (budget - median) / MAD

A project is flagged only when it clears all of the following:

* it sits in a peer group of at least ``MIN_GROUP_SIZE`` comparable projects;
* its budget is at least ``MEDIAN_MULTIPLE_THRESHOLD`` times the group median;
* its modified z-score is at least ``MODIFIED_Z_THRESHOLD``.

Because the flag is driven by the median and the MAD, a few expensive
projects cannot drag the baseline up and hide themselves. The MAD is the
median absolute deviation of the raw budgets.

Flags mark budgets that are unusually high relative to comparable projects.
They are a screening signal, not proof of overpricing or any other problem.
"""

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

PROCESSED_FILE = ROOT / "data" / "processed" / "projects.parquet"
BASELINE_FILE = ROOT / "data" / "processed" / "category_baselines.parquet"
ANOMALY_FILE = ROOT / "data" / "processed" / "cost_anomalies.parquet"

# Minimum number of comparable projects a peer group needs before we trust
# its median and MAD. Groups below this size never emit an anomaly.
MIN_GROUP_SIZE = 30

# A budget must be this many times the group median to be worth a look.
MEDIAN_MULTIPLE_THRESHOLD = 2.0

# A budget must sit this many robust sigmas above the group median.
MODIFIED_Z_THRESHOLD = 3.5

# Scales the MAD into a standard-deviation-equivalent for the modified
# z-score. 0.6745 is the inverse of the usual 1.4826 consistency constant.
MODIFIED_Z_SCALE = 0.6745

# Descriptions matching this pattern look like bundled work and are not
# comparable to a single project, so they are excluded up front.
BUNDLED_PATTERN = r"\b(?:clusters?|packages?|various projects)\b"

GROUP_KEYS = ["componentCategories", "region", "infraYear"]

# Peer-group statistics added to every output row.
METRIC_COLUMNS = ["median_budget", "median_multiple", "anomaly_score", "group_size"]


def extract_region(location):
    """Pull the region out of the ``location`` dict, or return None."""
    if isinstance(location, dict):
        return location.get("region")
    return None


def load_projects(path=PROCESSED_FILE):
    """Load processed projects and expose the region as a top-level column."""
    df = pd.read_parquet(path)
    df["region"] = df["location"].apply(extract_region)
    return df


def _is_present(series):
    """True where a value exists and is not blank whitespace."""
    return series.notna() & (series.astype("string").str.strip() != "")


def find_bundled_descriptions(descriptions):
    """Boolean mask of descriptions that look like bundled work."""
    return descriptions.str.contains(
        BUNDLED_PATTERN, case=False, regex=True, na=False
    )


def prepare_analysis_frame(df):
    """Keep only records that are eligible, valid, and comparable.

    Drops projects that are not marked eligible, have a non-finite or
    non-positive budget, are missing a category/region/infra year, or whose
    description looks like bundled work.
    """
    valid_budget = np.isfinite(df["budget"]) & (df["budget"] > 0)
    valid_keys = (
        _is_present(df["componentCategories"])
        & _is_present(df["region"])
        & _is_present(df["infraYear"])
    )
    not_bundled = ~find_bundled_descriptions(df["description"])

    mask = (
        df["eligible_for_cost_analysis"].fillna(False)
        & valid_budget
        & valid_keys
        & not_bundled
    )
    return df[mask].copy()


def compute_baselines(
    analysis, group_keys=GROUP_KEYS, min_group_size=MIN_GROUP_SIZE
):
    """Median, MAD and size for every peer group large enough to trust.

    ``group_size`` is the count of comparable projects in the analysis frame,
    i.e. after every validity and bundling filter, so it always matches the
    sample the median and MAD were computed from.
    """

    def robust_mad(values):
        center = np.median(values)
        return np.median(np.abs(values - center))

    baselines = (
        analysis.groupby(group_keys)["budget"]
        .agg(group_size="size", median_budget="median", mad_budget=robust_mad)
        .reset_index()
    )
    return baselines[baselines["group_size"] >= min_group_size].reset_index(
        drop=True
    )


def detect_anomalies(df=None):
    """Return every project scored against its peer group.

    All source columns are preserved and the peer-group statistics are added
    along with a boolean ``is_cost_anomaly`` column. Projects that cannot be
    scored safely (no baseline, or a zero MAD) get a NaN score and are never
    flagged.
    """
    if df is None:
        df = load_projects()

    analysis = prepare_analysis_frame(df)
    baselines = compute_baselines(analysis)

    scored = df.merge(baselines, on=GROUP_KEYS, how="left")

    # A zero MAD makes the modified z-score undefined. Keep the score NaN
    # instead of dividing by zero or inventing an infinite score.
    safe_mad = scored["mad_budget"].where(scored["mad_budget"] > 0)
    scored["median_multiple"] = scored["budget"] / scored["median_budget"]
    scored["anomaly_score"] = (
        MODIFIED_Z_SCALE
        * (scored["budget"] - scored["median_budget"])
        / safe_mad
    )

    scored["is_cost_anomaly"] = (
        scored["eligible_for_cost_analysis"].fillna(False)
        & (scored["group_size"] >= MIN_GROUP_SIZE)
        & (scored["mad_budget"] > 0)
        & (scored["median_multiple"] >= MEDIAN_MULTIPLE_THRESHOLD)
        & (scored["anomaly_score"] >= MODIFIED_Z_THRESHOLD)
    )
    return scored


def flagged_projects(df=None):
    """The flagged anomalies, richest first, with source columns preserved."""
    scored = detect_anomalies(df)
    output_columns = [column for column in scored.columns if column != "mad_budget"]

    flagged = scored[scored["is_cost_anomaly"]].copy()
    flagged = flagged.sort_values(
        ["median_multiple", "contractId"],
        ascending=[False, True],
        kind="mergesort",
    )
    return flagged[output_columns].reset_index(drop=True)


def main():
    df = load_projects()
    analysis = prepare_analysis_frame(df)
    baselines = compute_baselines(analysis)
    flagged = flagged_projects(df)

    BASELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
    baselines.to_parquet(BASELINE_FILE, index=False)
    flagged.to_parquet(ANOMALY_FILE, index=False)

    examined = len(analysis)
    rate = 100.0 * len(flagged) / examined if examined else 0.0

    print(f"Comparable projects examined: {examined:,}")
    print(f"Peer groups with >= {MIN_GROUP_SIZE} projects: {len(baselines):,}")
    print(f"Flagged cost anomalies: {len(flagged):,} ({rate:.2f}%)")
    print(f"Baselines saved to: {BASELINE_FILE}")
    print(f"Anomalies saved to: {ANOMALY_FILE}")


if __name__ == "__main__":
    main()
