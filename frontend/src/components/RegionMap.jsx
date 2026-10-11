import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { GEOJSON_URL } from '../api/dataSource.js'
import {
  buildPsgcLookup,
  findRowByLabel,
} from '../lib/regions.js'
import { formatInteger, formatPercent } from '../lib/format.js'

// Choropleth palette: near-white to red as the flagged share rises.
const COLOR_MIN = '#fef3f2'
const COLOR_SPIKE = '#dc2626'
const MISSING_COLOR = '#e7e7e7'
const MISSING_STROKE = '#cbd5e1'
const STROKE = '#64748b'
const SELECTED_STROKE = '#0f172a'

function colorForScale(value, max) {
  if (!max || value === null || value === undefined) {
    return MISSING_COLOR
  }
  const t = Math.min(value / max, 1)
  const c = (start, end) =>
    Math.round(start + (end - start) * t)
  const r = c(parseInt(COLOR_MIN.slice(1, 3), 16), parseInt(COLOR_SPIKE.slice(1, 3), 16))
  const g = c(parseInt(COLOR_MIN.slice(3, 5), 16), parseInt(COLOR_SPIKE.slice(3, 5), 16))
  const b = c(parseInt(COLOR_MIN.slice(5, 7), 16), parseInt(COLOR_SPIKE.slice(5, 7), 16))
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

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

export default function RegionMap({ summary, selectedRegion, onSelectRegion }) {
  const [geo, setGeo] = useState(null)
  const [loadError, setLoadError] = useState(false)

  const psgcLookup = useMemo(() => buildPsgcLookup(summary), [summary])
  const selectedRow = findRowByLabel(summary, selectedRegion)

  useEffect(() => {
    let cancelled = false
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
  }, [])

  const maxShare = useMemo(() => {
    let max = 0
    for (const row of summary?.regions ?? []) {
      if (row.on_map && row.flagged_percentage > max) {
        max = row.flagged_percentage
      }
    }
    return max
  }, [summary])

  const styleFor = (feature) => {
    const code = feature.properties?.adm1_psgc
    const row = psgcLookup.get(code)
    const isSelected =
      selectedRow && row && row.psgc === selectedRow.psgc
    return {
      color: isSelected ? SELECTED_STROKE : STROKE,
      weight: isSelected ? 2 : 0.8,
      fillColor: colorForScale(row?.flagged_percentage, maxShare),
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
    <div className="map-wrap">
      {loadError ? (
        <div className="map-error">Map boundaries failed to load.</div>
      ) : (
        <MapContainer
          className="region-map"
          center={[12.5, 122.0]}
          zoom={5}
          scrollWheelZoom={false}
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
        </MapContainer>
      )}
      <div className="map-legend" aria-hidden="true">
        <span className="legend-swatch" style={{ backgroundColor: COLOR_SPIKE }} />
        higher flagged share &rarr; lighter
      </div>
    </div>
  )
}