import { describe, expect, it } from 'vitest'

import {
  ALL_REGIONS,
  countActiveFilters,
  filterFlagged,
  relaxFiltersFor,
  sortFlagged,
} from './listFilters.js'

const sample = [
  {
    contractId: 'A1',
    description: 'CONSTRUCTION OF CONCRETE BRIDGE',
    region: 'Region XI',
    infraYear: '2021',
    category: 'Bridges',
    budget: 1000,
    median_multiple: 12,
    anomaly_score: 5,
  },
  {
    contractId: 'B2',
    description: 'WATER SUPPLY PROGRAM, PHASE 2',
    region: 'Region I',
    infraYear: '2020',
    category: 'Water Provision',
    budget: 500,
    median_multiple: 40,
    anomaly_score: 4,
  },
  {
    contractId: 'C3',
    description: 'ROAD CONCRETING',
    region: 'Region XI',
    infraYear: '2022',
    category: 'Roads',
    budget: 2000,
    median_multiple: 8,
    anomaly_score: 6,
  },
]

describe('filterFlagged', () => {
  it('scopes to a region', () => {
    expect(filterFlagged(sample, { region: 'Region XI' }).map((a) => a.contractId)).toEqual([
      'A1',
      'C3',
    ])
  })

  it('searches title and contract id', () => {
    expect(filterFlagged(sample, { query: 'bridge' }).map((a) => a.contractId)).toEqual(['A1'])
    expect(filterFlagged(sample, { query: 'b2' }).map((a) => a.contractId)).toEqual(['B2'])
  })

  it('filters by category, year and minimum ratio', () => {
    expect(filterFlagged(sample, { category: 'Roads' }).map((a) => a.contractId)).toEqual(['C3'])
    expect(filterFlagged(sample, { year: '2021' }).map((a) => a.contractId)).toEqual(['A1'])
    expect(filterFlagged(sample, { minRatio: '10' }).map((a) => a.contractId)).toEqual(['A1', 'B2'])
  })

  it('combines filters and ignores the all-regions sentinel', () => {
    expect(
      filterFlagged(sample, { region: ALL_REGIONS, category: 'Bridges', minRatio: '5' }).map(
        (a) => a.contractId,
      ),
    ).toEqual(['A1'])
  })

  it('handles missing data', () => {
    expect(filterFlagged(null, {})).toEqual([])
  })
})

describe('sortFlagged', () => {
  it('defaults to ratio descending', () => {
    expect(sortFlagged(sample).map((a) => a.contractId)).toEqual(['B2', 'A1', 'C3'])
  })

  it('sorts by z, budget, then year', () => {
    expect(sortFlagged(sample, 'z').map((a) => a.contractId)).toEqual(['C3', 'A1', 'B2'])
    expect(sortFlagged(sample, 'budget').map((a) => a.contractId)).toEqual(['C3', 'A1', 'B2'])
    expect(sortFlagged(sample, 'year').map((a) => a.contractId)).toEqual(['C3', 'A1', 'B2'])
  })

  it('does not mutate the input list', () => {
    const input = [...sample]
    sortFlagged(input, 'budget')
    expect(input.map((a) => a.contractId)).toEqual(['A1', 'B2', 'C3'])
  })
})

describe('countActiveFilters', () => {
  it('counts non-empty list filters only', () => {
    expect(countActiveFilters({ query: 'x', category: 'Roads' })).toBe(2)
    expect(countActiveFilters({ query: '  ', minRatio: '' })).toBe(0)
    expect(countActiveFilters({ year: '2021' })).toBe(1)
  })

  it('counts a non-default region and the program-level toggle', () => {
    expect(countActiveFilters({ region: 'Region XI' })).toBe(1)
    expect(countActiveFilters({ region: ALL_REGIONS })).toBe(0)
    expect(countActiveFilters({ showProgramLevel: true })).toBe(1)
  })
})

describe('filterFlagged program-level toggle', () => {
  it('defaults to keeping program-level rows', () => {
    expect(filterFlagged(sample, {}).map((a) => a.contractId)).toEqual([
      'A1',
      'B2',
      'C3',
    ])
  })

  it('drops program-level descriptions when asked', () => {
    expect(
      filterFlagged(sample, { hideProgramLevel: true }).map((a) => a.contractId),
    ).toEqual(['A1', 'C3'])
  })

  it('treats a widened peer group as program-level', () => {
    const widened = [
      {
        contractId: 'D4',
        description: 'ROAD CONCRETING',
        category: 'Roads',
        componentCategories: 'Roads, Bridges and Water',
        region: 'Region XI',
        infraYear: '2021',
      },
    ]
    expect(filterFlagged(widened, { hideProgramLevel: true })).toEqual([])
  })
})

describe('relaxFiltersFor', () => {
  const record = {
    contractId: 'A1',
    description: 'CONSTRUCTION OF CONCRETE BRIDGE',
    region: 'Region XI',
    infraYear: '2021',
    category: 'Bridges',
    median_multiple: 12,
  }

  it('clears only the filters that exclude the record', () => {
    expect(
      relaxFiltersFor(record, { region: 'Region XI', category: 'Roads', year: '2021' }),
    ).toEqual({ region: null, filters: { category: '' } })
  })

  it('widens the region when it excludes the record', () => {
    expect(relaxFiltersFor(record, { region: 'Region I' })).toEqual({
      region: ALL_REGIONS,
      filters: {},
    })
  })

  it('clears a search, year or minimum ratio that excludes the record', () => {
    expect(relaxFiltersFor(record, { query: 'water' })).toEqual({
      region: null,
      filters: { query: '' },
    })
    expect(relaxFiltersFor(record, { year: '2020' })).toEqual({
      region: null,
      filters: { year: '' },
    })
    expect(relaxFiltersFor(record, { minRatio: '50' })).toEqual({
      region: null,
      filters: { minRatio: '' },
    })
  })

  it('makes no change when the record already matches', () => {
    expect(
      relaxFiltersFor(record, { region: 'Region XI', category: 'Bridges', year: '2021', minRatio: '10' }),
    ).toEqual({ region: null, filters: {} })
  })
})