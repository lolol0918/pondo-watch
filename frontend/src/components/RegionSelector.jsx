import { formatInteger, formatPercent } from '../lib/format.js'
import { selectableRegions } from '../lib/regions.js'

export const ALL_REGIONS = '__all__'

export default function RegionSelector({ summary, selectedRegion, onChange }) {
  if (!summary) {
    return <div className="region-selector region-selector-loading">Loading regions…</div>
  }

  const regions = selectableRegions(summary)
  const options = [
    { label: 'All regions', value: ALL_REGIONS },
    ...regions.map((row) => ({
      label: row.region,
      value: row.region,
      hint: `${formatInteger(row.flagged)} flagged`,
    })),
  ]

  return (
    <div className="region-selector">
      <label htmlFor="region-select">Region</label>
      <select
        id="region-select"
        value={selectedRegion ?? ALL_REGIONS}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({o.hint})
          </option>
        ))}
      </select>
      {selectedRegion !== null && selectedRegion !== ALL_REGIONS ? (
        <span className="region-selector-stats">
          {formatPercent(
            summary.regions.find((r) => r.region === selectedRegion)
              ?.flagged_percentage ?? 0,
          )}{' '}
          flagged in this region
        </span>
      ) : (
        <span className="region-selector-stats">
          {formatInteger(summary.totals.flagged)} flagged nationwide
        </span>
      )}
    </div>
  )
}