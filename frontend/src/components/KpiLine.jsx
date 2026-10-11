import { formatInteger, formatPercent } from '../lib/format.js'

// One compact KPI line instead of three large cards: total projects, the
// number that could be analysed, and how many were flagged — with the flagged
// share taken over the ANALYSED population (the comparable projects), so the
// denominator matches the caption.
export default function KpiLine({ summary }) {
  if (!summary) {
    return (
      <div className="kpi-line" aria-label="Loading project totals">
        <Kpi value="…" label="projects" />
        <Sep />
        <Kpi value="…" label="analysed" />
        <Sep />
        <Kpi value="…" label="flagged" />
      </div>
    )
  }

  const { projects, eligible, flagged } = summary.totals
  const share = eligible > 0 ? (100 * flagged) / eligible : 0

  return (
    <div className="kpi-line" aria-label="Project totals">
      <Kpi value={formatInteger(projects)} label="projects" />
      <Sep />
      <Kpi value={formatInteger(eligible)} label="analysed" />
      <Sep />
      <Kpi
        value={formatInteger(flagged)}
        label={`flagged (${formatPercent(share)} of analysed)`}
        flagged
      />
    </div>
  )
}

function Kpi({ value, label, flagged }) {
  return (
    <span className={flagged ? 'kpi kpi-flagged' : 'kpi'}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
    </span>
  )
}

function Sep() {
  return (
    <span className="kpi-sep" aria-hidden="true">
      ·
    </span>
  )
}
