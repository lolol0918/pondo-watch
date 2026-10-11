import { describe, expect, it } from 'vitest'

import {
  COLOR_MISSING,
  colorForFlaggedShare,
  maxFlaggedShare,
} from './scale.js'

describe('colorForFlaggedShare', () => {
  it('is light for zero, dark for the scale maximum', () => {
    expect(colorForFlaggedShare(0, 4)).toBe('#fef3f2')
    expect(colorForFlaggedShare(4, 4)).toBe('#dc2626')
  })

  it('clamps out-of-range values', () => {
    expect(colorForFlaggedShare(10, 4)).toBe('#dc2626')
    expect(colorForFlaggedShare(-1, 4)).toBe('#fef3f2')
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