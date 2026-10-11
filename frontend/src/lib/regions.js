// Helpers that join the region summary with the map boundaries.
//
// The summary (from the Python pipeline) owns the label -> PSGC mapping. The
// boundary file is keyed by `adm1_psgc`. These helpers expose that join and
// make it explicit which summary rows have no polygon. No fragile substring
// matching anywhere: everything is exact-key lookups.

/**
 * Map PSGC codes in the summary to the summary row for a region.
 * Returns a Map<number, object> so the GeoJSON layer can look up stats by the
 * feature's `adm1_psgc` property.
 */
export function buildPsgcLookup(summary) {
  const lookup = new Map()
  for (const row of summary?.regions ?? []) {
    if (row.psgc !== null && row.psgc !== undefined) {
      lookup.set(row.psgc, row)
    }
  }
  return lookup
}

export function findRowByLabel(summary, label) {
  if (!summary?.regions) {
    return null
  }
  return summary.regions.find((row) => row.region === label) ?? null
}

/**
 * The single-selectable set for the UI: every dataset region. Non-geographic
 * and off-map rows are included — they are selectable and their projects are
 * readable — but they are labelled as not drawn on the map.
 */
export function selectableRegions(summary) {
  return summary?.regions ?? []
}