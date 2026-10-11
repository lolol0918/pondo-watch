import { memo } from 'react'

import { hasScopeKeywords } from '../lib/anomalyExplanation.js'
import {
  formatMultiple,
  formatPesoCompact,
  formatZScore,
} from '../lib/format.js'

const SCOPE_BADGE_TITLE =
  'Description suggests a program, package, cluster or "various" scope of ' +
  'work, which can legitimately carry a much larger budget than a single ' +
  'comparable project.'

/**
 * One row in the flagged-projects list. Height is kept uniform (the
 * virtualizer relies on it): the badge strip reserves its space even when no
 * badge is shown, and the title is clamped to two lines.
 */
function ProjectRow({ anomaly, selected, active, pinned, onSelect, style, id }) {
  const scope = hasScopeKeywords(anomaly.description)
  const rowClass = [
    'flagged-item',
    selected ? 'flagged-item-selected' : '',
    active ? 'flagged-item-active' : '',
    pinned ? 'flagged-item-pinned' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={`${anomaly.description} — ${anomaly.contractId}`}
      className={rowClass}
      onClick={() => onSelect(anomaly)}
      style={style}
      id={id}
    >
      <span className="flagged-item-badges" aria-hidden={!scope}>
        {scope ? (
          <span className="scope-badge" title={SCOPE_BADGE_TITLE}>
            program/package scope
          </span>
        ) : null}
      </span>
      <span className="flagged-item-title">{anomaly.description}</span>
      <span className="flagged-item-meta">
        {anomaly.contractId} · {anomaly.category ?? 'not available'} ·{' '}
        {anomaly.region} · {anomaly.infraYear}
      </span>
      <span className="flagged-item-stats">
        <span className="flagged-item-stat">
          <span className="stat-label">budget</span>
          <span className="flagged-item-budget">{formatPesoCompact(anomaly.budget)}</span>
        </span>
        <span className="flagged-item-stat">
          <span className="stat-label">vs. peer median</span>
          <span className="flagged-item-multiple">
            {formatMultiple(anomaly.median_multiple)}
          </span>
        </span>
        <span
          className="flagged-item-stat"
          title="Modified z-score: how far above the peer-group median this budget sits, in robust σ-equivalents."
        >
          <span className="stat-label">modified z</span>
          <span className="flagged-item-score">{formatZScore(anomaly.anomaly_score)}</span>
        </span>
      </span>
    </button>
  )
}

export default memo(ProjectRow)