// Number and currency formatting for the dashboard.

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

/**
 * Full peso amount, e.g. 1,747,731,000 -> "₱1,747,731,000".
 * Returns "—" for missing/blank so the UI never prints NaN or zeros.
 */
export function formatPeso(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  return PESO.format(value)
}

/**
 * Compact peso amount, e.g. 1747731078 -> "₱1.75B", 4581125 -> "₱4.58M".
 */
export function formatPesoCompact(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  if (Math.abs(value) >= 1e9) {
    return `₱${trimmed(value / 1e9)}B`
  }
  if (Math.abs(value) >= 1e6) {
    return `₱${trimmed(value / 1e6)}M`
  }
  if (Math.abs(value) >= 1e3) {
    return `₱${trimmed(value / 1e3)}K`
  }
  return `₱${Math.round(value).toLocaleString('en-PH')}`
}

/** Integer with thousands separators, or "—" when missing. */
export function formatInteger(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  return Math.round(value).toLocaleString('en-PH')
}

/** Percent with one decimal, or "—" when missing. */
export function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  return `${value.toFixed(1)}%`
}

/** Median multiple, e.g. 381.506 -> "381.5×". One decimal keeps the
 * row/panel numbers compact and readable at a glance. */
export function formatMultiple(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  return `${trimmed(value, 1)}×`
}

/**
 * Modified z-score, e.g. 4.708 -> "4.71". Shown without a σ symbol; the
 * "Modified z-score" label in the UI carries the meaning.
 */
export function formatZScore(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  return value.toFixed(2)
}

/** Trim a float for compact display without trailing zeros. */
function trimmed(value, digits = 2) {
  const rounded = Number(value.toFixed(digits))
  return String(rounded)
}