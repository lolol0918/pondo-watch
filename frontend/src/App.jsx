import { useEffect, useMemo, useState } from 'react'

import { loadAnomalies, loadRegionSummary } from './api/dataSource.js'
import AboutMap from './components/AboutMap.jsx'
import Disclaimer from './components/Disclaimer.jsx'
import EvidencePanel from './components/EvidencePanel.jsx'
import FilterToolbar from './components/FilterToolbar.jsx'
import FlaggedProjectList from './components/FlaggedProjectList.jsx'
import KpiLine from './components/KpiLine.jsx'
import RegionMap from './components/RegionMap.jsx'
import { isProgramLevel } from './lib/anomalyExplanation.js'
import { countCoordinateCoverage, withCoordinates } from './lib/markers.js'
import {
  ALL_REGIONS,
  countActiveFilters,
  filterFlagged,
  relaxFiltersFor,
  sortFlagged,
} from './lib/listFilters.js'
import { readUrlState, useUrlPopState, useUrlSync } from './lib/urlState.js'

export default function App() {
  const initialUrl = useMemo(() => readUrlState(window.location.search), [])
  const [summary, setSummary] = useState(null)
  const [anomalies, setAnomalies] = useState(null)
  const [anomaliesError, setAnomaliesError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState(initialUrl.region) // null = all
  const [selected, setSelected] = useState(null) // anomaly record
  const [selectionSource, setSelectionSource] = useState('none') // 'map' | 'list' | 'none'
  const [pendingProjectId, setPendingProjectId] = useState(initialUrl.project)
  const [showProgramLevel, setShowProgramLevel] = useState(initialUrl.showProgramLevel)
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

  // Restore a project from the URL once the list has loaded. The region (if
  // any) is already applied from the URL and is never overridden here — a
  // selected project that sits outside the filters shows the inline notice
  // instead.
  useEffect(() => {
    if (!anomalies || !pendingProjectId) {
      return
    }
    const record = anomalies.find((a) => a.contractId === pendingProjectId)
    if (record) {
      setSelected(record)
      setSelectionSource('none')
    }
    setPendingProjectId(null)
  }, [anomalies, pendingProjectId])

  // --- The ONE filtered + sorted selection behind list, map and counts ---
  const filtered = useMemo(
    () =>
      filterFlagged(anomalies, {
        region: selectedRegion,
        ...filters,
        hideProgramLevel: !showProgramLevel,
      }),
    [anomalies, selectedRegion, filters, showProgramLevel],
  )
  const rows = useMemo(() => sortFlagged(filtered, filters.sort), [filtered, filters.sort])

  // Flagged projects in the current REGION only — the denominator in the
  // "N of M flagged match" result line.
  const regionTotal = useMemo(
    () => filterFlagged(anomalies, { region: selectedRegion }).length,
    [anomalies, selectedRegion],
  )

  // Markers are the same filtered set, minus records with no coordinates —
  // so marker count and list count are always reconciled by the map chip.
  const markers = useMemo(() => withCoordinates(rows, null), [rows])
  const coverage = useMemo(() => countCoordinateCoverage(rows), [rows])

  const activeFilterCount = countActiveFilters({
    ...filters,
    region: selectedRegion,
    showProgramLevel,
  })

  const selectedOutside = useMemo(
    () =>
      Boolean(selected) &&
      !rows.some((a) => a.contractId === selected.contractId),
    [selected, rows],
  )

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
    showProgramLevel,
  })

  useUrlPopState((url) => {
    setSelectedRegion(url.region)
    setShowProgramLevel(url.showProgramLevel)
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
  }

  // Selecting a project never rewrites the filters or reorders the list; the
  // list shows an inline notice with an explicit "Add to filters" instead.
  const handleSelectProject = (anomaly, source = 'list') => {
    setSelected(anomaly)
    setSelectionSource(source)
  }

  const handleResetView = () => {
    setSelected(null)
    setSelectedRegion(null)
  }

  const handleClearFilters = () => {
    setSelectedRegion(null)
    setShowProgramLevel(false)
    setFilters({
      sort: filters.sort,
      query: '',
      category: '',
      year: '',
      minRatio: '',
    })
  }

  const handleAddToFilters = () => {
    if (!selected) {
      return
    }
    const { region: regionChange, filters: filterChange } = relaxFiltersFor(
      selected,
      { region: selectedRegion, ...filters },
    )
    if (regionChange) {
      setSelectedRegion(regionChange === ALL_REGIONS ? null : regionChange)
    }
    if (Object.keys(filterChange).length > 0) {
      setFilters((current) => ({ ...current, ...filterChange }))
    }
    if (isProgramLevel(selected) && !showProgramLevel) {
      setShowProgramLevel(true)
    }
  }

  const validSummary = summary && !summary.error ? summary : null

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="app-header">
        <div className="app-title-block">
          <h1>Pondo Watch</h1>
          <p className="app-subtitle">
            Each flag is a statistical outlier worth reviewing, not a finding.
          </p>
        </div>
        <Disclaimer />
      </header>

      <main className="app-main" id="main-content" tabIndex={-1}>
        <KpiLine summary={validSummary} />

        <FilterToolbar
          summary={validSummary}
          anomalies={anomalies}
          selectedRegion={selectedRegion}
          onRegionChange={handleSelectRegion}
          filters={filters}
          onFiltersChange={setFilters}
          resultCount={rows.length}
          regionTotal={regionTotal}
          activeFilterCount={activeFilterCount}
          showProgramLevel={showProgramLevel}
          onShowProgramLevelChange={setShowProgramLevel}
          onClear={handleClearFilters}
        />

        {summary?.error ? (
          <div className="load-error" role="alert">
            <p>Region summary failed to load.</p>
            <p className="load-error-hint">
              Run <code>npm run dev</code> from frontend/ so the copy script
              runs, then try again.
            </p>
            <button type="button" className="retry" onClick={retry}>
              Try again
            </button>
          </div>
        ) : null}

        {anomaliesError ? (
          <div className="load-error" role="alert">
            <p>Flagged projects failed to load.</p>
            <button type="button" className="retry" onClick={retry}>
              Try again
            </button>
          </div>
        ) : null}

        <div className="workspace">
          <section className="pane pane-list" aria-label="Flagged projects">
            <FlaggedProjectList
              anomalies={anomalies}
              rows={rows}
              selectedRegion={selectedRegion}
              selectedContractId={selected?.contractId ?? null}
              selectedOutside={selectedOutside}
              onAddToFilters={() => selected && handleAddToFilters(selected)}
              onSelectProject={handleSelectProject}
            />
          </section>

          <section className="pane pane-map" aria-label="Map">
            <RegionMap
              summary={validSummary}
              selectedRegion={selectedRegion}
              onSelectRegion={handleSelectRegion}
              markers={markers}
              mappedCount={coverage.valid}
              withoutCount={coverage.without}
              selected={selected}
              selectionSource={selectionSource}
              onSelectProject={handleSelectProject}
              onReset={handleResetView}
            />
            <AboutMap summary={validSummary} />
          </section>

          <section className="pane pane-evidence" aria-label="Evidence">
            <EvidencePanel anomaly={selected} onClose={() => setSelected(null)} />
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
