/**
 * Pure helpers for live article metrics in the admin editor.
 *
 * Lexical's serialized state is a tree of nodes; only text leaves carry the
 * actual prose. We walk the tree, concatenate text, and derive word count and
 * estimated reading time. Numbers tuned for Arabic news prose (~180 wpm).
 */

export interface ArticleStats {
  words: number
  characters: number
  /** Estimated reading time, rounded up to whole minutes (min 1). */
  readingMinutes: number
}

const ARABIC_WPM = 180

interface LexicalLike {
  type?: string
  text?: string
  children?: LexicalLike[]
}

/**
 * Recursively pull every text fragment out of a Lexical-like tree.
 * Accepts the value Payload stores ({ root: { children: [...] } }) or a bare
 * subtree (for tests).
 */
export function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''

  const n = node as LexicalLike & { root?: LexicalLike }
  if (n.root) return extractText(n.root)

  let out = ''
  if (typeof n.text === 'string') out += n.text
  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      const piece = extractText(child)
      if (piece) out += (out && !out.endsWith(' ') ? ' ' : '') + piece
    }
  }
  return out
}

/**
 * Counts whitespace-separated word tokens. Treats sequences of Arabic letters,
 * Latin letters, or digits as words; ignores punctuation-only fragments.
 */
export function countWords(text: string): number {
  if (!text) return 0
  const matches = text.match(/[\p{L}\p{N}]+/gu)
  return matches ? matches.length : 0
}

export function computeStats(content: unknown): ArticleStats {
  const text = extractText(content).trim()
  const words = countWords(text)
  const characters = text.length
  const readingMinutes = words > 0 ? Math.max(1, Math.ceil(words / ARABIC_WPM)) : 0
  return { words, characters, readingMinutes }
}
