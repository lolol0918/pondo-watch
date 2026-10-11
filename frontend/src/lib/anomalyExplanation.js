// Plain-language evidence text for a flagged project.
//
// Everything is derived from the fields the detector exports for an anomaly,
// so the sentence can never disagree with the numbers shown in the evidence
// panel. The wording is deliberately measured: a flag is a screening signal,
// not an accusation.

import { formatInteger, formatPesoCompact, formatMultiple, formatZScore } from './format.js'

/**
 * Turn one cost-anomaly record into a sentence the reader can verify against
 * the evidence panel. Kept as a pure function so it is trivial to unit test.
 *
 * @param {object} record - a record from data/processed/cost_anomalies.json
 * @returns {string}
 */
export function buildExplanation(record) {
  const group = record.group_size ?? 'n/a'
  const multiple = formatMultiple(record.median_multiple)
  const score = formatZScore(record.anomaly_score)
  const budget = formatPesoCompact(record.budget)

  const sentence =
    `Its budget of ${budget} is ${multiple} the median budget of the ` +
    `${group} comparable ${pluralize(record.category)} in ` +
    `${record.region} (${record.infraYear}). Its modified z-score of ${score} ` +
    `shows how far above the peer-group median this project sits.`

  return sentence
}

/**
 * The one-sentence verdict shown at the top of the evidence panel. Kept to a
 * single sentence so a reader can confirm the ordering claims before digging
 * into the statistics: budget vs. median of how many comparables.
 *
 * @param {object} record - a record from data/processed/cost_anomalies.json
 * @returns {string}
 */
export function buildEvidenceSummary(record) {
  const group = record.group_size ?? 'n/a'
  const multiple = formatMultiple(record.median_multiple)
  const budget = formatPesoCompact(record.budget)
  return (
    `Recorded budget of ${budget} is ${multiple} the median of ` +
    `${group} comparable projects.`
  )
}

function groupLabelFor(record) {
  if (
    record?.componentCategories &&
    record?.category &&
    record.componentCategories !== record.category
  ) {
    return `${record.componentCategories} (component category)`
  }
  return record?.category ?? 'similar projects'
}

/**
 * The headline shown at the top of the evidence panel, e.g.
 * "Recorded budget ₱34.31M is 11.6× the typical comparable project (₱2.97M)."
 * Only uses the recorded budget, the peer median and the multiple.
 *
 * @param {object} record
 * @returns {string}
 */
export function buildHeadline(record) {
  const multiple = formatMultiple(record?.median_multiple)
  const budget = formatPesoCompact(record?.budget)
  const median = formatPesoCompact(record?.median_budget)
  if (!Number.isFinite(record?.median_budget)) {
    return `Recorded budget of ${budget} is ${multiple} the typical comparable project.`
  }
  return (
    `Recorded budget of ${budget} is ${multiple} the typical comparable ` +
    `project (${median}).`
  )
}

/**
 * One line naming the peer group and its size, e.g.
 * "Peer group: Bridges in Region XI (2021) — 68 comparable projects."
 *
 * @param {object} record
 * @returns {string}
 */
export function peerGroupLine(record) {
  const group = groupLabelFor(record)
  const size = Number.isFinite(record?.group_size)
    ? record.group_size
    : null
  const sizeText =
    size === null
      ? 'size not available'
      : `${formatInteger(size)} comparable ${size === 1 ? 'project' : 'projects'}`
  const where = [record?.region, record?.infraYear && `(${record.infraYear})`]
    .filter(Boolean)
    .join(' ')
  return `Peer group: ${group}${where ? ` in ${where}` : ''} — ${sizeText}.`
}

/**
 * Descriptions that suggest a bundled or program-level scope of work. These
 * words can signal that the recorded budget covers several projects rather
 * than one comparable structure, which is a legitimate reason for a large
 * multiple. Computed client-side from the description field only.
 */
const SCOPE_KEYWORDS = /\b(programs?|packages?|clusters?|various)\b/i

/**
 * Whether a flagged project's description hints at a bundled scope.
 * @param {string|null|undefined} description
 * @returns {boolean}
 */
export function hasScopeKeywords(description) {
  return Boolean(description) && SCOPE_KEYWORDS.test(description)
}

