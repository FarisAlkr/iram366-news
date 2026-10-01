import { describe, expect, it } from 'vitest'

import {
  normalizeLexicalParagraphs,
  plainTextToLexical,
  splitParagraphOnNewlines,
  type LexicalNodeLike,
} from './lexical-paragraphs'

type Node = LexicalNodeLike & Record<string, unknown>

const text = (t: string, extra: Record<string, unknown> = {}): Node => ({
  type: 'text',
  text: t,
  ...extra,
})
const para = (...children: Node[]): Node => ({
  type: 'paragraph',
  direction: 'rtl',
  children,
})
const texts = (nodes: LexicalNodeLike[]) =>
  nodes.map((p) => (p.children ?? []).map((c) => c.text ?? `<${c.type}>`).join(''))

describe('plainTextToLexical', () => {
  it('splits CRLF textarea input into paragraphs (the mobile-composer bug)', () => {
    const body = plainTextToLexical('الفقرة الأولى.\r\n\r\nالفقرة الثانية.\r\n\r\nالثالثة.')
    expect(texts(body.root.children)).toEqual(['الفقرة الأولى.', 'الفقرة الثانية.', 'الثالثة.'])
  })

  it('treats a single line break as a paragraph boundary, like Enter in the desktop editor', () => {
    const body = plainTextToLexical('سطر أول\nسطر ثانٍ\r\nسطر ثالث')
    expect(texts(body.root.children)).toEqual(['سطر أول', 'سطر ثانٍ', 'سطر ثالث'])
  })

  it('drops blank lines and trims whitespace', () => {
    const body = plainTextToLexical('  أ  \r\n   \r\n\r\n  ب ')
    expect(texts(body.root.children)).toEqual(['أ', 'ب'])
  })

  it('returns a single empty paragraph for empty input', () => {
    const body = plainTextToLexical('')
    expect(body.root.children).toHaveLength(1)
    expect(body.root.children[0]!.children).toEqual([])
  })

  it('emits rtl paragraphs with well-formed text nodes', () => {
    const p = plainTextToLexical('نص').root.children[0]!
    expect(p.type).toBe('paragraph')
    expect(p.direction).toBe('rtl')
    expect(p.children[0]).toMatchObject({ type: 'text', text: 'نص', format: 0, mode: 'normal' })
  })
})

describe('splitParagraphOnNewlines', () => {
  it('returns the same object when there is nothing to split', () => {
    const p = para(text('فقرة عادية'))
    expect(splitParagraphOnNewlines(p)).toEqual([p])
    expect(splitParagraphOnNewlines(p)[0]).toBe(p)
  })

  it('splits a legacy CRLF-joined paragraph into one paragraph per line', () => {
    const p = para(text('أ\r\n\r\nب\r\n\r\nج'))
    expect(texts(splitParagraphOnNewlines(p))).toEqual(['أ', 'ب', 'ج'])
  })

  it('keeps formatting and non-text inline nodes in the right paragraph', () => {
    const link: Node = { type: 'link', children: [text('رابط')] }
    const p = para(text('عريض\n', { format: 1 }), text('تابع '), link)
    const parts = splitParagraphOnNewlines(p)
    expect(parts).toHaveLength(2)
    expect(parts[0]!.children).toEqual([text('عريض', { format: 1 })])
    expect(parts[1]!.children).toEqual([text('تابع '), link])
  })

  it('preserves paragraph-level attributes on every split part', () => {
    const p = { ...para(text('أ\nب')), format: 'center', indent: 1 }
    for (const part of splitParagraphOnNewlines(p)) {
      expect(part).toMatchObject({ type: 'paragraph', format: 'center', indent: 1 })
    }
  })

  it('drops paragraphs that would only contain whitespace', () => {
    expect(splitParagraphOnNewlines(para(text('\r\n  \r\n')))).toEqual([])
  })
})

describe('normalizeLexicalParagraphs', () => {
  it('returns the input untouched for clean editor content', () => {
    const body = { root: { type: 'root', children: [para(text('أ')), para(text('ب'))] } }
    expect(normalizeLexicalParagraphs(body)).toBe(body)
  })

  it('expands legacy paragraphs and leaves headings alone', () => {
    const heading: Node = { type: 'heading', tag: 'h2', children: [text('عنوان')] }
    const body = { root: { type: 'root', children: [heading, para(text('أ\r\n\r\nب'))] } }
    const out = normalizeLexicalParagraphs(body)
    expect(out).not.toBe(body)
    expect(out.root.children[0]).toBe(heading)
    expect(texts(out.root.children.slice(1))).toEqual(['أ', 'ب'])
  })

  it('ignores non-Lexical values', () => {
    expect(normalizeLexicalParagraphs(null)).toBeNull()
    expect(normalizeLexicalParagraphs('plain')).toBe('plain')
    expect(normalizeLexicalParagraphs({ foo: 1 })).toEqual({ foo: 1 })
  })
})
