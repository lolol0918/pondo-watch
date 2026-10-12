# Pondo Watch

A screening dashboard that highlights public-infrastructure projects with
**unusually high budgets relative to comparable projects**.

Pondo Watch reads the DPWH annual infrastructure program dataset, groups
projects into peer groups (same component category, region and infra year), and
flags the ones whose budget sits far above the group's typical value. Every
flag comes with the evidence behind it — peer-group size, median, spread and
score — so a reader can judge the numbers for themselves.

> **A flag is a screening signal, not a finding.** Statistical outliers are
> **not** evidence of corruption or proof of overpricing. Every flagged project
> is a reason for further review, and scope differences (a larger structure,
> harder site conditions, bundled/program-level work) can legitimately explain
> a high multiple. Projects are matched only on category, region and year.

<!-- SCREENSHOT PLACEHOLDER — replace the src with a real capture and delete this comment. -->
![Pondo Watch dashboard](docs/screenshot.png)

## What it does

The project has two halves that talk through files on disk:

1. **Python pipeline** (`pipeline/`) — cleans the raw dataset and runs a robust
   cost-anomaly detector.
2. **React frontend** (`frontend/`) — an interactive dashboard with a flagged
   project list, a region map and an evidence panel for the selected project.

### The detector in one paragraph

Within each peer group the pipeline computes the **median** log10 budget and the
**median absolute deviation** (MAD), then a *modified z-score*:

```
anomaly_score = (log10(budget) - median_log) / (1.4826 * mad_log)
```

`1.4826` turns the MAD into a standard-deviation equivalent, so the score is
measured in robust sigmas. A project is flagged only when it is eligible, has a
positive budget, is not obviously bundled (descriptions mentioning
"cluster(s)", "package(s)" or "various … projects"), sits in a peer group of at
least 30 comparable projects, and clears the group's robust fence:

```
log10(budget) > median_log + 3.0 * 1.4826 * mad_log
```

Because the median and the fence are driven by the *typical* member of the
group, a few expensive projects cannot drag the baseline up and hide
themselves. The MAD is floored (`0.01` log10 units) so scores stay finite and
comparable even for near-identical groups. Full details and rationale live in
`pipeline/anomaly.py`.

## Repository layout

```
pipeline/
  clean.py          # mark records eligible, write data/processed/projects.parquet
  anomaly.py        # peer-group baselines + cost-anomaly detection
  export_json.py    # write the JSON the dashboard consumes
  regions.py        # region metadata and the per-region summary
frontend/
  src/              # React app (list, map, evidence panel, filters, URL state)
  scripts/copy-data.mjs   # bridge pipeline output into frontend/public/
  public/geo/       # vendored 2023 Philippines region boundaries
tests/              # pytest suite for the pipeline
data/
  raw/              # input dataset (git-ignored)
  processed/        # pipeline outputs (git-ignored)
```

## Data flow

```
data/raw/dpwh_transparency_data.parquet
        │  python -m pipeline.clean
        ▼
data/processed/projects.parquet
        │  python -m pipeline.anomaly          → category_baselines.parquet
        │                                       → cost_anomalies.parquet
        │  python -m pipeline.export_json
        ▼
data/processed/
  projects.json         (~134 MB — never loaded by the browser)
  cost_anomalies.json   (~3 MB — flagged projects, lazy-loaded)
  region_summary.json   (~4 KB — powers cards, map and selector)
        │  node frontend/scripts/copy-data.mjs   (runs automatically on dev/build)
        ▼
frontend/public/data/{region_summary,cost_anomalies}.json
```

The large `projects.json` is intentionally **not** copied into the browser
bundle; only the compact summary and the flagged-project export are served.

## Prerequisites

- **Python** 3.11+ (developed on 3.14)
- **Node.js** 20+ and npm (developed on Node 22)
- The raw dataset at `data/raw/dpwh_transparency_data.parquet`
  (the pipeline does not download it; supply the file yourself)

## Build & run

### 1. Set up the Python pipeline

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install numpy pandas pyarrow pytest
```

Place the raw dataset at `data/raw/dpwh_transparency_data.parquet`, then run the
three stages in order:

```bash
python -m pipeline.clean           # -> projects.parquet
python -m pipeline.anomaly         # -> category_baselines.parquet, cost_anomalies.parquet
python -m pipeline.export_json     # -> projects.json, cost_anomalies.json, region_summary.json
```

Each stage prints a short summary (rows examined, groups, flagged projects).

### 2. Run the pipeline tests (optional)

```bash
pytest
```

Tests that need the built dataset skip automatically when
`data/processed/projects.parquet` does not exist yet.

### 3. Install and run the frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

`npm run dev` (and `npm run build`) automatically runs
`scripts/copy-data.mjs`, which copies the required JSON from
`data/processed/` into `frontend/public/data/`. So run the pipeline first, or
the copy script will stop with a "run the pipeline first" error.

### 4. Build for production

```bash
cd frontend
npm run build      # static output in frontend/dist/
npm run preview    # serve the production build locally
npm test           # frontend unit tests (vitest)
```

## Deploying on Vercel

Pondo Watch deploys as a static site. The browser only ever loads the compact
`region_summary.json` and the flagged-project `cost_anomalies.json`, so those
two **generated** files are committed under `frontend/public/data/` — that is
what lets Vercel build straight from Git without running the Python pipeline
(which needs the git-ignored raw dataset). The raw and intermediate files under
`data/` remain ignored, and the ~134 MB `projects.json` is never copied.

`frontend/scripts/copy-data.mjs` regenerates the committed copies from
`data/processed/` whenever the pipeline is present locally; when it is not (as
on Vercel) it keeps the committed copies and the build proceeds.

To deploy:

1. Create a Vercel project and set its **Root Directory** to `frontend`
   (there is no root `package.json`; `frontend/vercel.json` sets the output
   directory). The Vite preset installs deps and runs `npm run build`.
2. Run the pipeline locally (`python -m pipeline.export_json`), then
   `cd frontend && npm run build` to refresh `frontend/public/data/`, and
   commit those two files. That refresh is the "data update" step — push it and
   Vercel redeploys.

Pipeline output is not produced on Vercel, so keep the committed copies in sync
by rebuilding them whenever the data changes.

## Screenshot

The placeholder above (`docs/screenshot.png`) should be replaced with a capture
of the running dashboard. Suggested command to add the file after the app is up:

```bash
mkdir -p docs
# capture http://localhost:5173 and save it to docs/screenshot.png
```

## Tech stack

| Layer    | Tools                                                        |
| -------- | ------------------------------------------------------------ |
| Pipeline | Python, pandas, numpy, pyarrow                               |
| Frontend | React 19, Vite 7, react-leaflet / Leaflet, react-window      |
| Tests    | pytest (pipeline), vitest (frontend)                         |

## Attribution

Region boundaries are from
[`faeldon/philippines-json-maps`](https://github.com/faeldon/philippines-json-maps),
2023 low-resolution GeoJSON (PSGC as of 2023-12-31, MIT). Project data is the
DPWH annual infrastructure program, processed by the Pondo Watch pipeline.
