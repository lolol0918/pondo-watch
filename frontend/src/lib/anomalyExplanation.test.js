import { describe, expect, it } from 'vitest'

import {
  PEER_GROUP_CAVEAT,
  PROGRAM_LEVEL_TAG,
  SCREENING_DISCLAIMER,
  SCOPE_NOTE,
  buildEvidenceSummary,
  buildExplanation,
  buildHeadline,
  explainLegitimacy,
  hasScopeKeywords,
  isProgramLevel,
  isWidenedPeerGroup,
  peerGroupLine,
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
  it('flags scope keywords and a wide peer-budget spread', () => {
    const reasons = explainLegitimacy({
      ...record,
      group_size: 683,
      description: 'LOCAL INFRASTRUCTURE PROGRAM (LIP) - NATIONAL ROADS',
      mad_log: 0.393,
    })
    const titles = reasons.map((r) => r.title)
    expect(titles).toContain('Bundled or program scope')
    expect(titles).toContain('Peer budgets span a wide range')
  })

  it('never offers a large peer group itself as a legitimacy reason', () => {
    // A large group makes the median stable but says nothing about scope
    // comparability, so it must not appear under "why this might be legitimate".
    const reasons = explainLegitimacy({
      group_size: 5000,
      mad_log: 0.01,
      description: 'ASSET PRESERVATION OF NATIONAL ROADS',
    })
    expect(reasons).toEqual([])
  })

  it('returns an empty list when no data-driven factor applies', () => {
    expect(explainLegitimacy(record)).toEqual([])
    expect(explainLegitimacy({})).toEqual([])
  })
})

describe('PEER_GROUP_CAVEAT', () => {
  it('states the matching keys and denies a like-for-like guarantee', () => {
    const text = PEER_GROUP_CAVEAT.toLowerCase()
    expect(text).toContain('category, region and year')
    expect(text).toContain('not make the projects alike')
    expect(text).toContain('outlier statistic')
  })

  it('does not claim a large group proves comparability', () => {
    expect(PEER_GROUP_CAVEAT).not.toMatch(
      /guarantee|proves? comparab|scope is (the )?same/i,
    )
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

describe('isProgramLevel', () => {
  it('detects scope keywords and widened peer groups', () => {
    expect(isWidenedPeerGroup({ category: 'Bridges', componentCategories: 'Bridges' })).toBe(false)
    expect(
      isWidenedPeerGroup({ category: 'Roads', componentCategories: 'Roads, Bridges' }),
    ).toBe(true)
    expect(isProgramLevel({ description: 'BRIDGE CONSTRUCTION' })).toBe(false)
    expect(isProgramLevel({ description: 'WATER SUPPLY PROGRAM' })).toBe(true)
    expect(
      isProgramLevel({
        description: 'BRIDGE CONSTRUCTION',
        category: 'Roads',
        componentCategories: 'Roads, Bridges',
      }),
    ).toBe(true)
  })

  it('exposes a neutral tag', () => {
    expect(PROGRAM_LEVEL_TAG).toContain('Program-level line')
  })
})

describe('buildHeadline and peerGroupLine', () => {
  it('states the budget, multiple and typical peer budget', () => {
    expect(
      buildHeadline({
        budget: 1747730781.43,
        median_budget: 4581125.03,
        median_multiple: 381.5068938249917,
      }),
    ).toBe(
      'Recorded budget of ₱1.75B is 381.5× the typical comparable project (₱4.58M).',
    )
  })

  it('names the peer group, its size and the matching keys', () => {
    const line = peerGroupLine({ ...record, region: 'Region XI', infraYear: '2021' })
    expect(line).toContain('Bridges')
    expect(line).toContain('Region XI')
    expect(line).toContain('68 projects matched on category, region and year')
    // "comparable" would imply the peers are alike in scope; the line only
    // reports what the grouping keys actually guarantee.
    expect(line).not.toContain('comparable')
  })

  it('never prints undefined for missing fields', () => {
    expect(buildHeadline({ budget: 1000 })).not.toContain('undefined')
    expect(peerGroupLine({})).not.toContain('undefined')
  })
})