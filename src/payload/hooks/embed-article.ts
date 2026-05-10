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
 *
 * The embedText() call is now fire-and-forget via setImmediate. Two reasons:
 *
 *   1. It hits an external API (OpenAI/Voyage). Even with the new 30s
 *      timeout, we don't want every article publish to wait on it. A
 *      hung provider must NOT cascade into hung publish requests, hung
 *      Payload workers, and an exhausted DB pool — that's exactly how
 *      the May 2026 outage built up.
 *   2. The FK error we kept seeing in logs was the embedding INSERT
 *      racing against an article delete. We now guard with a WHERE EXISTS
 *      so a deleted article silently no-ops instead of throwing 23503.
 */
export const embedArticleAfterChange: CollectionAfterChangeHook = async ({ doc }) => {
  if (!isChatbotEnabled()) return doc
  const a = doc as ArticleLite

  // Unpublished/deleted: synchronously drop any existing embedding so
  // the article disappears from chatbot search immediately. This is a
  // single fast DELETE, safe to await.
  if (a.status !== 'published' || a.deletedAt) {
    try {
      const pool = getChatbotPool()
      await pool.query('DELETE FROM article_embeddings WHERE article_id = $1', [a.id])
    } catch {
      // Embedding table may not exist yet (setup not run) — ignore
    }
    return doc
  }

  // Schedule the embedding generation off the request path.
  setImmediate(() => {
    void runEmbedArticle(a).catch((err) => {
      console.error('[chatbot] embed-article-background failed:', err)
    })
  })

  return doc
}

async function runEmbedArticle(a: ArticleLite): Promise<void> {
  const text = [a.title ?? '', a.excerpt ?? '', extractText(a.body)]
    .filter(Boolean)
    .join('\n\n')
  if (!text.trim()) return

  const embedding = await embedText(text, 'document')
  const lit = vectorLiteral(embedding)

  const pool = getChatbotPool()
  // WHERE EXISTS guards against the article having been deleted while
  // the embedding API call was in flight. Without it, the FK constraint
  // raises 23503 and pollutes the logs.
  await pool.query(
    `INSERT INTO article_embeddings (article_id, embedding, updated_at)
     SELECT $1, $2::vector, NOW()
     WHERE EXISTS (SELECT 1 FROM articles WHERE id = $1)
     ON CONFLICT (article_id)
     DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
    [a.id, lit],
  )
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
