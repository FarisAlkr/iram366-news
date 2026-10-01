import React from 'react'

import { splitParagraphOnNewlines } from '@/lib/lexical-paragraphs'

// Simplified Lexical rich text renderer for Payload CMS
// Renders the serialized Lexical editor state to HTML

interface LexicalNode {
  type: string
  children?: LexicalNode[]
  text?: string
  format?: number
  tag?: string
  listType?: string
  url?: string
  value?: { url: string; alt?: string; caption?: string; width?: number; height?: number }
  fields?: { url?: string }
  direction?: string
  indent?: number
  version?: number
}

interface RichTextProps {
  content: unknown
}

// Stored Lexical link nodes carry an editor-supplied URL. Without an allow-list,
// `<a href="javascript:...">` planted by any user with write access executes in
// the reader's origin on click — stored XSS that bypasses CSP because the
// `javascript:` scheme runs inline.
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

// `tag` comes from stored JSON; never hand an arbitrary string to createElement.
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

function safeHref(raw: string | undefined | null): string {
  if (!raw) return '#'
  try {
    const url = new URL(raw, 'https://placeholder.invalid')
    return ALLOWED_LINK_PROTOCOLS.has(url.protocol) ? raw : '#'
  } catch {
    return '#'
  }
}

function renderNode(node: LexicalNode, index: number): React.ReactNode {
  if (!node) return null

  // Text node
  if (node.type === 'text') {
    let text: React.ReactNode = node.text || ''
    const format = node.format || 0
    if (format & 1) text = <strong key={index}>{text}</strong>
    if (format & 2) text = <em key={index}>{text}</em>
    if (format & 4) text = <s key={index}>{text}</s>
    if (format & 8) text = <u key={index}>{text}</u>
    if (format & 16) text = <code key={index}>{text}</code>
    return text
  }

  // Linebreak
  if (node.type === 'linebreak') return <br key={index} />

  // Articles published from the mobile composer before the CRLF fix store
  // the whole body as one paragraph with raw line breaks in the text.
  if (node.type === 'paragraph') {
    const parts = splitParagraphOnNewlines(node)
    if (parts.length !== 1 || parts[0] !== node) {
      return (
        <React.Fragment key={index}>
          {parts.map((part, i) => (
            <p key={i}>{part.children?.map((child, j) => renderNode(child, j))}</p>
          ))}
        </React.Fragment>
      )
    }
  }

  const children = node.children?.map((child, i) => renderNode(child, i))

  switch (node.type) {
    case 'paragraph':
      return <p key={index}>{children}</p>

    case 'heading': {
      const tag = node.tag && HEADING_TAGS.has(node.tag) ? node.tag : 'h2'
      return React.createElement(tag, { key: index }, children)
    }

    case 'list':
      if (node.listType === 'number') {
        return <ol key={index}>{children}</ol>
      }
      return <ul key={index}>{children}</ul>

    case 'listitem':
      return <li key={index}>{children}</li>

    case 'quote':
      return <blockquote key={index}>{children}</blockquote>

    case 'link':
    case 'autolink': {
      const href = safeHref(node.fields?.url || node.url)
      return (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    }

    case 'upload':
      if (node.value) {
        return (
          <figure key={index} className="my-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={node.value.url}
              alt={node.value.alt || ''}
              width={node.value.width}
              height={node.value.height}
              className="w-full rounded-lg"
            />
            {node.value.caption && (
              <figcaption className="mt-2 text-center text-sm text-gray-500">
                {node.value.caption}
              </figcaption>
            )}
          </figure>
        )
      }
      return null

    case 'root':
      return <>{children}</>

    default:
      if (children) return <div key={index}>{children}</div>
      return null
  }
}

export function RichText({ content }: RichTextProps) {
  if (!content || typeof content !== 'object') return null

  // Payload Lexical stores content as { root: { children: [...] } }.
  // Some callers (live preview, legacy data) pass the root directly.
  const c = content as { root?: { children?: LexicalNode[] }; children?: LexicalNode[] }
  const root = c.root ?? c
  if (!root.children) return null

  return <>{root.children.map((node, i) => renderNode(node, i))}</>
}
