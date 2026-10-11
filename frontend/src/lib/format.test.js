import { describe, expect, it } from 'vitest'

import {
  formatInteger,
  formatMultiple,
  formatPercent,
  formatPeso,
  formatPesoCompact,
  formatScore,
} from './format.js'

describe('formatPeso', () => {
  it('formats full peso amounts with thousands separators', () => {
    expect(formatPeso(1747731078.43)).toBe('₱1,747,731,078')
  })

  it('returns an em dash for missing and non-finite values', () => {
    for (const value of [null, undefined, NaN, Infinity, -Infinity, 'x']) {
      expect(formatPeso(value)).toBe('—')
    }
  })
})

describe('formatPesoCompact', () => {
  it('uses B/M/K suffixes', () => {
    expect(formatPesoCompact(1747731078)).toBe('₱1.75B')
    expect(formatPesoCompact(4581125)).toBe('₱4.58M')
    expect(formatPesoCompact(999900)).toBe('₱999.9K')
    expect(formatPesoCompact(1200)).toBe('₱1.2K')
    expect(formatPesoCompact(450)).toBe('₱450')
  })

  it('handles missing values', () => {
    expect(formatPesoCompact(null)).toBe('—')
  })
})

describe('formatInteger / formatPercent / formatMultiple / formatScore', () => {
  it('formats integers with separators', () => {
    expect(formatInteger(5443)).toBe('5,443')
    expect(formatInteger(null)).toBe('—')
  })

  it('formats percentages with one decimal', () => {
    expect(formatPercent(2.192)).toBe('2.2%')
    expect(formatPercent(null)).toBe('—')
  })

  it('formats median multiples with an × sign', () => {
    expect(formatMultiple(381.5068938249917)).toBe('381.507×')
    expect(formatMultiple(1.0)).toBe('1×')
  })

  it('formats anomaly scores in robust sigmas', () => {
    expect(formatScore(4.708261779581363)).toBe('4.71σ')
  })
})