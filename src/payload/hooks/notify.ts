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
 *   - status flips from "in-review" → "published"  (notify author: yours is live)
 *   - status flips from "in-review" → "draft"      (notify author: needs work)
 *
 * Idempotent: only triggers on the transition, not on re-saves of the same
 * status. Failures are logged, never thrown — notifications are best-effort.
 */
export const notifyOnArticleStatusChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (operation !== 'update') return doc

  const before = (previousDoc || {}) as ArticleLite
  const after = (doc || {}) as ArticleLite

  if (before.status === after.status) return doc

  const authorId = refId(after.author)
  if (!authorId) return doc

  // Don't notify the user about their own action
  const actorId = req.user?.id
  if (actorId && actorId === authorId) return doc

  const transitions: Array<{
    from: string
    to: string
    type: string
    title: string
    message: string
  }> = [
    {
      from: 'in-review',
      to: 'published',
      type: 'article.published',
      title: `تم نشر مقالك «${after.title || 'بلا عنوان'}»`,
      message: 'وافق المحرر على المقال وأصبح منشوراً للقراء.',
    },
    {
      from: 'in-review',
      to: 'draft',
      type: 'article.rejected',
      title: `أُعيد مقالك «${after.title || 'بلا عنوان'}» للمسودات`,
      message: 'يحتاج المقال إلى تعديلات قبل النشر. راجع تعليقات المحرر.',
    },
    {
      from: 'draft',
      to: 'in-review',
      type: 'article.in-review',
      title: `مقال جديد بانتظار المراجعة: «${after.title || 'بلا عنوان'}»`,
      message: 'أرسل الكاتب المقال للمراجعة. افتحه واتخذ قراراً.',
    },
  ]

  const t = transitions.find((x) => x.from === before.status && x.to === after.status)
  if (!t) return doc

  // For "in-review" notifications, the recipient is editors/admins, not the author.
  // For others, recipient is the author.
  let recipientId: number | string | undefined = authorId
  if (t.type === 'article.in-review') {
    // Find the first admin/editor (best-effort) — production should fan-out to all
    try {
      const admins = await req.payload.find({
        collection: 'users',
        where: {
          or: [{ role: { equals: 'admin' } }, { role: { equals: 'editor' } }],
        },
        limit: 1,
      })
      const adminUser = admins.docs[0] as { id?: number | string } | undefined
      recipientId = adminUser?.id
    } catch (err) {
      logger.error('notify.find_editors_failed', { err, articleId: after.id })
      return doc
    }
  }

  if (!recipientId) return doc

  try {
    await req.payload.create({
      collection: 'notifications',
      data: {
        recipient: recipientId,
        type: t.type,
        title: t.title,
        message: t.message,
        link: `/admin/collections/articles/${after.id}`,
        relatedArticle: after.id,
      },
      overrideAccess: true,
    })
  } catch (err) {
    logger.error('notify.create_failed', {
      err,
      articleId: after.id,
      type: t.type,
      recipientId,
    })
  }

  return doc
}

/**
 * ArticleReviews afterChange — notify the article's author whenever a new
 * review is created.
 */
export const notifyOnReviewCreated: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
}) => {
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
    })
  } catch (err) {
    logger.error('notify.review_create_failed', {
      err,
      reviewId: review.id,
    })
  }

  return doc
}
