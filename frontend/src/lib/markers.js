// Coordinate helpers for plotting flagged projects.
//
// An anomaly record carries `latitude`/`longitude` copied from the processed
// project by the pipeline. A coordinate is "valid" only when it is a real
// number inside the geographic ranges and is not the (0, 0) placeholder —
// non-plotable records are counted but never turned into markers.

/**
 * Whether a latitude/longitude pair is safe to plot.
 * @param {number|null|undefined} latitude
 * @param {number|null|undefined} longitude
 * @returns {boolean}
 */
export function isValidCoordinate(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false
  }
  return !(latitude === 0 && longitude === 0)
}

/**
 * Totals over a set of anomaly records: how many have plotable coordinates
 * and how many do not. `region === null` (or undefined) counts everything.
 *
 * @param {Array<object>|null} anomalies
 * @param {string|null} [region]
 * @returns {{total: number, valid: number, without: number}}
 */
export function countCoordinateCoverage(anomalies, region = null) {
  const total = (anomalies ?? []).filter((a) => !region || a.region === region)
  let valid = 0
  for (const record of total) {
    if (isValidCoordinate(record.latitude, record.longitude)) {
      valid += 1
    }
  }
  return { total: total.length, valid, without: total.length - valid }
}

/**
 * The anomaly records that should be drawn as markers: those within `region`
 * (null = all regions) that have plotable coordinates. Markers are never
 * jittered and never clustered — every valid point gets its own marker.
 *
 * @param {Array<object>|null} anomalies
 * @param {string|null} [region]
 * @returns {Array<object>}
 */
export function withCoordinates(anomalies, region = null) {
  return (anomalies ?? []).filter(
    (a) =>
      (!region || a.region === region) &&
      isValidCoordinate(a.latitude, a.longitude),
  )
}