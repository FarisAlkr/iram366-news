import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { estimateReadTime, formatDate, relativeTime } from './date'

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-26T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a string for past timestamps', () => {
    const out = relativeTime(new Date('2026-04-26T11:00:00Z'))
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns a string for future timestamps', () => {
    const out = relativeTime(new Date('2026-04-26T13:00:00Z'))
    expect(out.length).toBeGreaterThan(0)
  })

  it('handles ISO strings', () => {
    const out = relativeTime('2026-04-26T11:00:00Z')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('formatDate', () => {
  it('renders an Arabic-locale date', () => {
    const out = formatDate('2026-04-26T00:00:00Z')
    expect(out).toBeTypeOf('string')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('estimateReadTime', () => {
  it('floors at 1 minute even for short text', () => {
    expect(estimateReadTime('hello world')).toBe(1)
  })

  it('approximates 200 wpm', () => {
    const text = Array.from({ length: 600 }, () => 'كلمة').join(' ')
    expect(estimateReadTime(text)).toBe(3)
  })
})
