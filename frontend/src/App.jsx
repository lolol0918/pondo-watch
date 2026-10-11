import { useEffect, useState } from 'react'

import {
  loadAnomalies,
  loadRegionSummary,
} from './api/dataSource.js'
import Disclaimer from './components/Disclaimer.jsx'
import EvidencePanel from './components/EvidencePanel.jsx'
import FlaggedProjectList from './components/FlaggedProjectList.jsx'
import MapCoverageNote from './components/MapCoverageNote.jsx'
import RegionMap from './components/RegionMap.jsx'
import RegionSelector, { ALL_REGIONS } from './components/RegionSelector.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import { findRowByLabel } from './lib/regions.js'

export default function App() {
  const [summary, setSummary] = useState(null)
  const [anomalies, setAnomalies] = useState(null)
  const [anomaliesError, setAnomaliesError] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(null) // null = all
  const [selected, setSelected] = useState(null) // anomaly record

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

  const selectedRow = findRowByLabel(summary, selectedRegion)

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
          <RegionMap
            summary={!summary?.error ? summary : null}
            selectedRegion={selectedRegion}
            onSelectRegion={handleSelectRegion}
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
                selectedContractId={selected?.contractId ?? null}
                onSelectProject={(anomaly) => {
                  setSelected(anomaly)
                  if (anomaly.region && !selectedRow) {
                    // Selecting a project also focuses its region, unless the
                    // region isn't drawable (e.g. Negros Island Region).
                    setSelectedRegion(anomaly.region)
                  }
                }}
              />
              <EvidencePanel anomaly={selected} />
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