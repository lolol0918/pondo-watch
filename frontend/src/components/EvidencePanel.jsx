import { useEffect, useState } from 'react'

import {
  buildEvidenceSummary,
  explainLegitimacy,
  scopeNoteFor,
} from '../lib/anomalyExplanation.js'
import {
  formatInteger,
  formatMultiple,
  formatPeso,
  formatPesoCompact,
  formatZScore,
} from '../lib/format.js'
import { isValidCoordinate } from '../lib/markers.js'
import { peerVisualModel } from '../lib/peerVisual.js'

const SCREENING_HINT =
  'A statistical flag is a starting point for review, never a verdict.'

/**
 * The centerpiece: one project's evidence, built only from fields the export
 * actually carries. Missing fields render as "not available" — nothing is
 * invented in the header, sentence, or calculation block.
 */
export default function EvidencePanel({ anomaly, onClose }) {
  const [copied, setCopied] = useState(false)

  // Esc closes the panel (deselects / dismisses the mobile sheet).
  useEffect(() => {
    if (!anomaly) {
      return undefined
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anomaly, onClose])

  // Reset the copy feedback whenever a different project is shown.
  useEffect(() => {
    setCopied(false)
  }, [anomaly?.contractId])

  if (!anomaly) {
    return (
      <aside className="evidence evidence-empty-state" aria-label="Evidence panel">
        <div className="evidence-empty">
          <p className="evidence-empty-title">No project selected</p>
          <p>
            Click a marker on the map or a row in the flagged list to see its
            plain-English explanation and the calculation behind the flag.
          </p>
        </div>
      </aside>
    )
  }

  const reasons = explainLegitimacy(anomaly)
  const visual = peerVisualModel(anomaly)
  const hasCoords = isValidCoordinate(anomaly.latitude, anomaly.longitude)
  const groupLabel =
    anomaly.componentCategories && anomaly.componentCategories !== anomaly.category
      ? `${anomaly.componentCategories} (component category)`
      : anomaly.category

  const copyId = async () => {
    const id = anomaly.contractId
    try {
      await navigator.clipboard.writeText(id)
    } catch {
      // Clipboard API is unavailable (e.g. non-secure context): fall back to
      // a temporary textarea so the copy button still works.
      const ta = document.createElement('textarea')
      ta.value = id
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <aside
      className="evidence"
      role="dialog"
      aria-modal="false"
      aria-label={`Evidence for contract ${anomaly.contractId}`}
    >
      <div className="evidence-head">
        <button type="button" className="evidence-back" onClick={onClose}>
          ← Back to flagged list
        </button>
        <h2 className="evidence-kicker">Why this project was flagged</h2>
      </div>

      <h3 className="evidence-title">{anomaly.description || 'Untitled project'}</h3>

      <div className="evidence-id-row">
        <span className="evidence-id-label">Contract</span>
        <code className="evidence-id">{anomaly.contractId ?? 'not available'}</code>
        <button
          type="button"
          className="copy-button"
          onClick={copyId}
          aria-live="polite"
        >
          {copied ? 'Copied' : 'Copy ID'}
        </button>
      </div>

      <p className="evidence-meta">
        {[
          anomaly.region,
          anomaly.category,
          anomaly.infraYear,
        ].map((part) => part ?? 'not available').join(' · ')}
      </p>

      <section className="evidence-verdict" aria-label="Summary">
        <p className="evidence-sentence">{buildEvidenceSummary(anomaly)}</p>
        <span className="evidence-ratio" aria-label="ratio to peer median">
          {formatMultiple(anomaly.median_multiple)} peer median
        </span>
      </section>

      <section className="evidence-section" aria-label="Comparison">
        <h4>Compare with its peer group</h4>
        {visual ? (
          <>
            <PeerBandChart model={visual} budgetLabel={formatPesoCompact(anomaly.budget)} />
            <p className="evidence-visual-caption">
              The gray band shows the range where typical peer budgets fall
              (median ± 1.5× MAD, log scale). The dashed line is the flag
              threshold; the dot is this project&apos;s recorded budget.
            </p>
          </>
        ) : (
          <p className="evidence-not-available">
            Comparison visual not available — budget or peer median missing.
          </p>
        )}
      </section>

      <section className="evidence-section" aria-label="Calculation">
        <h4>How this was calculated</h4>
        <dl className="evidence-grid">
          <div className="evidence-row">
            <dt>Peer group</dt>
            <dd>
              {groupLabel && groupLabel !== 'not available'
                ? `${groupLabel} in ${anomaly.region} (${anomaly.infraYear})`
                : 'not available'}
            </dd>
          </div>
          <div className="evidence-row">
            <dt>Peer-group size</dt>
            <dd>{formatInteger(anomaly.group_size)}</dd>
          </div>
          <div className="evidence-row">
            <dt>Median budget</dt>
            <dd>{formatPeso(anomaly.median_budget)}</dd>
          </div>
          <div className="evidence-row">
            <dt>Spread (MAD, log10)</dt>
            <dd>{madValue(anomaly.mad_log)}</dd>
          </div>
          <div className="evidence-row">
            <dt>Modified z-score</dt>
            <dd>{formatZScore(anomaly.anomaly_score)}</dd>
          </div>
          <div className="evidence-row">
            <dt>Flag threshold (robust fence)</dt>
            <dd>{formatPeso(anomaly.fence_budget)}</dd>
          </div>
        </dl>
        <p className="evidence-calc-note">
          The pipeline flags a budget more than 3.0 robust-σ equivalents above
          its peer-group median, in a peer group of at least 30 comparable
          projects. The MAD is floored at 0.01 before scoring.
        </p>
      </section>

      <section className="evidence-section" aria-label="Legitimate reasons">
        <h4>Why this might be legitimate</h4>
        <p className="evidence-generic">{scopeNoteFor(anomaly)}</p>
        {reasons.length > 0 ? (
          <ul className="evidence-reasons">
            {reasons.map((reason) => (
              <li key={reason.title}>
                <strong>{reason.title}:</strong> {reason.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p className="evidence-reasons-none">
            No data-driven factors found in this record; the project is worth
            reviewing against its documents.
          </p>
        )}
      </section>

      <section className="evidence-section evidence-source" aria-label="Source">
        <h4>Source</h4>
        <p>Data: DPWH annual infrastructure program, processed by the Pondo Watch pipeline.</p>
        {!hasCoords ? (
          <p className="evidence-coords-note">
            <strong>No coordinates available</strong> — this project is not
            drawn on the map.
          </p>
        ) : null}
      </section>

      <p className="evidence-hint">{SCREENING_HINT}</p>
    </aside>
  )
}

/**
 * A small inline-SVG comparison: peer-group median band, flag threshold, and
 * this project's budget on a log10 axis. Uses only exported peer-group
 * statistics — it never fabricates individual peer budgets.
 */
function PeerBandChart({ model, budgetLabel }) {
  const W = 320
  const H = 96
  const top = 16
  const bandY = 30
  const bandH = 20
  const axisY = 74
  const px = (logValue) => (model.x(logValue) / 100) * W

  const bandLeft = px(model.bandLow)
  const bandRight = px(model.bandHigh)
  const medianX = px(model.logMedian)
  const fenceX = px(model.logFence)
  const dotX = px(model.logBudget)
  const labelX = clamp(dotX, 42, W - 42)

  const aria = [
    'Comparison on a log scale.',
    `Typical peer budgets range from ${formatPesoCompact(10 ** model.bandLow)} to ${formatPesoCompact(10 ** model.bandHigh)}.`,
    `The flag threshold is ${formatPesoCompact(10 ** model.logFence)}.`,
    `This project's recorded budget is ${budgetLabel}.`,
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={aria}
      className="peer-chart"
    >
      {/* axis tick lines and power-of-ten labels */}
      {model.ticks.map((e) => {
        const x = px(e)
        if (x < 0 || x > W) {
          return null
        }
        return (
          <g key={e}>
            <line x1={x} y1={axisY - 4} x2={x} y2={axisY} className="peer-chart-tick" />
            <text x={x} y={axisY + 13} textAnchor="middle" className="peer-chart-tick-label">
              {formatPesoCompact(10 ** e)}
            </text>
          </g>
        )
      })}

      {/* typical peer range */}
      <rect
        x={bandLeft}
        y={bandY}
        width={Math.max(bandRight - bandLeft, 2)}
        height={bandH}
        rx={4}
        className="peer-chart-band"
      />
      <line
        x1={medianX}
        y1={bandY - 3}
        x2={medianX}
        y2={bandY + bandH + 3}
        className="peer-chart-median"
      />

      {/* flag threshold */}
      <line
        x1={fenceX}
        y1={top - 4}
        x2={fenceX}
        y2={axisY}
        className="peer-chart-fence"
      />
      {fenceX > 40 && fenceX < W - 4 ? (
        <text x={fenceX} y={top - 8} textAnchor="middle" className="peer-chart-label">
          flag threshold
        </text>
      ) : null}

      {/* this project */}
      <circle cx={dotX} cy={bandY + bandH / 2} r={6.5} className="peer-chart-dot" />
      <text x={labelX} y={bandY - 10} textAnchor="middle" className="peer-chart-label">
        this project
      </text>
    </svg>
  )
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// MAD is a log10 spread; show the raw value so the number matches the CSV
// / parquet field exactly (prefixed with ± to signal symmetric spread).
function madValue(mad) {
  if (mad === null || mad === undefined || !Number.isFinite(mad)) {
    return 'not available'
  }
  return `±${mad.toFixed(3)}`
}