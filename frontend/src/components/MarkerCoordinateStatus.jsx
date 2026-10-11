import { formatInteger, formatPercent } from '../lib/format.js'
import { countCoordinateCoverage } from '../lib/markers.js'
import { ALL_REGIONS } from './RegionSelector.jsx'

// Requirement: say how many flagged projects can and cannot be plotted.
// Shown as a compact status line above the map so the marker count is not
// silently smaller than the flagged count.

export default function MarkerCoordinateStatus({
  anomalies,
  markers,
  selectedRegion,
}) {
  if (!anomalies) {
    return <div className="marker-status">Coordinates: loading…</div>
  }

  const { total, valid, without } = countCoordinateCoverage(anomalies)
  const pct = total ? (100 * valid) / total : 0
  const scope =
    !selectedRegion || selectedRegion === ALL_REGIONS
      ? 'nationwide'
      : selectedRegion

  return (
    <div className="marker-status">
      <strong>Markers:</strong> {formatInteger(valid)} of {formatInteger(total)}{' '}
      flagged projects have valid coordinates ({formatPercent(pct)});{' '}
      {formatInteger(without)} have none and are not drawn. Showing{' '}
      {formatInteger(markers?.length ?? 0)} {scope} now.
    </div>
  )
}