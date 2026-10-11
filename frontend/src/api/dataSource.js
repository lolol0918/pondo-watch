// Data access for the dashboard.
//
// The browser is never allowed to request the full project export
// (data/processed/projects.json, ~134 MB). The only files the frontend loads
// are the compact region summary (a few KB, fetched first) and the flagged
// anomaly export (~3 MB, fetched in the background after first paint).

const DATA_BASE = `${import.meta.env.BASE_URL}data/`

async function fetchJson(name) {
  const response = await fetch(`${DATA_BASE}${name}`)
  if (!response.ok) {
    throw new Error(
      `Failed to load ${name} (HTTP ${response.status}). ` +
        `Run \`npm run dev\` from frontend/ so the copy script runs.`,
    )
  }
  return response.json()
}

/** region_summary.json — the tiny file that powers cards, map and selector. */
export function loadRegionSummary() {
  return fetchJson('region_summary.json')
}

/** cost_anomalies.json — the flagged projects themselves (lazy-loaded). */
export function loadAnomalies() {
  return fetchJson('cost_anomalies.json')
}

export const GEOJSON_URL = `${import.meta.env.BASE_URL}geo/ph-regions-2023.geojson`