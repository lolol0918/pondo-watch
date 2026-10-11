import { useMemo } from 'react'

import { formatInteger } from '../lib/format.js'
import {
  ALL_REGIONS,
  SORT_OPTIONS,
  categoryOptions,
  yearOptions,
} from '../lib/listFilters.js'
import { selectableRegions } from '../lib/regions.js'

/**
 * The one filter toolbar above the content: search, Region, Category, Year,
 * Min ratio, Sort, the "Hide program-level lines" toggle, a live result line
 * and Clear. Every control writes into the app's single filter state, which is
 * the same state behind the list, the map markers and the result count — so
 * they can never disagree. There are no duplicate filter chips.
 */
export default function FilterToolbar({
  summary,
  anomalies,
  selectedRegion,
  onRegionChange,
  filters,
  onFiltersChange,
  resultCount,
  regionTotal,
  activeFilterCount,
  showProgramLevel,
  onShowProgramLevelChange,
  onClear,
}) {
  const categories = useMemo(
    () => categoryOptions(anomalies, selectedRegion),
    [anomalies, selectedRegion],
  )
  const years = useMemo(
    () => yearOptions(anomalies, selectedRegion),
    [anomalies, selectedRegion],
  )
  const regions =
    summary && !summary.error ? selectableRegions(summary) : []

  const patch = (next) => onFiltersChange({ ...filters, ...next })

  return (
    <div className="filter-toolbar" role="search" aria-label="Filter flagged projects">
      <div className="filter-row">
        <input
          type="search"
          className="filter-search"
          placeholder="Search title or contract ID"
          aria-label="Search by title or contract ID"
          value={filters.query ?? ''}
          onChange={(event) => patch({ query: event.target.value })}
        />

        <label className="filter-field">
          <span>Region</span>
          <select
            aria-label="Region"
            value={selectedRegion ?? ALL_REGIONS}
            onChange={(event) => onRegionChange(event.target.value)}
          >
            <option value={ALL_REGIONS}>All regions</option>
            {regions.map((row) => (
              <option key={row.region} value={row.region}>
                {row.region}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Category</span>
          <select
            aria-label="Category"
            value={filters.category ?? ''}
            onChange={(event) => patch({ category: event.target.value })}
          >
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Year</span>
          <select
            aria-label="Year"
            value={filters.year ?? ''}
            onChange={(event) => patch({ year: event.target.value })}
          >
            <option value="">All</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field filter-field-narrow">
          <span>Min ratio</span>
          <input
            type="number"
            min="1"
            step="0.1"
            inputMode="decimal"
            aria-label="Minimum ratio to peer median"
            placeholder="any"
            value={filters.minRatio ?? ''}
            onChange={(event) => patch({ minRatio: event.target.value })}
          />
        </label>

        <label className="filter-field">
          <span>Sort</span>
          <select
            aria-label="Sort flagged projects"
            value={filters.sort}
            onChange={(event) => patch({ sort: event.target.value })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={!showProgramLevel}
            onChange={(event) => onShowProgramLevelChange(!event.target.checked)}
          />
          <span>Hide program-level lines</span>
        </label>
      </div>

      <div className="filter-status">
        <span className="filter-result" role="status" aria-live="polite">
          {resultCount === 0
            ? 'No flagged projects match'
            : `${formatInteger(resultCount)} of ${formatInteger(regionTotal)} flagged match`}
        </span>
        {activeFilterCount > 0 ? (
          <span className="filter-active">
            <span className="filter-active-count">
              {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
            </span>
            <button type="button" className="filter-clear" onClick={onClear}>
              Clear filters
            </button>
          </span>
        ) : null}
      </div>
    </div>
  )
}
