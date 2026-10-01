/**
 * Paragraph handling for article bodies that originate as plain text.
 *
 * The mobile composer (/m/new) collects the body from a <textarea>. Browsers
 * submit textarea line breaks as CRLF ("\r\n"), and the original converter
 * split paragraphs on /\n{2,}/ — which never matches "\r\n\r\n". Every
 * phone-published article was therefore stored as ONE Lexical paragraph whose
 * text carried raw "\r\n" characters, and HTML collapses those to spaces: the
 * whole story rendered as a single wall of text.
 *
 * Lexical itself never puts newline characters inside a text node (it uses
 * paragraph / linebreak nodes), so any newline found in a text node is legacy
 * plain-text input. Every line break is treated as a paragraph boundary —
 * the same thing pressing Enter does in the desktop editor.
 */

export interface LexicalNodeLike {
  type?: string
  text?: string
  children?: LexicalNodeLike[]
}

const NEWLINE = /[\r\n]/
const NEWLINE_RUN = /(?:\r\n|\r|\n)+/

function isText<N extends LexicalNodeLike>(node: N): node is N & { text: string } {
  return node.type === 'text' && typeof node.text === 'string'
}

function trimEdges<N extends LexicalNodeLike>(nodes: N[]): N[] {
  const out = [...nodes]
  const first = out[0]
  if (first && isText(first)) out[0] = { ...first, text: first.text.replace(/^\s+/, '') }
  const lastIndex = out.length - 1
  const last = out[lastIndex]
  if (last && isText(last)) out[lastIndex] = { ...last, text: last.text.replace(/\s+$/, '') }
  return out.filter((n) => !isText(n) || n.text !== '')
}

/**
 * Split a paragraph node whose text children contain newline characters into
 * one paragraph per line. Paragraphs without embedded newlines are returned
 * untouched (same object), so editor-authored content is never rewritten.
 */
export function splitParagraphOnNewlines<N extends LexicalNodeLike>(paragraph: N): N[] {
  const children = paragraph.children ?? []
  if (!children.some((c) => isText(c) && NEWLINE.test(c.text))) return [paragraph]

  const groups: LexicalNodeLike[][] = [[]]
  for (const child of children) {
    if (!isText(child) || !NEWLINE.test(child.text)) {
      groups[groups.length - 1]!.push(child)
      continue
    }
    child.text.split(NEWLINE_RUN).forEach((piece, i) => {
      if (i > 0) groups.push([])
      if (piece) groups[groups.length - 1]!.push({ ...child, text: piece })
    })
  }

  return groups
    .map((group) => trimEdges(group))
    .filter((group) => group.length > 0)
    .map((group) => ({ ...paragraph, children: group }) as N)
}

/**
 * Normalize a stored Lexical value (`{ root: { children } }`) so legacy
 * newline-joined paragraphs become real paragraphs. Returns the input
 * unchanged when there is nothing to fix.
 */
export function normalizeLexicalParagraphs<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  const root = (value as { root?: LexicalNodeLike }).root
  if (!root || !Array.isArray(root.children)) return value

  let changed = false
  const children = root.children.flatMap((node) => {
    if (node.type !== 'paragraph') return [node]
    const parts = splitParagraphOnNewlines(node)
    if (parts.length !== 1 || parts[0] !== node) changed = true
    return parts
  })
  if (!changed) return value
  return { ...value, root: { ...root, children } } as T
}

function textParagraph(text: string) {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    direction: 'rtl' as const,
    textFormat: 0,
    children: text
      ? [
          {
            type: 'text',
            text,
            format: 0,
            style: '',
            mode: 'normal',
            detail: 0,
            version: 1,
          },
        ]
      : [],
  }
}

/** Convert plain text (e.g. a textarea value) into a Lexical root, one paragraph per line. */
export function plainTextToLexical(text: string) {
  const lines = text
    .split(NEWLINE_RUN)
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'rtl' as const,
      children: lines.length ? lines.map(textParagraph) : [textParagraph('')],
    },
  }
}
