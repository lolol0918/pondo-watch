import { describe, expect, it } from 'vitest'

import { effectiveMad, peerVisualModel } from './peerVisual.js'

const record = {
  budget: 1747730781.43,
  median_budget: 4581125.03,
  mad_log: 0.36981790503067646,
  fence_budget: 202231229.91,
}

describe('effectiveMad', () => {
  it('uses the exported MAD when present', () => {
    expect(effectiveMad(record)).toBeCloseTo(0.36981790503067646, 12)
  })

  it('floors at the pipeline MAD floor when MAD is below it', () => {
    expect(effectiveMad({ mad_log: 0.001 })).toBeCloseTo(0.01, 12)
  })

  it('floors when MAD is missing so scores stay finite', () => {
    expect(effectiveMad({})).toBeCloseTo(0.01, 12)
  })
})

describe('peerVisualModel', () => {
  it('places the project far right of the peer band for the sample record', () => {
    const m = peerVisualModel(record)
    expect(m).not.toBeNull()
    expect(m.x(m.logBudget)).toBeGreaterThan(m.x(m.bandHigh))
    expect(m.x(m.logBudget)).toBeGreaterThan(m.x(m.logFence))
    expect(m.ticks.length).toBeGreaterThanOrEqual(3)
  })

  it('positions remain inside the chart (0-100%)', () => {
    const m = peerVisualModel(record)
    for (const logV of [m.logMedian, m.logFence, m.logBudget]) {
      expect(m.x(logV)).toBeGreaterThanOrEqual(0)
      expect(m.x(logV)).toBeLessThanOrEqual(100)
    }
  })

  it('returns null for a missing or non-positive budget', () => {
    expect(peerVisualModel({})).toBeNull()
    expect(peerVisualModel({ budget: 0, median_budget: 100 })).toBeNull()
    expect(peerVisualModel({ budget: 100, median_budget: -5 })).toBeNull()
  })
})