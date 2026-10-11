import { buildExplanation } from '../lib/anomalyExplanation.js'
import {
  formatInteger,
  formatMultiple,
  formatPeso,
  formatScore,
} from '../lib/format.js'

const SCREENING_HINT =
  'A statistical flag is a starting point for review, never a verdict.'

export default function EvidencePanel({ anomaly }) {
  if (!anomaly) {
    return (
      <aside className="evidence">
        <div className="evidence-empty">
          Select a flagged project from the list or map to see its evidence.
        </div>
      </aside>
    )
  }

  const rows = [
    ['Contract ID', anomaly.contractId],
    ['Infrastructure category', anomaly.category],
    ['Region', anomaly.region],
    ['Implementation year', anomaly.infraYear],
    ['Budget (allotted)', formatPeso(anomaly.budget)],
    ['Peer-group median budget', formatPeso(anomaly.median_budget)],
    ['Budget vs. peer median', formatMultiple(anomaly.median_multiple)],
    ['Anomaly score', formatScore(anomaly.anomaly_score)],
    ['Peer-group size', formatInteger(anomaly.group_size)],
    ['Robust fence (flag threshold)', formatPeso(anomaly.fence_budget)],
    ['Peer-group spread (MAD, log10)', madValue(anomaly.mad_log)],
  ]

  return (
    <aside className="evidence">
      <h2>Evidence</h2>
      <p className="evidence-description">{anomaly.description}</p>

      <dl className="evidence-grid">
        {rows.map(([label, value]) => (
          <div className="evidence-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="evidence-explanation">
        <h3>Plain-language explanation</h3>
        <p>{buildExplanation(anomaly)}</p>
      </div>

      <p className="evidence-hint">{SCREENING_HINT}</p>
    </aside>
  )
}

// MAD is a log10 spread; show the raw value so the number matches the CSV
// / parquet field exactly.
function madValue(mad) {
  if (mad === null || mad === undefined || !Number.isFinite(mad)) {
    return '—'
  }
  return `±${mad.toFixed(3)}`
}