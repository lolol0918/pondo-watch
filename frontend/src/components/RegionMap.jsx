import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { GEOJSON_URL } from '../api/dataSource.js'
import { buildPsgcLookup, findRowByLabel } from '../lib/regions.js'
import { formatInteger, formatPercent } from '../lib/format.js'
import {
  SEVERITY_BUCKETS,
  colorForFlaggedShare,
  maxFlaggedShare,
} from '../lib/scale.js'
import FlaggedMarkers from './FlaggedMarkers.jsx'
import MapController from './MapController.jsx'

const STROKE = '#64748b'
const SELECTED_STROKE = '#0f172a'

function FitToData({ data }) {
  const map = useMap()
  useEffect(() => {
    if (!data) {
      return
    }
    const bounds = L.geoJSON(data).getBounds()
    map.fitBounds(bounds, { padding: [20, 20] })
  }, [data, map])
  return null
}

export default function RegionMap({
  summary,
  selectedRegion,
  onSelectRegion,
  markers,
  selected,
  onSelectProject,
  onReset,
}) {
  const [geo, setGeo] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const psgcLookup = useMemo(() => buildPsgcLookup(summary), [summary])
  const selectedRow = findRowByLabel(summary, selectedRegion)

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    fetch(GEOJSON_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        if (!cancelled) {
          setGeo(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const maxShare = useMemo(() => maxFlaggedShare(summary), [summary])

  const styleFor = (feature) => {
    const code = feature.properties?.adm1_psgc
    const row = psgcLookup.get(code)
    const isSelected = selectedRow && row && row.psgc === selectedRow.psgc
    return {
      color: isSelected ? SELECTED_STROKE : STROKE,
      weight: isSelected ? 2 : 0.8,
      fillColor: colorForFlaggedShare(row?.flagged_percentage, maxShare),
      fillOpacity: row ? 0.85 : 0.5,
    }
  }

  const onEachFeature = (feature, layer) => {
    const code = feature.properties?.adm1_psgc
    const row = psgcLookup.get(code)
    const label = row ? row.region : feature.properties?.adm1_en

    layer.bindTooltip(
      row
        ? `${label} — ${formatInteger(row.projects)} projects, ` +
          `${formatInteger(row.flagged)} flagged (${formatPercent(row.flagged_percentage)})`
        : `${label} — no matching projects in dataset`,
      { sticky: true },
    )

    layer.on('click', () => {
      if (row) {
        onSelectRegion(row.region)
      }
    })
  }

  return (
    <div
      className="map-wrap"
      role="region"
      aria-label="Map of Philippine regions shaded by flagged share, with flagged-project markers"
    >
      {loadError ? (
        <div className="map-error" role="alert">
          <p>Map boundaries failed to load.</p>
          <button
            type="button"
            className="retry"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        // preferCanvas renders all vectors (polygons and the flagged-project
        // dots) on Leaflet canvas layers, which keeps thousands of markers
        // fast. Dots sit in the marker pane above the polygons, and markers
        // set bubblingMouseEvents=false, so region polygons never swallow or
        // block a marker click.
        <MapContainer
          className="region-map"
          center={[12.5, 122.0]}
          zoom={5}
          scrollWheelZoom={false}
          preferCanvas
        >
          {geo ? (
            <>
              <GeoJSON
                data={geo}
                style={styleFor}
                onEachFeature={onEachFeature}
              />
              <FitToData data={geo} />
            </>
          ) : null}
          <FlaggedMarkers
            markers={markers}
            summary={summary}
            selectedContractId={selected?.contractId ?? null}
            onSelectProject={onSelectProject}
          />
          <MapController
            geo={geo}
            summary={summary}
            selectedRegion={selectedRegion}
            selected={selected}
            markers={markers}
            onReset={onReset}
          />
        </MapContainer>
      )}
      {!geo && !loadError ? (
        <div className="map-loading" role="status" aria-live="polite">
          Loading region boundaries…
        </div>
      ) : null}
      <div className="map-legend" aria-label="Map legend">
        <div className="legend-block">
          <span className="legend-block-title">Region fill — flagged share</span>
          <span className="legend-row">
            <span className="legend-end">Low</span>
            <span className="legend-gradient" />
            <span className="legend-end">High</span>
          </span>
        </div>
        <div className="legend-block">
          <span className="legend-block-title">
            Markers — budget vs. peer median
          </span>
          <span className="legend-buckets">
            {SEVERITY_BUCKETS.map((bucket) => (
              <span className="legend-bucket" key={bucket.key}>
                <span
                  className="legend-dot"
                  style={{ backgroundColor: bucket.color }}
                />
                {bucket.label}
              </span>
            ))}
          </span>
          <span className="legend-row legend-sizes">
            <span className="legend-size">
              <span className="legend-dot legend-dot-small" /> near median
            </span>
            <span className="legend-size">
              <span className="legend-dot legend-dot-large" /> far above
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}