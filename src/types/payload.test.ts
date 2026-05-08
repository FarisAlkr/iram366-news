import { describe, expect, it } from 'vitest'

import { pickMediaUrl, resolveRef } from './payload'
import type { Media } from './payload'

describe('resolveRef', () => {
  it('returns object refs unchanged', () => {
    const obj = { id: 1, name: 'x' }
    expect(resolveRef(obj as unknown as { id: number; name: string })).toEqual(obj)
  })

  it('returns undefined for id-only refs', () => {
    expect(resolveRef(42 as unknown as { id: number })).toBeUndefined()
  })

  it('returns undefined for null/undefined', () => {
    expect(resolveRef(null)).toBeUndefined()
    expect(resolveRef(undefined)).toBeUndefined()
  })
})

describe('pickMediaUrl', () => {
  const media: Media = {
    id: 1,
    url: '/orig.jpg',
    alt: 'a',
    sizes: {
      thumbnail: { url: '/thumb.jpg' },
      card: { url: '/card.jpg' },
    },
  }

  it('returns the preferred size URL when available', () => {
    expect(pickMediaUrl(media, 'card')).toBe('/card.jpg')
    expect(pickMediaUrl(media, 'thumbnail')).toBe('/thumb.jpg')
  })

  it('falls back to the original URL when the size is missing', () => {
    expect(pickMediaUrl(media, 'hero')).toBe('/orig.jpg')
  })

  it('returns empty string for null media', () => {
    expect(pickMediaUrl(null)).toBe('')
    expect(pickMediaUrl(undefined)).toBe('')
  })
})
