import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'

import { isValidCoordinate } from '../lib/markers.js'
import { findRowByLabel } from '../lib/regions.js'

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Reset-view control. A plain Leaflet corner button that zooms to the whole
 * country and asks the app to clear its selection and region filter.
 */
function ResetViewControl({ geo, onReset }) {
  const map = useMap()

  useEffect(() => {
    const control = L.control({ position: 'topleft' })
    control.onAdd = () => {
      const container = L.DomUtil.create(
        'div',
        'leaflet-bar leaflet-control reset-view-control',
      )
      const button = L.DomUtil.create('a', '', container)
      button.href = '#'
      button.setAttribute('role', 'button')
      button.setAttribute(
        'aria-label',
        'Reset map view: zoom to the whole country and clear the selection',
      )
      button.title = 'Reset view'
      button.innerHTML =
        '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M8 1.5A6.5 6.5 0 1 0 14.5 8H13a5 5 0 1 1-1.6-3.72L9 6.7V1.5z"/></svg>'

      L.DomEvent.disableClickPropagation(button)
      L.DomEvent.on(button, 'click', (event) => {
        L.DomEvent.preventDefault(event)
        if (geo) {
          map.fitBounds(L.geoJSON(geo).getBounds(), {
            padding: [20, 20],
            animate: !prefersReducedMotion(),
          })
        } else {
          map.setView([12.5, 122.0], 5)
        }
        onReset()
      })
      return container
    }
    control.addTo(map)
    return () => {
      control.remove()
    }
  }, [map, geo, onReset])

  return null
}

// Moves the map around without user gestures:
//   * the selected flagged project -> fly to its coordinates (when valid);
//   * the selected region -> zoom to its boundary polygon, falling back to the
//     flagged-project extent when the region has no polygon (e.g. Negros
//     Island Region, which the 2023 boundary file does not contain).
//
// When a project is selected, its point fly-to wins over the region zoom so
// the two never fight: the region effect bails if the current selection is a
// valid-coordinate project inside that region. All motion respects
// prefers-reduced-motion and zooms never go below 10 for a selected project.

export default function MapController({
  geo,
  summary,
  selectedRegion,
  selected,
  markers,
  onReset,
}) {
  const map = useMap()

  // Fly to the selected project when it has plotable coordinates.
  useEffect(() => {
    if (selected && isValidCoordinate(selected.latitude, selected.longitude)) {
      const target = [selected.latitude, selected.longitude]
      const zoom = Math.max(map.getZoom(), 10)
      if (prefersReducedMotion()) {
        map.setView(target, zoom, { animate: false })
      } else {
        map.flyTo(target, zoom, { duration: 0.6 })
      }
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
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 11,
        animate: !prefersReducedMotion(),
      })
    }
  }, [selectedRegion, geo, summary, markers, map, selected])

  return <ResetViewControl geo={geo} onReset={onReset} />
}