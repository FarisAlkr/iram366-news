import { describe, expect, it } from 'vitest'

import { computeStats, countWords, extractText } from './article-stats'

describe('extractText', () => {
  it('returns empty string for null/undefined/non-objects', () => {
    expect(extractText(null)).toBe('')
    expect(extractText(undefined)).toBe('')
    expect(extractText('hello')).toBe('')
    expect(extractText(42)).toBe('')
  })

  it('extracts text from a flat node', () => {
    expect(extractText({ type: 'text', text: 'مرحبا' })).toBe('مرحبا')
  })

  it('walks nested children and joins with spaces', () => {
    const tree = {
      root: {
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'hello' }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'world' }] },
        ],
      },
    }
    expect(extractText(tree)).toBe('hello world')
  })

  it('accepts a bare subtree without a root wrapper', () => {
    expect(
      extractText({
        children: [{ type: 'text', text: 'foo' }, { type: 'text', text: 'bar' }],
      }),
    ).toBe('foo bar')
  })
})

describe('countWords', () => {
  it('returns 0 for empty input', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords('!!! ... ,,,')).toBe(0)
  })

  it('counts Latin words', () => {
    expect(countWords('hello world')).toBe(2)
  })

  it('counts Arabic words', () => {
    expect(countWords('مرحبا بكم في موقعنا')).toBe(4)
  })

  it('counts digits as words', () => {
    expect(countWords('سنة 2026 تبدأ غداً')).toBe(4)
  })

  it('treats punctuation as separators, not words', () => {
    expect(countWords('hello, world!')).toBe(2)
    expect(countWords('مرحبا، بكم.')).toBe(2)
  })
})

describe('computeStats', () => {
  it('returns zeroes for empty content', () => {
    expect(computeStats(null)).toEqual({ words: 0, characters: 0, readingMinutes: 0 })
    expect(computeStats({ root: { children: [] } })).toEqual({
      words: 0,
      characters: 0,
      readingMinutes: 0,
    })
  })

  it('computes reading time at ~180 wpm Arabic, rounded up, min 1', () => {
    // 90 words → ceil(90/180)=1 minute
    const ninety = Array.from({ length: 90 }, () => 'كلمة').join(' ')
    const tree = { root: { children: [{ type: 'text', text: ninety }] } }
    const stats = computeStats(tree)
    expect(stats.words).toBe(90)
    expect(stats.readingMinutes).toBe(1)
  })

  it('rounds up partial minutes', () => {
    // 200 words → ceil(200/180)=2 minutes
    const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')
    const tree = { root: { children: [{ type: 'text', text }] } }
    expect(computeStats(tree).readingMinutes).toBe(2)
  })
})
