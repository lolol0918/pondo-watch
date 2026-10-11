"""Cost anomaly detector for Pondo Watch.

Comparable projects are grouped by ``componentCategories``, ``region`` and
``infraYear``. Within each peer group we compute the median log10 budget and
the median absolute deviation (MAD), then a modified z-score::

    anomaly_score = (log10(budget) - median_log) / (MAD_SCALE * mad_log)

``MAD_SCALE`` (1.4826) is the consistency constant that turns the MAD into a
standard-deviation-equivalent, so ``anomaly_score`` is measured in robust
sigmas. A project is flagged only when all of the following hold:

* it is an eligible, positively-budgeted, non-bundled project;
* it sits in a peer group of at least ``MIN_GROUP_SIZE`` comparable projects;
* its log budget strictly clears the group's robust fence::

      log10(budget) > median_log + MAD_SIGMAS * MAD_SCALE * mad_log

The MAD is floored at ``MAD_FLOOR`` before scoring. A group whose budgets are
nearly identical has a MAD close to zero, and the raw modified z-score would
explode towards infinity (or divide by zero). Flooring the MAD keeps every
score finite and comparable; the cap this imposes is documented on
``MAD_FLOOR`` rather than hidden. Because both the median and the fence are
driven by the typical member of the group, a few expensive projects cannot
drag the baseline up and hide themselves.

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

# Consistency constant: 1.4826 = 1 / 0.6745. It turns the MAD into an
# estimate of the standard deviation so the z-score is comparable across
# groups of different spreads.
MAD_SCALE = 1.4826

# A budget must sit this many robust sigmas above its group median.
MAD_SIGMAS = 3.0

# Minimum MAD, in log10 units, treated as a meaningful spread. Peer-group
# budgets rarely cluster tighter than this (0.01 log10 ~= 2.3%) around their
# median, so smaller MAD values are treated as noise/rounding. Flooring the
# MAD bounds the modified z-score for near-degenerate groups instead of
# letting a tiny denominator produce an absurd (or infinite) score. This is
# a deliberate, documented cap on those scores, not a silent truncation.
MAD_FLOOR = 0.01

# Descriptions matching this pattern look like bundled work and are not
# comparable to a single project, so they are excluded up front. It matches:
#   * the words "cluster(s)" and "package(s)";
#   * "various projects" and "various <project type> projects"
#     (e.g. "various water supply projects"), but only when "projects"
#     follows "various" within a short span that does not cross a sentence
#     break. This keeps ordinary descriptions such as "various beach
#     resorts" from being mistaken for bundles.
BUNDLED_PATTERN = (
    r"\b(?:clusters?|packages?)\b"
    r"|\bvarious\b[^.\n]{0,48}?\bprojects?\b"
)

GROUP_KEYS = ["componentCategories", "region", "infraYear"]

# Columns written to the anomalies parquet for every flagged project. They
# include the source identifiers and the peer-group evidence (median, MAD,
# robust fence, size) behind each flag.
ANOMALY_COLUMNS = [
    "contractId",
    "description",
    "category",
    "componentCategories",
    "region",
    "infraYear",
    "budget",
    "log_budget",
    "median_budget",
    "median_log",
    "mad_log",
    "fence_budget",
    "median_multiple",
    "anomaly_score",
    "group_size",
]


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

    mask = (
        df["eligible_for_cost_analysis"].fillna(False)
        & valid_budget
        & valid_keys
    )
    if "description" in df.columns:
        mask &= ~find_bundled_descriptions(df["description"])
    return df[mask].copy()


def compute_baselines(
    df, group_keys=GROUP_KEYS, min_group_size=MIN_GROUP_SIZE
):
    """Median, MAD and robust fence for every peer group large enough.

    ``group_size`` is the number of distinct comparable contracts in the
    group, i.e. after every validity and bundling filter, so it always
    matches the sample the median and MAD were computed from.
    """
    analysis = prepare_analysis_frame(df)
    log_budget = np.log10(analysis["budget"])

    def robust_mad(values):
        center = np.median(values)
        return np.median(np.abs(values - center))

    baselines = (
        analysis.assign(log_budget=log_budget)
        .groupby(group_keys)
        .agg(
            group_size=("contractId", "nunique"),
            median_log=("log_budget", "median"),
            mad_log=("log_budget", robust_mad),
        )
        .reset_index()
    )
    baselines["median_budget"] = 10 ** baselines["median_log"]
    baselines["fence_budget"] = 10 ** (
        baselines["median_log"]
        + MAD_SIGMAS * MAD_SCALE * baselines["mad_log"].clip(lower=MAD_FLOOR)
    )
    return baselines[baselines["group_size"] >= min_group_size].reset_index(
        drop=True
    )


def detect_anomalies(df=None, baselines=None):
    """Return every project scored against its peer group.

    All source columns are preserved and the peer-group statistics are added
    along with a boolean ``is_cost_anomaly`` column. Projects without a
    baseline are left unscored (NaN) and never flagged; every project that
    has a baseline gets a finite score, even when its group MAD is zero.
    """
    if df is None:
        df = load_projects()
    if baselines is None:
        baselines = compute_baselines(df)

    scored = df.merge(baselines, on=GROUP_KEYS, how="left")

    with np.errstate(divide="ignore", invalid="ignore"):
        scored["log_budget"] = np.log10(scored["budget"])
        scored["median_multiple"] = scored["budget"] / scored["median_budget"]

    # Floor the MAD so the modified z-score stays finite and bounded for
    # groups whose budgets are (near) identical. Rows without a baseline
    # keep a NaN MAD and therefore a NaN score, but they can never flag.
    effective_mad = scored["mad_log"].clip(lower=MAD_FLOOR)
    scored["anomaly_score"] = (
        scored["log_budget"] - scored["median_log"]
    ) / (MAD_SCALE * effective_mad)

    valid_budget = np.isfinite(scored["budget"]) & (scored["budget"] > 0)
    if "description" in scored.columns:
        not_bundled = ~find_bundled_descriptions(scored["description"])
    else:
        not_bundled = pd.Series(True, index=scored.index)

    fence_log = scored["median_log"] + MAD_SIGMAS * MAD_SCALE * effective_mad
    scored["is_cost_anomaly"] = (
        scored["eligible_for_cost_analysis"].fillna(False)
        & valid_budget
        & not_bundled
        & (scored["group_size"] >= MIN_GROUP_SIZE)
        & (scored["log_budget"] > fence_log)
    )
    return scored


def flagged_projects(df=None, baselines=None):
    """The flagged anomalies, richest first, with the anomaly columns."""
    scored = detect_anomalies(df, baselines)
    flagged = scored[scored["is_cost_anomaly"]].copy()
    flagged = flagged.sort_values(
        ["median_multiple", "contractId"],
        ascending=[False, True],
        kind="mergesort",
    )
    return flagged[ANOMALY_COLUMNS].reset_index(drop=True)


def main():
    df = load_projects()
    baselines = compute_baselines(df)
    flagged = flagged_projects(df)

    BASELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
    baselines.to_parquet(BASELINE_FILE, index=False)
    flagged.to_parquet(ANOMALY_FILE, index=False)

    examined = len(prepare_analysis_frame(df))
    rate = 100.0 * len(flagged) / examined if examined else 0.0

    print(f"Comparable projects examined: {examined:,}")
    print(f"Peer groups with >= {MIN_GROUP_SIZE} projects: {len(baselines):,}")
    print(f"Flagged cost anomalies: {len(flagged):,} ({rate:.2f}%)")
    print(f"Baselines saved to: {BASELINE_FILE}")
    print(f"Anomalies saved to: {ANOMALY_FILE}")


if __name__ == "__main__":
    main()