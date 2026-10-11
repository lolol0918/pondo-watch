import { useEffect, useMemo, useState } from 'react'

import { formatInteger, formatMultiple, formatPesoCompact, formatZScore } from '../lib/format.js'
import { ALL_REGIONS } from './RegionSelector.jsx'

const PAGE_SIZE = 50

export default function FlaggedProjectList({
  anomalies,
  selectedRegion,
  selectedContractId,
  onSelectProject,
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    if (!anomalies) {
      return null
    }
    if (!selectedRegion || selectedRegion === ALL_REGIONS) {
      return anomalies
    }
    return anomalies.filter((a) => a.region === selectedRegion)
  }, [anomalies, selectedRegion])

  // Reset pagination whenever the filter changes.
  const scopeKey = selectedRegion ?? ALL_REGIONS
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [scopeKey])

  if (!filtered) {
    return (
      <div className="flagged-list">
        <div className="flagged-list-heading">
          <h2>Flagged projects</h2>
        </div>
        <div className="flagged-list-empty">Loading flagged projects…</div>
      </div>
    )
  }

  const visible = filtered.slice(0, visibleCount)
  const heading =
    !selectedRegion || selectedRegion === ALL_REGIONS
      ? 'Flagged projects — all regions'
      : `Flagged projects — ${selectedRegion}`

  return (
    <div className="flagged-list">
      <div className="flagged-list-heading">
        <h2>{heading}</h2>
        <span className="flagged-list-count">
          {formatInteger(filtered.length)}{' '}
          {filtered.length === 1 ? 'project' : 'projects'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flagged-list-empty">
          No flagged projects for this region.
        </div>
      ) : (
        <ul className="flagged-items">
          {visible.map((a) => (
            <li key={a.contractId}>
              <button
                type="button"
                className={
                  a.contractId === selectedContractId
                    ? 'flagged-item flagged-item-selected'
                    : 'flagged-item'
                }
                onClick={() => onSelectProject(a)}
              >
                <span className="flagged-item-title">{a.description}</span>
                <span className="flagged-item-meta">
                  {a.contractId} · {a.category} · {a.region} · {a.infraYear}
                </span>
                <span className="flagged-item-stats">
                  <span className="flagged-item-stat">
                    <span className="stat-label">budget</span>
                    <span className="flagged-item-budget">
                      {formatPesoCompact(a.budget)}
                    </span>
                  </span>
                  <span className="flagged-item-stat">
                    <span className="stat-label">vs. peer median</span>
                    <span className="flagged-item-multiple">
                      {formatMultiple(a.median_multiple)}
                    </span>
                  </span>
                  <span
                    className="flagged-item-stat"
                    title="Modified z-score: how far above the peer-group median this budget sits, in robust σ-equivalents."
                  >
                    <span className="stat-label">modified z</span>
                    <span className="flagged-item-score">
                      {formatZScore(a.anomaly_score)}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > visibleCount ? (
        <button
          type="button"
          className="flagged-list-more"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more of{' '}
          {formatInteger(filtered.length)}
        </button>
      ) : null}
    </div>
  )
}