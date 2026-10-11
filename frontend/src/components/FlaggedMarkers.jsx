import { memo } from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'

import { formatMultiple, formatPesoCompact } from '../lib/format.js'
import {
  markerRadiusForRatio,
  severityForRatio,
} from '../lib/scale.js'

// One small canvas-rendered dot per flagged project. Colour encodes the
// severity bucket (colorblind-safe palette) and radius encodes the ratio on a
// log scale (3-9 px). `bubblingMouseEvents` is false so clicking a dot never
// falls through to the region polygon below it.
function FlaggedMarker({ anomaly, radius, selected, onSelectProject }) {
  const bucket = severityForRatio(anomaly.median_multiple)
  const r = selected ? radius + 2.5 : radius
  return (
    <CircleMarker
      center={[anomaly.latitude, anomaly.longitude]}
      radius={r}
      pathOptions={{
        color: selected ? '#0f172a' : '#ffffff',
        weight: selected ? 2.5 : 0.7,
        fillColor: bucket.color,
        fillOpacity: 0.95,
      }}
      bubblingMouseEvents={false}
      eventHandlers={{ click: () => onSelectProject(anomaly) }}
    >
      <Tooltip sticky>
        <span className="marker-tooltip-title">{anomaly.description}</span>
        <span className="marker-tooltip-row">
          {formatPesoCompact(anomaly.budget)}
        </span>
        <span className="marker-tooltip-row">
          {formatMultiple(anomaly.median_multiple)} peer median
        </span>
      </Tooltip>
    </CircleMarker>
  )
}

const MemoizedMarker = memo(FlaggedMarker)

/**
 * Every flagged project with valid coordinates, rendered as CircleMarkers on
 * the map's canvas layer. `markers` is already region-filtered by the caller.
 * Markers are never jittered or clustered: every valid point gets a dot.
 */
export default function FlaggedMarkers({
  markers,
  selectedContractId,
  onSelectProject,
}) {
  const maxRatio = maxRatioOf(markers)

  return markers.map((anomaly) => (
    <MemoizedMarker
      key={anomaly.contractId}
      anomaly={anomaly}
      radius={markerRadiusForRatio(anomaly.median_multiple, maxRatio)}
      selected={anomaly.contractId === selectedContractId}
      onSelectProject={onSelectProject}
    />
  ))
}

/** The largest ratio among the markers currently drawn, for radius scaling. */
function maxRatioOf(markers) {
  let max = 0
  for (const marker of markers ?? []) {
    if (
      Number.isFinite(marker.median_multiple) &&
      marker.median_multiple > max
    ) {
      max = marker.median_multiple
    }
  }
  return max
}