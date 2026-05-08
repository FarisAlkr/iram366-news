import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { isChatbotEnabled } from '@/lib/chatbot/config'
import { embedText, vectorLiteral } from '@/lib/chatbot/embeddings'
import { getChatbotPool } from '@/lib/chatbot/db'
import { extractText } from '@/lib/article-stats'

interface ArticleLite {
  id: number | string
  title?: string
  excerpt?: string
  body?: unknown
  status?: string
  deletedAt?: string | null
}

/**
 * On article publish/update: embed (title + excerpt + body) and upsert
 * into article_embeddings. Silent no-op when the chatbot feature flag
 * is off, so the field doesn't slow down editorial work until activated.
 */
export const embedArticleAfterChange: CollectionAfterChangeHook = async ({ doc }) => {
  if (!isChatbotEnabled()) return doc
  const a = doc as ArticleLite
  // Only published, non-deleted articles are searchable
  if (a.status !== 'published' || a.deletedAt) {
    // If the article was previously embedded, drop it so it can't surface
    try {
      const pool = getChatbotPool()
      await pool.query('DELETE FROM article_embeddings WHERE article_id = $1', [a.id])
    } catch {
      // Embedding table may not exist yet (setup not run) — ignore
    }
    return doc
  }

  try {
    const text = [a.title ?? '', a.excerpt ?? '', extractText(a.body)]
      .filter(Boolean)
      .join('\n\n')
    if (!text.trim()) return doc

    const embedding = await embedText(text, 'document')
    const lit = vectorLiteral(embedding)

    const pool = getChatbotPool()
    await pool.query(
      `INSERT INTO article_embeddings (article_id, embedding, updated_at)
       VALUES ($1, $2::vector, NOW())
       ON CONFLICT (article_id)
       DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
      [a.id, lit],
    )
  } catch (err) {
    // Don't fail the publish if embedding fails — log and move on
    console.error('[chatbot] embed-article-after-change failed:', err)
  }
  return doc
}

export const embedArticleAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  if (!isChatbotEnabled()) return
  const a = doc as ArticleLite
  try {
    const pool = getChatbotPool()
    await pool.query('DELETE FROM article_embeddings WHERE article_id = $1', [a.id])
  } catch {
    // Table may not exist yet — ignore
  }
}
