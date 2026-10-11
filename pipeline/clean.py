import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

RAW_FILE = ROOT / "dpwh_transparency_data.parquet"
OUTPUT_FILE = ROOT / "data" / "processed" / "projects.parquet"


def main():
    df = pd.read_parquet(RAW_FILE)

    single_category = (
        df["componentCategories"].notna()
        & ~df["componentCategories"].str.contains(",", regex=False, na=False)
    )

    positive_budget = df["budget"] > 0

    valid_region = df["location"].apply(
        lambda location: isinstance(location, dict)
        and bool(location.get("region"))
    )

    # Same rule as pipeline.anomaly.BUNDLED_PATTERN: cluster(s),
    # package(s), "various projects" and "various <project type> projects"
    # (e.g. "various water supply projects"), without crossing a sentence
    # break so ordinary descriptions are left alone.
    not_obviously_bundled = ~df["description"].str.contains(
        r"\b(?:clusters?|packages?)\b|\bvarious\b[^.\n]{0,48}?\bprojects?\b",
        case=False,
        na=False,
    )

    df["eligible_for_cost_analysis"] = (
        single_category
        & positive_budget
        & valid_region
        & not_obviously_bundled
    )

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_FILE, index=False)

    eligible = df["eligible_for_cost_analysis"].sum()

    print(f"Total records: {len(df):,}")
    print(f"Eligible records: {eligible:,}")
    print(f"Excluded records: {len(df) - eligible:,}")
    print(f"Saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
