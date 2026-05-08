import { describe, expect, it } from 'vitest'

import { ensureSlug, isValidSlug, normalizeArabic, slugify, transliterate } from './slug'

describe('transliterate', () => {
  it('returns empty string on empty input', () => {
    expect(transliterate('')).toBe('')
  })

  it('lowercases Latin text without changing letters', () => {
    expect(transliterate('Hello World 2026')).toBe('hello world 2026')
  })

  it('maps Arabic letters to Latin equivalents', () => {
    expect(transliterate('بلدية')).toBe('bldyh')
    expect(transliterate('رهط')).toBe('rht')
  })

  it('handles multi-letter combos (sh, kh, th, dh, gh)', () => {
    expect(transliterate('الشباب')).toBe('alshbab')
    expect(transliterate('خبر')).toBe('khbr')
    expect(transliterate('ثقافة')).toBe('thqafh')
    expect(transliterate('غزة')).toBe('ghzh')
  })

  it('strips diacritics', () => {
    expect(transliterate('مُحَمَّد')).toBe('mhmd')
  })

  it('converts Eastern Arabic numerals to ASCII digits', () => {
    expect(transliterate('سنة ٢٠٢٦')).toBe('snh 2026')
  })

  it('drops hamza variants', () => {
    expect(transliterate('سؤال')).toBe('sal')
    expect(transliterate('شيء')).toBe('shy')
  })

  it('handles mixed Arabic + Latin', () => {
    expect(transliterate('Rahat رهط 2026')).toBe('rahat rht 2026')
  })
})

describe('slugify', () => {
  it('produces a Latin slug from an Arabic title', () => {
    expect(slugify('بلدية رهط')).toBe('bldyh-rht')
  })

  it('produces a Latin slug from a longer Arabic title', () => {
    expect(slugify('افتتاح مشروع جديد لدعم الشباب')).toBe('afttah-mshrwa-jdyd-ldam-alshbab')
  })

  it('keeps Latin titles intact (just lowercased + hyphenated)', () => {
    expect(slugify('Hello World 2026')).toBe('hello-world-2026')
  })

  it('strips punctuation and emoji', () => {
    expect(slugify('Hello, world! 🎉')).toBe('hello-world')
  })

  it('collapses whitespace', () => {
    expect(slugify('  hello   world  ')).toBe('hello-world')
  })

  it('caps length at 80 characters', () => {
    const long = 'a'.repeat(120)
    expect(slugify(long).length).toBeLessThanOrEqual(80)
  })

  it('returns empty string on empty input', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
  })

  it('handles mixed-script titles', () => {
    expect(slugify('Rahat رهط 2026')).toBe('rahat-rht-2026')
  })
})

describe('ensureSlug', () => {
  it('returns the slug when valid', () => {
    expect(ensureSlug('hello world')).toBe('hello-world')
  })

  it('returns a Latin slug from an Arabic title', () => {
    expect(ensureSlug('رهط')).toBe('rht')
  })

  it('falls back to a timestamp suffix on empty input', () => {
    const fallback = ensureSlug('   ')
    expect(fallback).toMatch(/^article-\d+$/)
  })
})

describe('isValidSlug', () => {
  it('accepts Latin slugs', () => {
    expect(isValidSlug('hello-world')).toBe(true)
    expect(isValidSlug('rahat-news-2026')).toBe(true)
  })

  it('rejects Arabic slugs (we now require Latin)', () => {
    expect(isValidSlug('افتتاح-مشروع')).toBe(false)
  })

  it('rejects path traversal attempts', () => {
    expect(isValidSlug('../etc/passwd')).toBe(false)
    expect(isValidSlug('hello/world')).toBe(false)
    expect(isValidSlug('hello world')).toBe(false)
  })

  it('rejects uppercase / underscores', () => {
    expect(isValidSlug('Hello-World')).toBe(false)
    expect(isValidSlug('hello_world')).toBe(false)
  })

  it('rejects empty and over-length input', () => {
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('a'.repeat(81))).toBe(false)
  })
})

describe('normalizeArabic', () => {
  it('strips diacritics', () => {
    expect(normalizeArabic('مُحَمَّد')).toBe('محمد')
  })

  it('unifies alif variants', () => {
    expect(normalizeArabic('إيمان')).toBe('ايمان')
    expect(normalizeArabic('أحمد')).toBe('احمد')
    expect(normalizeArabic('آدم')).toBe('ادم')
  })

  it('unifies yaa and taa-marbuta', () => {
    expect(normalizeArabic('على')).toBe('علي')
    expect(normalizeArabic('مدرسة')).toBe('مدرسه')
  })

  it('lowercases latin text', () => {
    expect(normalizeArabic('Hello')).toBe('hello')
  })
})
