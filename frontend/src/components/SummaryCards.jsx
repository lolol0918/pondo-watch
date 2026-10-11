import { formatInteger, formatPercent } from '../lib/format.js'

function Card({ label, value, caption }) {
  return (
    <div className="summary-card">
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-label">{label}</div>
      {caption ? <div className="summary-card-caption">{caption}</div> : null}
    </div>
  )
}

export default function SummaryCards({ summary }) {
  if (!summary) {
    return (
      <div className="summary-cards" aria-label="Loading summary">
        <Card label="Total projects" value="…" />
        <Card label="Flagged projects" value="…" />
        <Card label="Flagged share" value="…" />
      </div>
    )
  }

  const totals = summary.totals
  return (
    <div className="summary-cards">
      <Card
        label="Total projects"
        value={formatInteger(totals.projects)}
        caption={`${formatInteger(totals.eligible)} eligible for cost analysis`}
      />
      <Card
        label="Flagged projects"
        value={formatInteger(totals.flagged)}
        caption="budget unusually high vs. peer group"
      />
      <Card
        label="Flagged share"
        value={formatPercent(totals.flagged_percentage)}
        caption="of all projects"
      />
    </div>
  )
}