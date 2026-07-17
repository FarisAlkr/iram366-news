import type { CollectionAfterChangeHook } from 'payload'

import { logger } from '../../lib/logger.ts'
import { isPushEnabled } from '../../lib/push/config.ts'
import { getPushPool } from '../../lib/push/db.ts'
import { broadcastWebPush } from '../../lib/push/send.ts'

interface ArticleLite {
  id: number | string
  title?: string
  excerpt?: string
  slug?: string
  status?: string
  isBreaking?: boolean
  deletedAt?: string | null
  pushSentAt?: string | null
}

const MAX_BODY_LEN = 160

/**
 * Articles afterChange — send one audience push the first time an article
 * becomes published.
 *
 * Silent no-op unless the push feature flag + VAPID keys are set. Fire-and-
 * forget via setImmediate for the same reason embed-article is (see that
 * file): the fan-out hits external push services and must never block or fail
 * an editor's save, nor cascade a slow provider into hung Payload workers.
 *
 * De-duplication is atomic and hook-safe. We claim the article with a raw
 * `UPDATE ... WHERE push_sent_at IS NULL` on the push pool — NOT via
 * payload.update(), which would re-fire audit/notify/embed/revalidate/this
 * very hook (the same fanout the view-counter route bypasses). Only the save
 * whose UPDATE affects a row proceeds to broadcast, so concurrent saves or
 * re-saves can't double-send.
 */
export const pushOnArticlePublish: CollectionAfterChangeHook = async ({ doc }) => {
  if (!isPushEnabled()) return doc

  const a = (doc || {}) as ArticleLite
  // Only newly-published, non-trashed articles with a linkable slug. The
  // in-memory pushSentAt check is just a fast path; the raw UPDATE below is
  // the real guard against double-send.
  if (a.status !== 'published' || a.deletedAt || a.pushSentAt || !a.slug) return doc

  setImmediate(() => {
    void runPush(a).catch((err) => {
      logger.error('push.broadcast.failed', { err, articleId: a.id })
    })
  })

  return doc
}

async function runPush(a: ArticleLite): Promise<void> {
  const pool = getPushPool()

  // Atomic claim: only the first save to flip push_sent_at wins. A deleted or
  // unpublished-again article (state changed while we were scheduled) fails
  // the WHERE and no-ops.
  const claim = await pool.query(
    `UPDATE articles
        SET push_sent_at = NOW()
      WHERE id = $1
        AND push_sent_at IS NULL
        AND status = 'published'
        AND deleted_at IS NULL`,
    [a.id],
  )
  if (claim.rowCount !== 1) return

  const body = (a.excerpt ?? '').trim().slice(0, MAX_BODY_LEN)
  const result = await broadcastWebPush(
    {
      title: a.title?.trim() || 'إرم 366 الإخبارية',
      body: body || 'اضغط لقراءة الخبر كاملاً.',
      url: `/articles/${a.slug}`,
      icon: '/icon-192.png',
    },
    Boolean(a.isBreaking),
  )

  logger.info('push.broadcast.sent', {
    articleId: a.id,
    breaking: Boolean(a.isBreaking),
    ...result,
  })
}
