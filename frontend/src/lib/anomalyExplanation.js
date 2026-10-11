// Plain-language evidence text for a flagged project.
//
// Everything is derived from the fields the detector exports for an anomaly,
// so the sentence can never disagree with the numbers shown in the evidence
// panel. The wording is deliberately measured: a flag is a screening signal,
// not an accusation.

import { formatPesoCompact, formatMultiple, formatScore } from './format.js'

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
  const score = formatScore(record.anomaly_score)
  const budget = formatPesoCompact(record.budget)

  const sentence =
    `Its budget of ${budget} is ${multiple} the median budget of the ` +
    `${group} comparable ${pluralize(record.category)} in ` +
    `${record.region} (${record.infraYear}). The anomaly score of ${score} ` +
    `is how far above the peer-group median this project sits.`

  return sentence
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