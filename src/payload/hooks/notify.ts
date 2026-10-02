import type { CollectionAfterChangeHook } from 'payload'

import { logger } from '../../lib/logger.ts'

interface ArticleLite {
  id: number | string
  title?: string
  status?: string
  author?: number | string | { id: number | string }
}

interface ReviewLite {
  id: number | string
  article?: number | string | { id: number | string }
  reviewer?: number | string | { id: number | string }
  summary?: string
  content?: string
}

function refId(v: unknown): number | string | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'number' || typeof v === 'string') return v
  if (typeof v === 'object' && 'id' in v) return (v as { id: number | string }).id
  return undefined
}

/**
 * Article afterChange hook — emits notifications when:
 *   - an article enters "in-review" — created that way (e.g. an author
 *     submitting from /m/new) or moved there from draft / published
 *     (an author's edit to a live article sends it back for review)
 *     → every editor and the admin
 *   - status flips from "in-review" → "published"  (notify author: yours is live)
 *   - status flips from "in-review" → "draft"      (notify author: needs work)
 *
 * Idempotent: only triggers on the transition, not on re-saves of the same
 * status. Nobody is notified about their own action. Failures are logged,
 * never thrown — notifications are best-effort.
 *
 * Every nested call passes `req` so it runs inside the save's transaction.
 * Without it the insert used a second connection that couldn't see a newly
 * created article (FK violation) and blocked on the row lock of an updated
 * one until statement_timeout — a 30 s hang on every approval.
 */
export const notifyOnArticleStatusChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (operation !== 'create' && operation !== 'update') return doc

  const after = (doc || {}) as ArticleLite
  const beforeStatus =
    operation === 'create' ? undefined : ((previousDoc || {}) as ArticleLite).status
  if (beforeStatus === after.status) return doc

  const title = after.title || 'بلا عنوان'
  const actorId = req.user?.id
  const isActor = (id: number | string) => actorId != null && String(actorId) === String(id)

  let recipients: Array<number | string> = []
  let type: string
  let message: string
  let notificationTitle: string

  if (after.status === 'in-review') {
    type = 'article.in-review'
    notificationTitle = `مقال بانتظار المراجعة: «${title}»`
    message =
      beforeStatus === 'published'
        ? 'عُدّل مقال منشور وأُعيد للمراجعة — لن يظهر للقراء حتى تتم الموافقة عليه.'
        : 'أرسل الكاتب المقال للمراجعة. افتحه واتخذ قراراً.'
    try {
      const staff = await req.payload.find({
        collection: 'users',
        where: { role: { in: ['admin', 'editor'] } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
        req,
      })
      recipients = staff.docs.map((u) => (u as { id: number | string }).id)
    } catch (err) {
      logger.error('notify.find_editors_failed', { err, articleId: after.id })
      return doc
    }
  } else if (beforeStatus === 'in-review' && after.status === 'published') {
    type = 'article.published'
    notificationTitle = `تم نشر مقالك «${title}»`
    message = 'وافق المحرر على المقال وأصبح منشوراً للقراء.'
    const authorId = refId(after.author)
    if (authorId) recipients = [authorId]
  } else if (beforeStatus === 'in-review' && after.status === 'draft') {
    type = 'article.rejected'
    notificationTitle = `أُعيد مقالك «${title}» للمسودات`
    message = 'يحتاج المقال إلى تعديلات قبل النشر. راجع تعليقات المحرر.'
    const authorId = refId(after.author)
    if (authorId) recipients = [authorId]
  } else {
    return doc
  }

  const results = await Promise.allSettled(
    recipients
      .filter((id) => !isActor(id))
      .map((recipient) =>
        req.payload.create({
          collection: 'notifications',
          data: {
            recipient,
            type,
            title: notificationTitle,
            message,
            link: `/admin/collections/articles/${after.id}`,
            relatedArticle: after.id,
          },
          overrideAccess: true,
          req,
        }),
      ),
  )
  for (const r of results) {
    if (r.status === 'rejected') {
      logger.error('notify.create_failed', { err: r.reason, articleId: after.id, type })
    }
  }

  return doc
}

/**
 * ArticleReviews afterChange — notify the article's author whenever a new
 * review is created.
 */
export const notifyOnReviewCreated: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (operation !== 'create') return doc

  const review = (doc || {}) as ReviewLite
  const articleId = refId(review.article)
  if (!articleId) return doc

  try {
    const article = await req.payload.findByID({
      collection: 'articles',
      id: articleId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const authorId = refId((article as ArticleLite).author)
    if (!authorId) return doc

    // Don't notify the reviewer about their own review
    const reviewerId = refId(review.reviewer)
    if (reviewerId && reviewerId === authorId) return doc

    await req.payload.create({
      collection: 'notifications',
      data: {
        recipient: authorId,
        type: 'review.created',
        title: `تعليق جديد على مقالك: «${(article as ArticleLite).title || 'بلا عنوان'}»`,
        message: review.summary || 'فتح المحرر تعليقاً يحتاج إلى مراجعتك.',
        link: `/admin/collections/articles/${articleId}`,
        relatedArticle: articleId,
      },
      overrideAccess: true,
      req,
    })
  } catch (err) {
    logger.error('notify.review_create_failed', {
      err,
      reviewId: review.id,
    })
  }

  return doc
}
