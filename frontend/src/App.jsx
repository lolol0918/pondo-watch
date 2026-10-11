import { useEffect, useMemo, useState } from 'react'

import {
  loadAnomalies,
  loadRegionSummary,
} from './api/dataSource.js'
import Disclaimer from './components/Disclaimer.jsx'
import EvidencePanel from './components/EvidencePanel.jsx'
import FlaggedProjectList from './components/FlaggedProjectList.jsx'
import MapCoverageNote from './components/MapCoverageNote.jsx'
import MarkerCoordinateStatus from './components/MarkerCoordinateStatus.jsx'
import RegionMap from './components/RegionMap.jsx'
import RegionSelector, { ALL_REGIONS } from './components/RegionSelector.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import { DEFAULT_SORT } from './lib/listFilters.js'
import { withCoordinates } from './lib/markers.js'

export default function App() {
  const [summary, setSummary] = useState(null)
  const [anomalies, setAnomalies] = useState(null)
  const [anomaliesError, setAnomaliesError] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(null) // null = all
  const [selected, setSelected] = useState(null) // anomaly record
  const [filters, setFilters] = useState({
    sort: DEFAULT_SORT,
    query: '',
    category: '',
    year: '',
    minRatio: '',
  })

  useEffect(() => {
    loadRegionSummary()
      .then(setSummary)
      .catch(() => {
        setAnomaliesError(true)
        setSummary({ error: true })
      })
  }, [])

  // Fetch the flagged list in the background so cards + map paint first.
  useEffect(() => {
    let cancelled = false
    loadAnomalies()
      .then((data) => {
        if (!cancelled) {
          setAnomalies(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnomaliesError(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSelectRegion = (label) => {
    setSelectedRegion(label === ALL_REGIONS ? null : label)
    setSelected(null)
  }

  const handleSelectProject = (anomaly) => {
    setSelected(anomaly)
    // Focus the list on the project's region, unless it is already focused.
    const isAll = !selectedRegion || selectedRegion === ALL_REGIONS
    if (anomaly.region && (isAll || anomaly.region !== selectedRegion)) {
      setSelectedRegion(anomaly.region)
    }
  }

  const handleResetView = () => {
    setSelected(null)
    setSelectedRegion(null)
  }

  // The dots drawn on the map: valid-coordinate flagged projects, scoped to
  // the selected region (or all of them when no region is chosen).
  const markers = useMemo(
    () => withCoordinates(anomalies, selectedRegion || null),
    [anomalies, selectedRegion],
  )

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title-block">
          <h1>Pondo Watch</h1>
          <p className="app-subtitle">
            Screening dashboard for public-infrastructure project budgets
          </p>
        </div>
        <Disclaimer />
      </header>

      <main className="app-main">
        <SummaryCards summary={!summary?.error ? summary : null} />

        <section className="map-section">
          <MarkerCoordinateStatus
            anomalies={anomalies}
            markers={markers}
            selectedRegion={selectedRegion}
          />
          <RegionMap
            summary={!summary?.error ? summary : null}
            selectedRegion={selectedRegion}
            onSelectRegion={handleSelectRegion}
            markers={markers}
            selected={selected}
            onSelectProject={handleSelectProject}
            onReset={handleResetView}
          />
          <MapCoverageNote summary={!summary?.error ? summary : null} />
          <RegionSelector
            summary={!summary?.error ? summary : null}
            selectedRegion={selectedRegion}
            onChange={handleSelectRegion}
          />
        </section>

        <section className="results-grid">
          {summary?.error ? (
            <div className="load-error" role="alert">
              Failed to load the region summary. Run{' '}
              <code>.venv/bin/python -m pipeline.export_json</code> from the
              repository root and restart the dev server.
            </div>
          ) : (
            <>
              <FlaggedProjectList
                anomalies={anomalies}
                selectedRegion={selectedRegion}
                filters={filters}
                onFiltersChange={setFilters}
                onChangeRegion={handleSelectRegion}
                selectedContractId={selected?.contractId ?? null}
                onSelectProject={handleSelectProject}
              />
              <EvidencePanel
                anomaly={selected}
                onClose={() => setSelected(null)}
              />
            </>
          )}
          {anomaliesError ? (
            <div className="load-error" role="alert">
              Flagged projects failed to load.
            </div>
          ) : null}
        </section>
      </main>

      <footer className="app-footer">
        Data: DPWH annual infrastructure program (processed by the Pondo Watch
        pipeline). Flags are peer-group statistics only.
      </footer>
    </div>
  )
}