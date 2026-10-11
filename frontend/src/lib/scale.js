// Shared colour scales for the map.
//
// Two encodings, deliberately separated so the choropleth never borrows the
// markers' palette:
//
//  * region fill — a muted, single-hue (slate blue) tint encoding flagged
//    share; calm on purpose, because the fill is context, not a verdict;
//  * markers — a colorblind-safe severity scale (Paul Tol's "muted" scheme:
//    sky blue, sand, indigo — no red/green traffic-light semantics), with the
//    ratio also driving marker radius so colour is never the only signal.

export const COLOR_MIN = '#eef2f6'
export const COLOR_SPIKE = '#4f7196'
export const COLOR_MISSING = '#e7e7e7'

/**
 * Interpolate between the low (near-white) and high (muted steel blue) ends
 * of the region-fill scale. `value` is a flagged-percentage; `max` anchors
 * the darkest end.
 */
export function colorForFlaggedShare(value, max) {
  if (
    !max ||
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return COLOR_MISSING
  }
  const t = Math.min(Math.max(value / max, 0), 1)
  const start = hexToRgb(COLOR_MIN)
  const end = hexToRgb(COLOR_SPIKE)
  const hex = start
    .map((channel, i) =>
      Math.round(channel + (end[i] - channel) * t).toString(16).padStart(2, '0'),
    )
    .join('')
  return `#${hex}`
}

/**
 * The largest flagged-share among on-map regions, which anchors the darkest
 * end of the choropleth legend.
 */
export function maxFlaggedShare(summary) {
  let max = 0
  for (const row of summary?.regions ?? []) {
    if (row.on_map && row.flagged_percentage > max) {
      max = row.flagged_percentage
    }
  }
  return max
}

/**
 * The three severity buckets for markers, ordered from mild to severe. The
 * thresholds are multiples of the peer-group median; step points are
 * deliberately round so the legend stays easy to state aloud.
 */
export const SEVERITY_BUCKETS = [
  { key: 'low', label: 'under 10×', min: 0, max: 10, color: '#88ccee' },
  { key: 'medium', label: '10–30×', min: 10, max: 30, color: '#ddcc77' },
  { key: 'high', label: '30× and up', min: 30, max: Infinity, color: '#332288' },
]

/**
 * The severity bucket for a ratio-to-median value, or the low bucket for
 * missing values (a project is flagged, so it is always above the fence —
 * "low" here is relative within the flagged set).
 */
export function severityForRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return SEVERITY_BUCKETS[0]
  }
  const bucket = SEVERITY_BUCKETS.find(
    (b) => ratio >= b.min && ratio < b.max,
  )
  return bucket ?? SEVERITY_BUCKETS[SEVERITY_BUCKETS.length - 1]
}

/**
 * Marker radius for a ratio, clamped to 3-9 px and scaled with the logarithm
 * of the ratio so a 400× project is not 100× the visual weight of a 4× one.
 */
export function markerRadiusForRatio(ratio, maxRatio) {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 3
  }
  const max = Number.isFinite(maxRatio) && maxRatio > 1 ? maxRatio : ratio
  const t = Math.log10(Math.min(ratio, max)) / Math.log10(max)
  return Math.min(9, Math.max(3, 3 + 6 * Math.max(0, Math.min(1, t))))
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}