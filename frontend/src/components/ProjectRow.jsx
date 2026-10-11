import { memo } from 'react'

import { PROGRAM_LEVEL_TAG, isProgramLevel } from '../lib/anomalyExplanation.js'
import { formatMultiple, formatPesoCompact } from '../lib/format.js'

const SCOPE_BADGE_TITLE =
  'The description names a program, package, cluster or "various" scope, or ' +
  'the project was compared against a peer group spanning several categories. ' +
  'Its budget may legitimately cover more than one project.'

/**
 * One row in the flagged-projects list: a two-line title clamp, one meta line
 * (contract ID, category, year) and, on the right, the ratio to the peer
 * median with the recorded budget beneath it. The tag strip is always present
 * so every row is the same height for the virtualizer.
 */
function ProjectRow({ anomaly, selected, active, onSelect, style, id }) {
  const programLevel = isProgramLevel(anomaly)
  const rowClass = [
    'flagged-item',
    selected ? 'flagged-item-selected' : '',
    active ? 'flagged-item-active' : '',
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
      style={style}
      id={id}
      onClick={() => onSelect(anomaly)}
    >
      <span className="flagged-item-main">
        <span className="flagged-item-title">
          {anomaly.description || 'Untitled project'}
        </span>
        <span className="flagged-item-meta">
          {anomaly.contractId ?? 'not available'}
          {' · '}
          {anomaly.category ?? 'not available'}
          {' · '}
          {anomaly.infraYear ?? 'not available'}
        </span>
        <span className="flagged-item-tags">
          {programLevel ? (
            <span className="scope-badge" title={SCOPE_BADGE_TITLE}>
              {PROGRAM_LEVEL_TAG}
            </span>
          ) : null}
        </span>
      </span>

      <span className="flagged-item-ratio">
        <span className="ratio-value">{formatMultiple(anomaly.median_multiple)}</span>
        <span className="ratio-budget">{formatPesoCompact(anomaly.budget)}</span>
      </span>
    </button>
  )
}

export default memo(ProjectRow)
