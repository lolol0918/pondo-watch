// Pure list filtering and sorting for the flagged-projects view. Kept outside
// the component so the behaviour is unit-testable and the default sort is an
// explicit, single constant.

export const ALL_REGIONS = '__all__'

// The default sort is stated explicitly in the UI ("Ratio to median —
// default") and here.
export const DEFAULT_SORT = 'ratio'

export const SORT_OPTIONS = [
  { key: 'ratio', label: 'Ratio to median — default' },
  { key: 'z', label: 'Modified z-score' },
  { key: 'budget', label: 'Budget' },
  { key: 'year', label: 'Year' },
]

/**
 * Apply region scope, search and filters to the flagged records.
 * `minRatio` is a string from a number input ('' = off).
 */
export function filterFlagged(
  anomalies,
  { region, query = '', category = '', year = '', minRatio = '' },
) {
  const q = query.trim().toLowerCase()
  const min = minRatio === '' || minRatio === null ? null : Number(minRatio)

  return (anomalies ?? []).filter((a) => {
    if (region && region !== ALL_REGIONS && a.region !== region) {
      return false
    }
    if (category && a.category !== category) {
      return false
    }
    if (year && String(a.infraYear) !== String(year)) {
      return false
    }
    if (min !== null && !(Number.isFinite(a.median_multiple) && a.median_multiple >= min)) {
      return false
    }
    if (q) {
      const haystack = `${a.description ?? ''} ${a.contractId ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) {
        return false
      }
    }
    return true
  })
}

const COMPARATORS = {
  ratio: (a, b) => (b.median_multiple ?? -Infinity) - (a.median_multiple ?? -Infinity),
  z: (a, b) => (b.anomaly_score ?? -Infinity) - (a.anomaly_score ?? -Infinity),
  budget: (a, b) => (b.budget ?? -Infinity) - (a.budget ?? -Infinity),
  year: (a, b) =>
    String(b.infraYear).localeCompare(String(a.infraYear), undefined, { numeric: true }) ||
    (b.median_multiple ?? -Infinity) - (a.median_multiple ?? -Infinity),
}

/** Sort a filtered list by a SORT_OPTIONS key (defaulting to ratio). */
export function sortFlagged(list, sortKey) {
  const comparator = COMPARATORS[sortKey] ?? COMPARATORS[DEFAULT_SORT]
  return [...list].sort(comparator)
}

/** Distinct categories across the region-scoped records, sorted alphabetically. */
export function categoryOptions(anomalies, region) {
  const seen = new Set()
  for (const a of anomalies ?? []) {
    if (region && region !== ALL_REGIONS && a.region !== region) {
      continue
    }
    if (a.category) {
      seen.add(a.category)
    }
  }
  return [...seen].sort((x, y) => x.localeCompare(y))
}

/** Distinct years across the region-scoped records, newest first. */
export function yearOptions(anomalies, region) {
  const seen = new Set()
  for (const a of anomalies ?? []) {
    if (region && region !== ALL_REGIONS && a.region !== region) {
      continue
    }
    if (a.infraYear) {
      seen.add(String(a.infraYear))
    }
  }
  return [...seen].sort((x, y) => y.localeCompare(x, undefined, { numeric: true }))
}

/** Count of list-level filters that are currently active (excludes region). */
export function countActiveFilters({ query = '', category = '', year = '', minRatio = '' }) {
  let count = 0
  if (query.trim()) count += 1
  if (category) count += 1
  if (year) count += 1
  if (minRatio !== '' && minRatio !== null) count += 1
  return count
}