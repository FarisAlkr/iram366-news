import { describe, expect, it } from 'vitest'

import { canPlaceHero, canPublishDirectly, effectiveStatus } from './editorial-roles'

describe('canPublishDirectly / canPlaceHero', () => {
  it('allows admins and editors only', () => {
    expect(canPublishDirectly('admin')).toBe(true)
    expect(canPublishDirectly('editor')).toBe(true)
    expect(canPublishDirectly('author')).toBe(false)
    expect(canPublishDirectly(undefined)).toBe(false)
    expect(canPlaceHero('author')).toBe(false)
    expect(canPlaceHero('editor')).toBe(true)
  })
})

describe('effectiveStatus', () => {
  it('turns an author publish into a review submission', () => {
    expect(effectiveStatus('author', 'published')).toBe('in-review')
  })

  it('lets editors and admins publish', () => {
    expect(effectiveStatus('editor', 'published')).toBe('published')
    expect(effectiveStatus('admin', 'published')).toBe('published')
  })

  it('never changes non-publish statuses', () => {
    for (const s of ['draft', 'in-review', 'archived']) {
      expect(effectiveStatus('author', s)).toBe(s)
    }
  })
})
