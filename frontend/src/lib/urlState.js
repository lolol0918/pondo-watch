import { useEffect, useRef } from 'react'

import { DEFAULT_SORT } from './listFilters.js'

/**
 * Plain history-API state sync (no router). The dashboard keeps its region,
 * selected project, and filters in the query string so a reload or a shared
 * link restores exactly what the user was looking at.
 */

export function readUrlState(search) {
  const params = new URLSearchParams(search || '')
  return {
    region: params.get('region') || null,
    project: params.get('project') || null,
    query: params.get('q') || '',
    category: params.get('category') || '',
    year: params.get('year') || '',
    minRatio: params.get('minRatio') || '',
    sort: params.get('sort') || DEFAULT_SORT,
    // Program-level lines are hidden by default; `program=all` opts into
    // showing them, so the default state keeps a clean URL.
    showProgramLevel: params.get('program') === 'all',
  }
}

export function buildSearch(state) {
  const params = new URLSearchParams()
  if (state.region) {
    params.set('region', state.region)
  }
  if (state.project) {
    params.set('project', state.project)
  }
  if (state.query) {
    params.set('q', state.query)
  }
  if (state.category) {
    params.set('category', state.category)
  }
  if (state.year) {
    params.set('year', state.year)
  }
  if (state.minRatio !== undefined && state.minRatio !== null && state.minRatio !== '') {
    params.set('minRatio', String(state.minRatio))
  }
  if (state.sort && state.sort !== DEFAULT_SORT) {
    params.set('sort', state.sort)
  }
  if (state.showProgramLevel) {
    params.set('program', 'all')
  }
  return params.toString()
}

/**
 * Mirror the tracked state into the address bar. Uses replaceState so typing
 * in the search box does not fill the back stack with history entries.
 */
export function useUrlSync(state) {
  const search = buildSearch(state)
  useEffect(() => {
    const { pathname, hash, search: current } = window.location
    const next = `${pathname}${search ? `?${search}` : ''}${hash}`
    if (next !== `${pathname}${current}${hash}`) {
      window.history.replaceState(null, '', next)
    }
  }, [search])
}

/**
 * Re-apply state when the user navigates with back/forward or pastes a URL.
 * The handler is kept in a ref so listeners are attached only once.
 */
export function useUrlPopState(handler) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const onPop = () => ref.current(readUrlState(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
