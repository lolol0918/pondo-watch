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