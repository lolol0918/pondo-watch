import { describe, expect, it } from 'vitest'

import { DEFAULT_SORT } from './listFilters.js'
import { buildSearch, readUrlState } from './urlState.js'

describe('readUrlState', () => {
  it('returns defaults for an empty search string', () => {
    expect(readUrlState('')).toEqual({
      region: null,
      project: null,
      query: '',
      category: '',
      year: '',
      minRatio: '',
      sort: DEFAULT_SORT,
      showProgramLevel: false,
    })
  })

  it('parses every tracked field', () => {
    const search =
      '?region=Region%20II&project=ABC-123&q=talomo&category=Bridge&year=2021&minRatio=50&sort=budget&program=all'
    expect(readUrlState(search)).toEqual({
      region: 'Region II',
      project: 'ABC-123',
      query: 'talomo',
      category: 'Bridge',
      year: '2021',
      minRatio: '50',
      sort: 'budget',
      showProgramLevel: true,
    })
  })

  it('ignores unknown parameters', () => {
    expect(readUrlState('?nope=1').region).toBeNull()
  })
})

describe('buildSearch', () => {
  it('omits empty fields and the default sort', () => {
    expect(
      buildSearch({
        region: null,
        project: null,
        query: '',
        category: '',
        year: '',
        minRatio: '',
        sort: DEFAULT_SORT,
      }),
    ).toBe('')
  })

  it('round-trips a full state', () => {
    const state = {
      region: 'Region II',
      project: 'ABC-123',
      query: 'talomo',
      category: 'Bridge',
      year: '2021',
      minRatio: '50',
      sort: 'budget',
      showProgramLevel: true,
    }
    expect(readUrlState(`?${buildSearch(state)}`)).toEqual(state)
  })

  it('omits the default program-level state', () => {
    expect(buildSearch({ showProgramLevel: false })).toBe('')
    expect(buildSearch({ showProgramLevel: true })).toBe('program=all')
  })

  it('keeps a non-default sort and drops the default one', () => {
    expect(buildSearch({ sort: 'budget' })).toBe('sort=budget')
    expect(buildSearch({ sort: DEFAULT_SORT })).toBe('')
  })
})
