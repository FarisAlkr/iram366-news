import { describe, expect, it } from 'vitest'

import { archivePageHref, paginationItems, parsePageNumber } from './pagination'

describe('paginationItems', () => {
  it('handles empty and single-page results', () => {
    expect(paginationItems(1, 0)).toEqual([])
    expect(paginationItems(1, 1)).toEqual([1])
  })

  it('shows every page when there are few', () => {
    expect(paginationItems(1, 4)).toEqual([1, 2, 3, 4])
    expect(paginationItems(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('elides the far side on the first page', () => {
    expect(paginationItems(1, 25)).toEqual([1, 2, 'gap', 25])
  })

  it('windows around the current page with gaps on both sides', () => {
    expect(paginationItems(10, 25)).toEqual([1, 'gap', 9, 10, 11, 'gap', 25])
  })

  it('never hides a single page behind a gap', () => {
    expect(paginationItems(4, 25)).toEqual([1, 2, 3, 4, 5, 'gap', 25])
    expect(paginationItems(22, 25)).toEqual([1, 'gap', 21, 22, 23, 24, 25])
  })

  it('clamps an out-of-range current page', () => {
    expect(paginationItems(99, 6)).toEqual([1, 'gap', 5, 6])
    expect(paginationItems(0, 6)).toEqual([1, 2, 'gap', 6])
  })
})

describe('parsePageNumber', () => {
  it('accepts positive integers', () => {
    expect(parsePageNumber('1')).toBe(1)
    expect(parsePageNumber('42')).toBe(42)
  })

  it('rejects anything else', () => {
    for (const raw of [undefined, '', '0', '-1', '2.5', 'abc', '1e3', '9999999']) {
      expect(parsePageNumber(raw)).toBeNull()
    }
  })
})

describe('archivePageHref', () => {
  it('maps page 1 to the homepage and later pages to /page/N', () => {
    expect(archivePageHref(1)).toBe('/')
    expect(archivePageHref(2)).toBe('/page/2')
  })
})
