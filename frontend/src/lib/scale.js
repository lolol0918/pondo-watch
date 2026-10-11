// Shared choropleth colour scale for the flagged-share statistic.
//
// Kept apart from the map component so both the region polygons and the
// flagged-project markers use exactly the same palette: the darkest red means
// the highest flagged share in the current dataset, near-white the lowest.

export const COLOR_MIN = '#fef3f2'
export const COLOR_SPIKE = '#dc2626'
export const COLOR_MISSING = '#e7e7e7'

/**
 * Interpolate between the low (near-white) and high (red) ends of the scale.
 * `value` is a flagged-percentage; `max` anchors the darkest red.
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
  const start = [
    parseInt(COLOR_MIN.slice(1, 3), 16),
    parseInt(COLOR_MIN.slice(3, 5), 16),
    parseInt(COLOR_MIN.slice(5, 7), 16),
  ]
  const end = [
    parseInt(COLOR_SPIKE.slice(1, 3), 16),
    parseInt(COLOR_SPIKE.slice(3, 5), 16),
    parseInt(COLOR_SPIKE.slice(5, 7), 16),
  ]
  const hex = start
    .map((channel, i) =>
      Math.round(channel + (end[i] - channel) * t).toString(16).padStart(2, '0'),
    )
    .join('')
  return `#${hex}`
}

/**
 * The largest flagged-percentage among on-map regions, which anchors the
 * darkest end of the choropleth legend.
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