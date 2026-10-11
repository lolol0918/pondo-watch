import { describe, expect, it } from 'vitest'

import {
  COLOR_MISSING,
  SEVERITY_BUCKETS,
  colorForFlaggedShare,
  markerRadiusForRatio,
  maxFlaggedShare,
  severityForRatio,
} from './scale.js'

describe('colorForFlaggedShare', () => {
  it('is light for zero, muted steel blue for the scale maximum', () => {
    expect(colorForFlaggedShare(0, 4)).toBe('#eef2f6')
    expect(colorForFlaggedShare(4, 4)).toBe('#4f7196')
  })

  it('clamps out-of-range values', () => {
    expect(colorForFlaggedShare(10, 4)).toBe('#4f7196')
    expect(colorForFlaggedShare(-1, 4)).toBe('#eef2f6')
  })

  it('returns the missing colour for unusable inputs', () => {
    for (const value of [null, undefined, NaN, Infinity]) {
      expect(colorForFlaggedShare(value, 4)).toBe(COLOR_MISSING)
    }
    expect(colorForFlaggedShare(1, 0)).toBe(COLOR_MISSING)
  })
})

describe('maxFlaggedShare', () => {
  it('finds the highest flagged share among on-map regions only', () => {
    const summary = {
      regions: [
        { region: 'Region IX', on_map: true, flagged_percentage: 4.06 },
        { region: 'NCR', on_map: true, flagged_percentage: 0.45 },
        { region: 'Negros Island Region', on_map: false, flagged_percentage: 9.99 },
      ],
    }
    expect(maxFlaggedShare(summary)).toBe(4.06)
  })

  it('handles a missing summary', () => {
    expect(maxFlaggedShare(null)).toBe(0)
  })
})

describe('severityForRatio', () => {
  it('buckets ratios with neutral, non-red/green colors', () => {
    expect(severityForRatio(4)).toEqual(SEVERITY_BUCKETS[0])
    expect(severityForRatio(10)).toEqual(SEVERITY_BUCKETS[1])
    expect(severityForRatio(29.9)).toEqual(SEVERITY_BUCKETS[1])
    expect(severityForRatio(30)).toEqual(SEVERITY_BUCKETS[2])
    expect(severityForRatio(381.5)).toEqual(SEVERITY_BUCKETS[2])
  })

  it('uses the colorblind-safe muted palette (no red/green)', () => {
    expect(SEVERITY_BUCKETS.map((b) => b.color)).toEqual([
      '#88ccee',
      '#ddcc77',
      '#332288',
    ])
  })
})

describe('markerRadiusForRatio', () => {
  it('stays within 3-9 px and grows with the ratio', () => {
    const max = 381.5
    const small = markerRadiusForRatio(3, max)
    const large = markerRadiusForRatio(381.5, max)
    expect(small).toBeGreaterThanOrEqual(3)
    expect(small).toBeLessThan(large)
    expect(large).toBeLessThanOrEqual(9)
  })

  it('clamps missing or degenerate inputs to the minimum', () => {
    expect(markerRadiusForRatio(null, 10)).toBe(3)
    expect(markerRadiusForRatio(0, 10)).toBe(3)
  })
})