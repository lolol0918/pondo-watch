import { describe, expect, it } from 'vitest'

import {
  SCREENING_DISCLAIMER,
  SCOPE_NOTE,
  buildEvidenceSummary,
  buildExplanation,
  explainLegitimacy,
  hasScopeKeywords,
  scopeNoteFor,
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
    expect(text).toContain('381.5×')
    expect(text).toContain('68')
    expect(text).toContain('Region XI')
    expect(text).toContain('(2021)')
    expect(text).toContain('4.71')
  })

  it('calls the statistic a modified z-score and never prints σ', () => {
    const text = buildExplanation(record)
    expect(text.toLowerCase()).toContain('modified z-score')
    expect(text).not.toContain('σ')
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

  it('notes that scope differences can explain an outlier', () => {
    expect(SCOPE_NOTE.toLowerCase()).toContain('scope differences')
    expect(SCOPE_NOTE.toLowerCase()).toContain('not a finding')
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

describe('buildEvidenceSummary', () => {
  it('is a single sentence with budget, multiple and group size', () => {
    const text = buildEvidenceSummary(record)
    expect(text).toBe(
      'Recorded budget of ₱1.75B is 381.5× the median of 68 comparable projects.',
    )
  })

  it('survives missing fields without printing undefined', () => {
    const text = buildEvidenceSummary({ budget: 1200000000 })
    expect(text).toContain('₱1.2B')
    expect(text).not.toContain('undefined')
  })
})

describe('hasScopeKeywords', () => {
  it('matches program/package/cluster/various in any case', () => {
    expect(hasScopeKeywords('CONSTRUCTION UNDER THE LOCAL PROGRAM')).toBe(true)
    expect(hasScopeKeywords('water supply packages, phase 2')).toBe(true)
    expect(hasScopeKeywords('various water projects')).toBe(true)
    expect(hasScopeKeywords('cluster of bridges')).toBe(true)
  })

  it('does not match ordinary descriptions', () => {
    expect(hasScopeKeywords('CONSTRUCTION OF CONCRETE BRIDGE')).toBe(false)
    expect(hasScopeKeywords(null)).toBe(false)
    expect(hasScopeKeywords('')).toBe(false)
  })
})

describe('explainLegitimacy', () => {
  it('flags a wide peer group, scope keywords and a wide spread', () => {
    const reasons = explainLegitimacy({
      ...record,
      group_size: 150,
      description: 'LOCAL PROGRAM: WATER SUPPLY SYSTEM',
      mad_log: 0.25,
    })
    const titles = reasons.map((r) => r.title)
    expect(titles).toContain('Wide peer group')
    expect(titles).toContain('Bundled or program scope')
    expect(titles).toContain('Peer budgets vary widely')
  })

  it('returns an empty list when no data-driven factor applies', () => {
    expect(explainLegitimacy(record)).toEqual([])
    expect(explainLegitimacy({})).toEqual([])
  })
})

describe('scopeNoteFor', () => {
  it('mentions scope, geography and neutrality', () => {
    const text = scopeNoteFor()
    expect(text.toLowerCase()).toContain('scope differences')
    expect(text.toLowerCase()).toContain('geographic')
    expect(text.toLowerCase()).not.toContain('corrupt')
  })
})