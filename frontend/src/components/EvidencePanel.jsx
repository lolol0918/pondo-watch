import { useEffect, useRef, useState } from 'react'

import {
  buildHeadline,
  explainLegitimacy,
  peerGroupLine,
  scopeNoteFor,
} from '../lib/anomalyExplanation.js'
import {
  formatInteger,
  formatPeso,
  formatPesoCompact,
  formatZScore,
} from '../lib/format.js'
import { isValidCoordinate } from '../lib/markers.js'
import { peerVisualModel } from '../lib/peerVisual.js'
import { useMediaQuery } from '../lib/useMediaQuery.js'

const SCREENING_HINT =
  'A statistical flag is a starting point for review, never a verdict.'

// Only what the export actually carries — the data has no project URL, so the
// portal action is shown as unavailable rather than inventing a URL pattern.
const PORTAL_NOTE =
  'Not available — the dataset has no project URL to link to.'

/**
 * The evidence panel: label, title, ID chip, meta, a headline box, the peer
 * comparison chart, then collapsible sections. Built only from exported
 * fields; missing values render as "not available".
 */
export default function EvidencePanel({ anomaly, onClose }) {
  const [copied, setCopied] = useState('')
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const isSheet = useMediaQuery('(max-width: 1099px)')

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

  // Mobile bottom sheet: trap focus inside the panel and return it on close.
  useEffect(() => {
    if (!anomaly || !isSheet) {
      return undefined
    }
    restoreRef.current = document.activeElement
    const node = panelRef.current
    const focusables = () =>
      Array.from(
        node?.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
    focusables()[0]?.focus()

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') {
        return
      }
      const items = focusables()
      if (items.length === 0) {
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    node?.addEventListener('keydown', onKeyDown)
    return () => {
      node?.removeEventListener('keydown', onKeyDown)
      if (restoreRef.current instanceof HTMLElement) {
        restoreRef.current.focus()
      }
    }
  }, [anomaly, isSheet])

  // Reset copy feedback whenever a different project is shown.
  useEffect(() => {
    setCopied('')
  }, [anomaly?.contractId])

  if (!anomaly) {
    return (
      <aside className="evidence evidence-empty-state" aria-label="Evidence panel">
        <div className="evidence-empty">
          <p className="evidence-empty-title">No project selected</p>
          <p>
            Select a marker on the map or a row in the list to see its
            plain-English explanation and the calculation behind the flag.
          </p>
        </div>
      </aside>
    )
  }

  const reasons = explainLegitimacy(anomaly)
  const visual = peerVisualModel(anomaly)
  const hasCoords = isValidCoordinate(anomaly.latitude, anomaly.longitude)

  const copyText = async (kind, text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API unavailable (non-secure context): fall back to a
      // temporary textarea so the copy actions still work.
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(kind)
    window.setTimeout(() => setCopied(''), 1600)
  }

  const summaryText = [
    `${anomaly.description || 'Untitled project'} (${anomaly.contractId ?? 'no ID'})`,
    `${anomaly.region ?? 'not available'} · ${anomaly.infraYear ?? 'not available'}`,
    buildHeadline(anomaly),
    peerGroupLine(anomaly),
    `Peer median: ${formatPeso(anomaly.median_budget)}`,
    `Modified z-score: ${formatZScore(anomaly.anomaly_score)}`,
    `Flag threshold (robust fence): ${formatPeso(anomaly.fence_budget)}`,
    SCREENING_HINT,
  ].join('\n')

  return (
    <aside
      className="evidence"
      ref={panelRef}
      role={isSheet ? 'dialog' : 'region'}
      aria-modal={isSheet ? 'true' : undefined}
      aria-label={`Evidence for contract ${anomaly.contractId}`}
      tabIndex={-1}
    >
      <div className="evidence-head">
        <span className="evidence-kicker">Selected project</span>
        <button
          type="button"
          className="evidence-close"
          onClick={onClose}
          aria-label="Close evidence panel"
        >
          Close
        </button>
      </div>

      <h3 className="evidence-title">
        {anomaly.description || 'Untitled project'}
      </h3>

      <div className="evidence-id-row">
        <span className="evidence-id-label">ID</span>
        <code className="evidence-id">{anomaly.contractId ?? 'not available'}</code>
        <button
          type="button"
          className="copy-button"
          onClick={() => copyText('id', anomaly.contractId ?? '')}
          aria-live="polite"
        >
          {copied === 'id' ? 'Copied' : 'Copy ID'}
        </button>
      </div>

      <p className="evidence-meta">
        {[anomaly.region, anomaly.category, anomaly.infraYear]
          .map((part) => part ?? 'not available')
          .join(' · ')}
      </p>

      <section className="evidence-verdict" aria-label="Summary">
        <p className="evidence-sentence">{buildHeadline(anomaly)}</p>
        <p className="evidence-peer-line">{peerGroupLine(anomaly)}</p>
      </section>

      <section className="evidence-section" aria-label="Comparison">
        <h4>How this compares</h4>
        {visual ? (
          <>
            <PeerBandChart
              model={visual}
              budgetLabel={formatPesoCompact(anomaly.budget)}
            />
            <p className="evidence-visual-caption">
              The grey band is where typical peer budgets fall (median ± 1.5×
              MAD, log scale). The dashed line is the flag threshold; the dot is
              this project&apos;s recorded budget.
            </p>
          </>
        ) : (
          <p className="evidence-not-available">
            Comparison not available — budget or peer median is missing.
          </p>
        )}
      </section>

      <details className="evidence-disclosure" open>
        <summary>Why this might be legitimate</summary>
        <div className="evidence-disclosure-body">
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
              No data-driven factors found in this record; it is worth reviewing
              against its documents.
            </p>
          )}
        </div>
      </details>

      <details className="evidence-disclosure">
        <summary>Show the math</summary>
        <div className="evidence-disclosure-body">
          <dl className="evidence-grid">
            <div className="evidence-row">
              <dt>Peer median budget</dt>
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
            <div className="evidence-row">
              <dt>Peer group size</dt>
              <dd>
                {Number.isFinite(anomaly.group_size)
                  ? formatInteger(anomaly.group_size)
                  : 'not available'}
              </dd>
            </div>
          </dl>
          <p className="evidence-calc-note">
            The pipeline flags a budget more than 3.0 robust-σ equivalents above
            its peer-group median, in a peer group of at least 30 comparable
            projects. The MAD is floored at 0.01 before scoring.
          </p>
        </div>
      </details>

      <section className="evidence-section evidence-source" aria-label="Source">
        <h4>Source</h4>
        <p>
          Data: DPWH annual infrastructure program, processed by the Pondo Watch
          pipeline.
        </p>
        {!hasCoords ? (
          <p className="evidence-coords-note">
            <strong>No coordinates available</strong> — this project is not drawn
            on the map.
          </p>
        ) : null}
      </section>

      <div className="evidence-actions">
        <button
          type="button"
          className="evidence-action"
          onClick={() => copyText('summary', summaryText)}
        >
          {copied === 'summary' ? 'Copied summary' : 'Copy summary'}
        </button>
        <button
          type="button"
          className="evidence-action"
          disabled
          title={PORTAL_NOTE}
        >
          Find on DPWH portal
        </button>
      </div>
      <p className="evidence-portal-note">{PORTAL_NOTE}</p>

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
  const H = 104
  const top = 20
  const bandY = 34
  const bandH = 22
  const axisY = 80
  const px = (logValue) => (model.x(logValue) / 100) * W

  const bandLeft = px(model.bandLow)
  const bandRight = px(model.bandHigh)
  const medianX = px(model.logMedian)
  const fenceX = px(model.logFence)
  const dotX = px(model.logBudget)
  const labelX = clamp(dotX, 46, W - 46)

  const aria = [
    'Comparison on a log scale.',
    `Typical peer budgets range from ${formatPesoCompact(10 ** model.bandLow)} to ${formatPesoCompact(10 ** model.bandHigh)}.`,
    `The flag threshold is ${formatPesoCompact(10 ** model.logFence)}.`,
    `This project's recorded budget is ${budgetLabel}.`,
  ].join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="peer-chart">
      {model.ticks.map((e) => {
        const x = px(e)
        if (x < 0 || x > W) {
          return null
        }
        return (
          <g key={e}>
            <line x1={x} y1={axisY - 4} x2={x} y2={axisY} className="peer-chart-tick" />
            <text
              x={x}
              y={axisY + 15}
              textAnchor="middle"
              className="peer-chart-tick-label"
            >
              {formatPesoCompact(10 ** e)}
            </text>
          </g>
        )
      })}

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

      <line
        x1={fenceX}
        y1={top - 6}
        x2={fenceX}
        y2={axisY}
        className="peer-chart-fence"
      />
      {fenceX > 44 && fenceX < W - 4 ? (
        <text x={fenceX} y={top - 10} textAnchor="middle" className="peer-chart-label">
          flag threshold
        </text>
      ) : null}

      <circle cx={dotX} cy={bandY + bandH / 2} r={6.5} className="peer-chart-dot" />
      <text x={labelX} y={top - 10} textAnchor="middle" className="peer-chart-label">
        this project
      </text>
    </svg>
  )
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// MAD is a log10 spread; show the raw value so the number matches the exported
// field exactly (prefixed with ± to signal symmetric spread).
function madValue(mad) {
  if (mad === null || mad === undefined || !Number.isFinite(mad)) {
    return 'not available'
  }
  return `±${mad.toFixed(3)}`
}
