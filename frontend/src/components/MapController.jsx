import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'

import { isValidCoordinate } from '../lib/markers.js'
import { findRowByLabel } from '../lib/regions.js'

// Moves the map around without user gestures:
//   * the selected flagged project -> fly to its coordinates (when valid);
//   * the selected region -> zoom to its boundary polygon, falling back to the
//     flagged-project extent when the region has no polygon (e.g. Negros
//     Island Region, which the 2023 boundary file does not contain).
//
// When a project is selected, its point fly-to wins over the region zoom so
// the two never fight: the region effect bails if the current selection is a
// valid-coordinate project inside that region.

export default function MapController({
  geo,
  summary,
  selectedRegion,
  selected,
  markers,
}) {
  const map = useMap()

  // Fly to the selected project when it has plotable coordinates.
  useEffect(() => {
    if (
      selected &&
      isValidCoordinate(selected.latitude, selected.longitude)
    ) {
      map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 11), {
        duration: 0.6,
      })
    }
  }, [selected, map])

  // Zoom to the selected region's boundary, or its flagged-project extent.
  useEffect(() => {
    if (!selectedRegion) {
      return
    }
    if (
      selected &&
      isValidCoordinate(selected.latitude, selected.longitude) &&
      selected.region === selectedRegion
    ) {
      return
    }

    let bounds = null
    const row = findRowByLabel(summary, selectedRegion)
    if (row?.on_map && row.psgc != null && geo) {
      const feature = geo.features?.find(
        (f) => f.properties?.adm1_psgc === row.psgc,
      )
      if (feature) {
        bounds = L.geoJSON(feature).getBounds()
      }
    }

    if (!bounds) {
      const points = (markers ?? [])
        .filter((m) => m.region === selectedRegion)
        .map((m) => [m.latitude, m.longitude])
      if (points.length > 0) {
        bounds = L.latLngBounds(points)
      }
    }

    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 })
    }
  }, [selectedRegion, geo, summary, markers, map, selected])

  return null
}