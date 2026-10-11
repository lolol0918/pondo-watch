import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List } from 'react-window'

import { formatInteger } from '../lib/format.js'
import {
  ALL_REGIONS,
  SORT_OPTIONS,
  categoryOptions,
  countActiveFilters,
  filterFlagged,
  sortFlagged,
  yearOptions,
} from '../lib/listFilters.js'
import ProjectRow from './ProjectRow.jsx'

const ROW_HEIGHT = 150
const VIEWPORT_MAX = 640

/**
 * The flagged-projects list. One virtualized viewport (react-window v2 List)
 * replaces the old "load 50 more" paging; sort/search/filters live in the
 * toolbar, and every active filter gets a removable chip with a live result
 * count. The selected project is always reachable: if the current filters
 * would hide it, it is kept as the first row with a note.
 */
export default function FlaggedProjectList({
  anomalies,
  selectedRegion,
  filters,
  onFiltersChange,
  onChangeRegion,
  selectedContractId,
  onSelectProject,
}) {
  const listRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const filtered = useMemo(
    () => filterFlagged(anomalies, { region: selectedRegion, ...filters }),
    [anomalies, selectedRegion, filters],
  )
  const sorted = useMemo(() => sortFlagged(filtered, filters.sort), [filtered, filters.sort])

  const selectedRecord = useMemo(
    () => (anomalies ?? []).find((a) => a.contractId === selectedContractId) ?? null,
    [anomalies, selectedContractId],
  )
  const pinned = useMemo(() => {
    if (
      selectedRecord &&
      !sorted.some((a) => a.contractId === selectedRecord.contractId)
    ) {
      return selectedRecord
    }
    return null
  }, [selectedRecord, sorted])

  // The pinned record (when present) becomes row 0 so list indices and
  // keyboard navigation are consistent with scrollToRow.
  const rows = useMemo(
    () => (pinned ? [pinned, ...sorted] : sorted),
    [pinned, sorted],
  )

  const categories = useMemo(
    () => categoryOptions(anomalies, selectedRegion),
    [anomalies, selectedRegion],
  )
  const years = useMemo(
    () => yearOptions(anomalies, selectedRegion),
    [anomalies, selectedRegion],
  )
  const activeFilterCount = countActiveFilters(filters)

  const listHeight = Math.min(VIEWPORT_MAX, rows.length * ROW_HEIGHT)

  // Whenever the selection changes (e.g. a marker was clicked), bring it into
  // view inside the virtualized list.
  useEffect(() => {
    if (!selectedContractId || rows.length === 0) {
      return
    }
    const index = rows.findIndex((a) => a.contractId === selectedContractId)
    if (index >= 0) {
      listRef.current?.scrollToRow({ index, align: 'smart', behavior: 'auto' })
    }
  }, [selectedContractId, rows])

  // Reset the keyboard cursor when the visible set changes.
  useEffect(() => {
    setActiveIndex(-1)
  }, [filters, selectedRegion, anomalies])

  const patch = (next) => onFiltersChange?.({ ...filters, ...next })

  const handleSelectRow = (row) => {
    const index = rows.findIndex((a) => a.contractId === row.contractId)
    setActiveIndex(index)
    onSelectProject(row)
  }

  const handleKeyDown = (event) => {
    if (rows.length === 0) {
      return
    }
    let next = activeIndex
    if (next < 0) {
      next = selectedRecord ? rows.findIndex((a) => a.contractId === selectedRecord.contractId) : 0
      if (next < 0) {
        next = 0
      }
    }
    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(next + 1, rows.length - 1)
        break
      case 'ArrowUp':
        next = Math.max(next - 1, 0)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = rows.length - 1
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (next >= 0 && rows[next]) {
          handleSelectRow(rows[next])
        }
        return
      default:
        return
    }
    event.preventDefault()
    setActiveIndex(next)
    listRef.current?.scrollToRow({ index: next, align: 'smart', behavior: 'auto' })
  }

  // Stable identity helpers for the virtualizer.
  const rowKey = useCallback((index) => rows[index]?.contractId ?? index, [rows])
  const rowProps = useMemo(
    () => ({
      rows,
      selectedContractId,
      activeIndex,
      pinnedId: pinned?.contractId ?? null,
      onSelectRow: handleSelectRow,
    }),
    [rows, selectedContractId, activeIndex, pinned],
  )

  if (!anomalies) {
    return (
      <div className="flagged-list" aria-busy="true">
        <ListHeading selectedRegion={selectedRegion} count={null} />
        <div className="flagged-list-skeleton" aria-label="Loading flagged projects">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="skeleton-row" key={i}>
              <span className="skeleton-line skeleton-line-title" />
              <span className="skeleton-line skeleton-line-meta" />
              <span className="skeleton-line skeleton-line-stats" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const hasListFilters = activeFilterCount > 0
  const hasRegion = Boolean(selectedRegion && selectedRegion !== ALL_REGIONS)

  return (
    <div className="flagged-list">
      <ListHeading selectedRegion={selectedRegion} count={rows.length} />

      <div className="flagged-toolbar">
        <input
          type="search"
          className="flagged-search"
          placeholder="Search title or contract ID"
          aria-label="Search flagged projects by title or contract ID"
          value={filters.query ?? ''}
          onChange={(e) => patch({ query: e.target.value })}
        />
        <div className="flagged-controls">
          <label className="flagged-control">
            <span>Sort</span>
            <select
              aria-label="Sort flagged projects"
              value={filters.sort}
              onChange={(e) => patch({ sort: e.target.value })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flagged-control">
            <span>Category</span>
            <select
              aria-label="Filter by infrastructure category"
              value={filters.category ?? ''}
              onChange={(e) => patch({ category: e.target.value })}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flagged-control">
            <span>Year</span>
            <select
              aria-label="Filter by implementation year"
              value={filters.year ?? ''}
              onChange={(e) => patch({ year: e.target.value })}
            >
              <option value="">All</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flagged-control">
            <span>Min ratio</span>
            <input
              type="number"
              min="1"
              step="0.1"
              inputMode="decimal"
              aria-label="Minimum ratio to peer median"
              placeholder="any"
              value={filters.minRatio ?? ''}
              onChange={(e) => patch({ minRatio: e.target.value })}
            />
          </label>
        </div>

        {pinned ? (
          <p className="flagged-pinned-note">
            Selected project is outside the current filters and is shown at the
            top of the list.
          </p>
        ) : null}

        {(hasListFilters || hasRegion) && rows.length > 0 ? (
          <div className="flagged-chips">
            {hasRegion ? (
              <FilterChip
                label={`Region: ${selectedRegion}`}
                onRemove={() => onChangeRegion?.(ALL_REGIONS)}
              />
            ) : null}
            {filters.category ? (
              <FilterChip
                label={`Category: ${filters.category}`}
                onRemove={() => patch({ category: '' })}
              />
            ) : null}
            {filters.year ? (
              <FilterChip
                label={`Year: ${filters.year}`}
                onRemove={() => patch({ year: '' })}
              />
            ) : null}
            {filters.minRatio !== '' && filters.minRatio !== null ? (
              <FilterChip
                label={`Min ratio: ${filters.minRatio}`}
                onRemove={() => patch({ minRatio: '' })}
              />
            ) : null}
            {filters.query?.trim() ? (
              <FilterChip
                label={`Search: "${filters.query.trim()}"`}
                onRemove={() => patch({ query: '' })}
              />
            ) : null}
          </div>
        ) : null}

        <div className="flagged-list-toolbar-meta">
          <span className="flagged-list-count">
            {rows.length === 0
              ? 'No matching projects'
              : `${formatInteger(rows.length)} ${
                  rows.length === 1 ? 'project' : 'projects'
                }`}
          </span>
          {hasListFilters || hasRegion ? (
            <button
              type="button"
              className="flagged-clear"
              onClick={() => {
                onChangeRegion?.(ALL_REGIONS)
                onFiltersChange?.({
                  ...filters,
                  query: '',
                  category: '',
                  year: '',
                  minRatio: '',
                })
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flagged-list-empty">
          <p className="flagged-list-empty-title">No flagged projects match these filters.</p>
          <p>Try widening the region or clearing a filter to bring results back.</p>
          <button
            type="button"
            className="flagged-clear flagged-clear-empty"
            onClick={() => {
              onChangeRegion?.(ALL_REGIONS)
              onFiltersChange?.({
                ...filters,
                query: '',
                category: '',
                year: '',
                minRatio: '',
              })
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flagged-list-body">
          <List
            role="listbox"
            aria-label="Flagged projects"
            tabIndex={0}
            aria-activedescendant={
              activeIndex >= 0 ? `flag-row-${activeIndex}` : undefined
            }
            onKeyDown={handleKeyDown}
            listRef={listRef}
            data-testid="flagged-virtual-list"
            className="flagged-virtual-list"
            style={{ height: listHeight, width: '100%' }}
            defaultHeight={listHeight}
            rowCount={rows.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={FlaggedRow}
            rowProps={rowProps}
            rowKey={rowKey}
            overscanCount={6}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Row renderer for the virtualized list. Reads everything from `rowProps` so
 * the component itself can be declared once at module scope.
 */
function FlaggedRow({ index, style, rows, selectedContractId, activeIndex, pinnedId, onSelectRow }) {
  const row = rows[index]
  if (!row) {
    return null
  }
  return (
    <div style={style} className="flagged-item-slot">
      <ProjectRow
        id={`flag-row-${index}`}
        anomaly={row}
        selected={row.contractId === selectedContractId}
        active={index === activeIndex}
        pinned={row.contractId === pinnedId}
        onSelect={onSelectRow}
      />
    </div>
  )
}

function ListHeading({ selectedRegion, count }) {
  const heading =
    !selectedRegion || selectedRegion === ALL_REGIONS
      ? 'Flagged projects — all regions'
      : `Flagged projects — ${selectedRegion}`
  return (
    <div className="flagged-list-heading">
      <h2>{heading}</h2>
      {count !== null ? (
        <span className="flagged-list-count">
          {formatInteger(count)} {count === 1 ? 'project' : 'projects'}
        </span>
      ) : null}
    </div>
  )
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="filter-chip">
      {label}
      <button
        type="button"
        className="filter-chip-remove"
        aria-label={`Remove filter ${label}`}
        onClick={onRemove}
      >
        ×
      </button>
    </span>
  )
}