import { describe, expect, it } from 'vitest'

import {
  countCoordinateCoverage,
  isValidCoordinate,
  withCoordinates,
} from './markers.js'

const sample = [
  { contractId: 'A1', region: 'Region XI', latitude: 7.1, longitude: 125.6 },
  { contractId: 'A2', region: 'Region XI', latitude: null, longitude: null },
  { contractId: 'A3', region: 'Region XI' },
  { contractId: 'A4', region: 'Region I', latitude: 16.0, longitude: 120.0 },
  { contractId: 'A5', region: 'Region I', latitude: 0, longitude: 0 },
  { contractId: 'A6', region: 'Region I', latitude: 1000, longitude: 120.0 },
  { contractId: 'A7', region: 'Region II', latitude: NaN, longitude: 121.0 },
]

describe('isValidCoordinate', () => {
  it('accepts in-range, non-zero coordinates', () => {
    expect(isValidCoordinate(7.1, 125.6)).toBe(true)
    expect(isValidCoordinate(-16.5, 145.2)).toBe(true)
  })

  it('rejects missing and non-numeric values', () => {
    expect(isValidCoordinate(null, 125)).toBe(false)
    expect(isValidCoordinate(undefined, 125)).toBe(false)
    expect(isValidCoordinate('7.1', 125)).toBe(false)
    expect(isValidCoordinate(7.1)).toBe(false)
  })

  it('rejects non-finite and out-of-range values', () => {
    expect(isValidCoordinate(NaN, 125)).toBe(false)
    expect(isValidCoordinate(Infinity, 125)).toBe(false)
    expect(isValidCoordinate(1000, 125)).toBe(false)
    expect(isValidCoordinate(7, 250)).toBe(false)
  })

  it('rejects the (0, 0) placeholder', () => {
    expect(isValidCoordinate(0, 0)).toBe(false)
  })
})

describe('countCoordinateCoverage', () => {
  it('totals valid vs missing across all regions', () => {
    expect(countCoordinateCoverage(sample)).toEqual({
      total: 7,
      valid: 2,
      without: 5,
    })
  })

  it('can scope the count to one region', () => {
    expect(countCoordinateCoverage(sample, 'Region I')).toEqual({
      total: 3,
      valid: 1,
      without: 2,
    })
  })

  it('handles a null input', () => {
    expect(countCoordinateCoverage(null)).toEqual({ total: 0, valid: 0, without: 0 })
  })
})

describe('withCoordinates', () => {
  it('returns only region-scoped records with plotable coordinates', () => {
    const dots = withCoordinates(sample, null).map((a) => a.contractId)
    expect(dots).toEqual(['A1', 'A4'])

    expect(withCoordinates(sample, 'Region XI').map((a) => a.contractId)).toEqual([
      'A1',
    ])
  })

  it('returns an empty list for missing data', () => {
    expect(withCoordinates(null, null)).toEqual([])
  })
})