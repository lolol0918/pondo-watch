import { describe, expect, it } from 'vitest'

import {
  buildPsgcLookup,
  findRowByLabel,
  selectableRegions,
} from './regions.js'

const summary = {
  totals: { projects: 248220, flagged: 5443 },
  regions: [
    {
      region: 'Region IV-B',
      psgc: 1700000000,
      map_name: 'MIMAROPA Region',
      on_map: true,
      projects: 10998,
      flagged: 186,
    },
    {
      region: 'Region XIII',
      psgc: 1600000000,
      map_name: 'Region XIII (Caraga)',
      on_map: true,
      projects: 9253,
      flagged: 314,
    },
    {
      region: 'Negros Island Region',
      psgc: null,
      on_map: false,
      projects: 9933,
      flagged: 341,
    },
    {
      region: 'Central Office',
      psgc: null,
      on_map: false,
      projects: 297,
      flagged: 0,
    },
  ],
}

describe('buildPsgcLookup', () => {
  it('keys rows by PSGC code, skipping null codes', () => {
    const lookup = buildPsgcLookup(summary)
    expect(lookup.has(1700000000)).toBe(true)
    expect(lookup.get(1700000000).region).toBe('Region IV-B')
    expect(lookup.get(1600000000).region).toBe('Region XIII')
    expect(lookup.size).toBe(2)
  })

  it('handles a missing summary', () => {
    expect(buildPsgcLookup(null).size).toBe(0)
  })
})

describe('findRowByLabel', () => {
  it('finds an exact label match only', () => {
    expect(findRowByLabel(summary, 'Region XIII').psgc).toBe(1600000000)
    expect(findRowByLabel(summary, 'Caraga')).toBeNull()
    expect(findRowByLabel(null, 'Region XIII')).toBeNull()
  })
})

describe('selectableRegions', () => {
  it('includes non-geographic and off-map regions', () => {
    const labels = selectableRegions(summary).map((row) => row.region)
    expect(labels).toContain('Negros Island Region')
    expect(labels).toContain('Central Office')
    expect(selectableRegions(null)).toEqual([])
  })
})