/**
 * A widened peer group: the pipeline groups projects by `componentCategories`,
 * and when that differs from the project's own `category` the comparison pool
 * spans more than one category. Derived client-side from the two exported
 * fields; no threshold or classification is re-derived from the pipeline.
 *
 * @param {object} record
 * @returns {boolean}
 */
export function isWidenedPeerGroup(record) {
  const component = record?.componentCategories
  const category = record?.category
  return Boolean(component) && Boolean(category) && component !== category
}

/**
 * A "program-level line": a description that names a program/package/cluster/
 * "various" scope, or a project compared against a widened peer group. These
 * rows are hidden by default behind the "Hide program-level lines" toggle
 * because their budget may cover several projects at once.
 *
 * @param {object} record
 * @returns {boolean}
 */
export function isProgramLevel(record) {
  return hasScopeKeywords(record?.description) || isWidenedPeerGroup(record)
}

/** Neutral tag shown on program-level rows (never a verdict). */
export const PROGRAM_LEVEL_TAG = 'Program-level line: scope unclear'

// A peer group of at least this many comparable projects is treated as
// "wide": a median drawn from a large group is a stable reference point.
const WIDE_GROUP_SIZE = 100
// A MAD (log10) at or above this spread means the group's budgets are so
// scattered that the median is a less precise benchmark.
const WIDE_SPREAD_MAD = 0.2

/**
 * Data-driven reasons a high multiple might still be legitimate, ordered from
 * strongest to weakest. Only reasons that actually hold for this record are
 * returned; the caller renders "none found" when the list is empty.
 *
 * @param {object} record - a cost-anomaly record
 * @returns {Array<{title: string, detail: string}>}
 */
export function explainLegitimacy(record) {
  const reasons = []
  const groupSize = record?.group_size
  if (Number.isFinite(groupSize) && groupSize >= WIDE_GROUP_SIZE) {
    reasons.push({
      title: 'Wide peer group',
      detail:
        `The median is drawn from ${formatInteger(groupSize)} comparable ` +
        `projects, so it is a stable reference point rather than a lucky ` +
        `comparison against a handful of projects.`,
    })
  }
  if (hasScopeKeywords(record?.description)) {
    reasons.push({
      title: 'Bundled or program scope',
      detail:
        'The description suggests a program, package, cluster or "various" ' +
        'scope of work, which can legitimately carry a much larger budget ' +
        'than a single comparable project.',
    })
  }
  const mad = record?.mad_log
  if (Number.isFinite(mad) && mad >= WIDE_SPREAD_MAD) {
    reasons.push({
      title: 'Peer budgets vary widely',
      detail:
        `Peer-group budgets are scattered (±${mad.toFixed(3)} on a log10 ` +
        `scale), so the median is a less precise benchmark — a project can ` +
        `clear the fence while still being within the group's natural range.`,
    })
  }
  return reasons
}

/**
 * Where the plain-language explanation leaves off. Scope differences are the
 * most common legitimate reason an apparently high multiple is not actually a
 * red flag, so the evidence panel stays honest by saying so.
 */
export const SCOPE_NOTE =
  'Scope differences — a larger structure, harder site conditions, or a ' +
  'genuinely different scope of work — can legitimately explain an unusually ' +
  'high multiple. A flag is a reason for further review, not a finding.'

/**
 * The generic "why this might be legitimate" paragraph for any flagged
 * project: scope, geography and markets are the usual neutral explanations,
 * and none of them can be tested from the exported fields alone.
 */
export function scopeNoteFor() {
  return (
    SCOPE_NOTE +
    ' Geographic price differences and commodity or fuel price changes can ' +
    'likewise push one project far above its regional-year peers.'
  )
}

/**
 * The neutral framing shown wherever a project or list of projects is
 * presented. Stating the norm once in plain words reduces the risk that a
 * single high multiple reads as an accusation.
 */
export const SCREENING_DISCLAIMER =
  'Statistical flags are screening signals, not evidence of corruption or ' +
  'proof of overpricing. Every flagged project requires further investigation ' +
  'before any conclusion is drawn.'

function pluralize(noun) {
  if (!noun) {
    return 'projects'
  }
  return noun
}