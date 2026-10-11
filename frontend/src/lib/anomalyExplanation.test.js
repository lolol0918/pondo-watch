import { describe, expect, it } from 'vitest'

import {
  SCREENING_DISCLAIMER,
  buildExplanation,
} from './anomalyExplanation.js'

const record = {
  contractId: '21L00041',
  description: 'CONSTRUCTION OF CONCRETE BRIDGE',
  category: 'Bridges',
  componentCategories: 'Bridges',
  region: 'Region XI',
  infraYear: '2021',
  budget: 1747731078.43,
  median_budget: 4581125.03,
  median_multiple: 381.5068938249917,
  anomaly_score: 4.708261779581363,
  group_size: 68.0,
}

describe('buildExplanation', () => {
  it('contains the budget, multiple, group size, region and year', () => {
    const text = buildExplanation(record)
    expect(text).toContain('₱1.75B')
    expect(text).toContain('381.507×')
    expect(text).toContain('68')
    expect(text).toContain('Region XI')
    expect(text).toContain('(2021)')
    expect(text).toContain('4.71σ')
  })

  it('explicitly frames the signal as statistical', () => {
    expect(SCREENING_DISCLAIMER.toLowerCase()).toContain('not evidence')
    expect(SCREENING_DISCLAIMER.toLowerCase()).toContain('screening signals')
  })

  it('does not claim wrongdoing', () => {
    const lower = buildExplanation(record).toLowerCase()
    expect(lower).not.toContain('corrupt')
    expect(lower).not.toContain('fraud')
    expect(lower).not.toContain('overpric')
  })

  it('survives missing evidence fields', () => {
    const text = buildExplanation({
      region: 'Region I',
      infraYear: '2020',
      budget: 1200000000,
    })
    expect(text).toContain('Region I')
    expect(text).not.toContain('undefined')
  })
})