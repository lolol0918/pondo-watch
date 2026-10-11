import { memo } from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'

import { colorForFlaggedShare, maxFlaggedShare } from '../lib/scale.js'

// One small canvas-rendered dot per flagged project. Radii stay tiny so dense
// areas (e.g. Metro Manila) do not merge into a solid blob. `bubblingMouseEvents`
// is false so clicking a dot never falls through to the region polygon.
function FlaggedMarker({ anomaly, fillColor, selected, onSelectProject }) {
  return (
    <CircleMarker
      center={[anomaly.latitude, anomaly.longitude]}
      radius={selected ? 6 : 3.5}
      pathOptions={{
        color: selected ? '#111827' : '#ffffff',
        weight: selected ? 1.5 : 0.6,
        fillColor,
        fillOpacity: 1,
      }}
      bubblingMouseEvents={false}
      eventHandlers={{ click: () => onSelectProject(anomaly) }}
    >
      <Tooltip sticky>
        {anomaly.contractId} · {anomaly.region}
        <br />
        {anomaly.description}
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
  summary,
  selectedContractId,
  onSelectProject,
}) {
  const maxShare = maxFlaggedShare(summary)

  const regionRows = new Map()
  for (const row of summary?.regions ?? []) {
    regionRows.set(row.region, row)
  }

  return markers.map((anomaly) => {
    const row = regionRows.get(anomaly.region)
    return (
      <MemoizedMarker
        key={anomaly.contractId}
        anomaly={anomaly}
        fillColor={colorForFlaggedShare(row?.flagged_percentage, maxShare)}
        selected={anomaly.contractId === selectedContractId}
        onSelectProject={onSelectProject}
      />
    )
  })
}