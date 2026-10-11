import { describe, expect, it } from 'vitest'

import {
  SCREENING_DISCLAIMER,
  SCOPE_NOTE,
  buildExplanation,
  buildHeadline,
  explainLegitimacy,
  peerGroupLine,
  scopeNoteFor,
} from './anomalyExplanation.js'

// The wording of a screening tool matters. A flag is a lead for review, never a
// verdict, so the user-facing copy must stay neutral. This test guards the
// derived copy against accusatory language regressing back in.
const FORBIDDEN =
  /suspicious|overpriced|over-priced|corrupt|fraud|scam|kickback|guilty|embezzl|price.?goug|steal|crime/i

const record = {
  contractId: '21L00041',
  description: 'WATER SUPPLY PROGRAM, PHASE 2',
  category: 'Water Provision',
  componentCategories: 'Water Provision, Sanitation',
  region: 'Region XI',
  infraYear: '2021',
  budget: 1747731078.43,
  median_budget: 4581125.03,
  median_multiple: 381.5068938249917,
  anomaly_score: 4.708261779581363,
  group_size: 68,
}

describe('neutral language', () => {
  it('keeps derived copy free of accusatory wording', () => {
    const texts = [
      SCOPE_NOTE,
      scopeNoteFor(record),
      buildExplanation(record),
      buildHeadline(record),
      peerGroupLine(record),
    ]
    for (const text of texts) {
      expect(text).not.toMatch(FORBIDDEN)
    }
    for (const reason of explainLegitimacy(record)) {
      expect(`${reason.title} ${reason.detail}`).not.toMatch(FORBIDDEN)
    }
  })

  it('only mentions forbidden terms in the disclaimer as an explicit negation', () => {
    const match = SCREENING_DISCLAIMER.match(FORBIDDEN)
    expect(match).toBeTruthy()
    expect(SCREENING_DISCLAIMER).toMatch(/not (evidence of|a verdict|an accusation)/i)
  })
})
