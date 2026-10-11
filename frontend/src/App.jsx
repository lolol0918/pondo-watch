import { useEffect, useMemo, useState } from 'react'

import {
  loadAnomalies,
  loadRegionSummary,
} from './api/dataSource.js'
import Disclaimer from './components/Disclaimer.jsx'
import EvidencePanel from './components/EvidencePanel.jsx'
import FlaggedProjectList from './components/FlaggedProjectList.jsx'
import AboutMap from './components/AboutMap.jsx'
import MarkerCoordinateStatus from './components/MarkerCoordinateStatus.jsx'
import RegionMap from './components/RegionMap.jsx'
import RegionSelector, { ALL_REGIONS } from './components/RegionSelector.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import { withCoordinates } from './lib/markers.js'
import { readUrlState, useUrlPopState, useUrlSync } from './lib/urlState.js'

export default function App() {
  const initialUrl = useMemo(() => readUrlState(window.location.search), [])
  const [summary, setSummary] = useState(null)
  const [anomalies, setAnomalies] = useState(null)
  const [anomaliesError, setAnomaliesError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState(initialUrl.region) // null = all
  const [selected, setSelected] = useState(null) // anomaly record
  const [pendingProjectId, setPendingProjectId] = useState(initialUrl.project)
  const [filters, setFilters] = useState({
    sort: initialUrl.sort,
    query: initialUrl.query,
    category: initialUrl.category,
    year: initialUrl.year,
    minRatio: initialUrl.minRatio,
  })

  useEffect(() => {
    setSummary(null)
    loadRegionSummary()
      .then(setSummary)
      .catch(() => setSummary({ error: true }))
  }, [reloadKey])

  // Fetch the flagged list in the background so cards + map paint first.
  useEffect(() => {
    let cancelled = false
    setAnomaliesError(false)
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
  }, [reloadKey])

  const retry = () => setReloadKey((key) => key + 1)

  // Restore a project from the URL once the list has loaded.
  useEffect(() => {
    if (!anomalies || !pendingProjectId) {
      return
    }
    const record = anomalies.find((a) => a.contractId === pendingProjectId)
    if (record) {
      setSelected(record)
      if (record.region) {
        setSelectedRegion(record.region)
      }
    }
    setPendingProjectId(null)
  }, [anomalies, pendingProjectId])

  // Keep the address bar in step with the dashboard, and re-apply state on
  // back/forward navigation.
  useUrlSync({
    region: selectedRegion,
    project: selected?.contractId ?? pendingProjectId ?? null,
    query: filters.query,
    category: filters.category,
    year: filters.year,
    minRatio: filters.minRatio,
    sort: filters.sort,
  })

  useUrlPopState((url) => {
    setSelectedRegion(url.region)
    setFilters({
      sort: url.sort,
      query: url.query,
      category: url.category,
      year: url.year,
      minRatio: url.minRatio,
    })
    if (url.project) {
      setPendingProjectId(url.project)
    } else {
      setSelected(null)
    }
  })

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

        <div className="dashboard">
          <section className="map-pane">
            <MarkerCoordinateStatus
              anomalies={anomalies}
              markers={markers}
              selectedRegion={selectedRegion}
            />
            <RegionSelector
              summary={!summary?.error ? summary : null}
              selectedRegion={selectedRegion}
              onChange={handleSelectRegion}
            />
            <div className="map-sticky">
              <RegionMap
                summary={!summary?.error ? summary : null}
                selectedRegion={selectedRegion}
                onSelectRegion={handleSelectRegion}
                markers={markers}
                selected={selected}
                onSelectProject={handleSelectProject}
                onReset={handleResetView}
              />
              <AboutMap summary={!summary?.error ? summary : null} />
            </div>
          </section>

        <section className="results-pane">
          {summary?.error ? (
            <div className="load-error" role="alert">
              <p>Region summary failed to load.</p>
              <p className="load-error-hint">
                If you are running this locally, generate the data with{' '}
                <code>.venv/bin/python -m pipeline.export_json</code> from the
                repository root.
              </p>
              <button type="button" className="retry" onClick={retry}>
                Try again
              </button>
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
              <p>Flagged projects failed to load.</p>
              <button type="button" className="retry" onClick={retry}>
                Try again
              </button>
            </div>
          ) : null}
        </section>
        </div>
      </main>

      <footer className="app-footer">
        Data: DPWH annual infrastructure program (processed by the Pondo Watch
        pipeline). Flags are peer-group statistics only.
      </footer>
    </div>
  )
}