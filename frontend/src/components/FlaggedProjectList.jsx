import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List } from 'react-window'

import { ALL_REGIONS } from '../lib/listFilters.js'
import ProjectRow from './ProjectRow.jsx'

const ROW_HEIGHT = 124
const DEFAULT_HEIGHT = 520

/**
 * The flagged-projects list. A single virtualized viewport (react-window v2
 * List) fills the column and scrolls on its own. The rows it renders come from
 * the app's single filtered selector, so the list, the map markers and the
 * result line are always the same set. If the selected project is outside the
 * current filters, an inline notice offers "Add to filters" — the list is never
 * silently reordered to include it.
 */
export default function FlaggedProjectList({
  anomalies,
  rows,
  selectedRegion,
  selectedContractId,
  selectedOutside,
  onAddToFilters,
  onSelectProject,
}) {
  const listRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedIndex = useMemo(
    () => rows.findIndex((a) => a.contractId === selectedContractId),
    [rows, selectedContractId],
  )

  // Whenever the selection changes (e.g. a marker was clicked), bring it into
  // view inside the virtualized list.
  useEffect(() => {
    if (selectedIndex >= 0) {
      listRef.current?.scrollToRow({
        index: selectedIndex,
        align: 'smart',
        behavior: 'auto',
      })
    }
  }, [selectedIndex])

  // Reset the keyboard cursor when the visible set changes.
  useEffect(() => {
    setActiveIndex(-1)
  }, [rows])

  const handleSelectRow = (row) => {
    const index = rows.findIndex((a) => a.contractId === row.contractId)
    setActiveIndex(index)
    onSelectProject(row, 'list')
  }

  const handleKeyDown = (event) => {
    if (rows.length === 0) {
      return
    }
    let next = activeIndex
    if (next < 0) {
      next = selectedIndex >= 0 ? selectedIndex : 0
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

  const rowKey = (index) => rows[index]?.contractId ?? index
  const rowProps = {
    rows,
    selectedContractId,
    activeIndex,
    onSelectRow: handleSelectRow,
  }

  const heading =
    !selectedRegion || selectedRegion === ALL_REGIONS
      ? 'Flagged projects — all regions'
      : `Flagged projects — ${selectedRegion}`

  if (!anomalies) {
    return (
      <div className="flagged-list" aria-busy="true">
        <ListHeading heading={heading} count={null} />
        <div
          className="flagged-list-skeleton"
          role="status"
          aria-label="Loading flagged projects"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="skeleton-row" key={i}>
              <span className="skeleton-line skeleton-line-title" />
              <span className="skeleton-line skeleton-line-meta" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flagged-list">
      <ListHeading heading={heading} count={rows.length} />

      {selectedOutside ? (
        <p className="flagged-outside">
          The selected project is outside the current filters.
          <button type="button" className="flagged-outside-add" onClick={onAddToFilters}>
            Add to filters
          </button>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="flagged-list-empty">
          <p className="flagged-list-empty-title">No flagged projects match these filters.</p>
          <p>Clear a filter or widen the region to bring results back.</p>
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
            style={{ height: '100%', width: '100%' }}
            defaultHeight={DEFAULT_HEIGHT}
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
 * Row renderer for the virtualized list. Everything comes from `rowProps` so
 * the component itself can be declared once at module scope.
 */
function FlaggedRow({ index, style, rows, selectedContractId, activeIndex, onSelectRow }) {
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
        onSelect={onSelectRow}
      />
    </div>
  )
}

function ListHeading({ heading, count }) {
  return (
    <div className="flagged-list-heading">
      <h2>{heading}</h2>
      {count !== null ? (
        <span className="flagged-list-count" role="status" aria-live="polite">
          {count === 0 ? 'No matches' : `${count} ${count === 1 ? 'project' : 'projects'}`}
        </span>
      ) : null}
    </div>
  )
}
