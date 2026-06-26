import { APIError, type CollectionBeforeDeleteHook } from 'payload'

import { logger } from '../../lib/logger.ts'

/**
 * Articles are FK-referenced from `page-views` (required), `article-reviews`
 * (required), `notifications.relatedArticle` (optional), and the
 * `site-settings.homepageHero` global. Postgres raises 23503 the first time
 * an editor tries to delete a published article — every public view writes
 * a `page-views` row, so any non-zero-views article hits the constraint.
 *
 * Strategy:
 *   - Refuse if any `article-reviews` exist. Reviews are editorial workflow
 *     state and are not audit-logged, so a silent cascade would erase
 *     conversation history. Surface a friendly Arabic error pointing the
 *     editor at the right place to clear them.
 *   - Clear `homepageHero.mainArticle` and remove from `secondaryArticles`
 *     when this article is currently slotted there; otherwise the homepage
 *     renders a broken/empty hero card.
 *   - Delete dependent `page-views` (anonymous telemetry — safe to drop).
 *   - NULL `notifications.relatedArticle` so the user's inbox row survives
 *     but no longer links to a vanished article.
 *
 * All cleanup runs with `overrideAccess: true`: the acting user already
 * passed the collection-level delete gate (admin-only — see Articles.ts
 * `access.delete`), and we don't want a non-admin operator's narrower
 * row-level view to hide rows that need clearing on their behalf.
 *
 * `article_embeddings.article_id` is `ON DELETE CASCADE` (see
 * scripts/chatbot-setup.mjs) so no cleanup is required there.
 */
export const cleanupArticleRefsBeforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const payload = req.payload
  const articleIdStr = String(id)

  // 1) Editorial reviews — refuse with a guiding message.
  const reviewCount = await payload.count({
    collection: 'article-reviews',
    where: { article: { equals: id } },
    overrideAccess: true,
  })
  if (reviewCount.totalDocs > 0) {
    throw new APIError(
      `لا يمكن حذف هذا المقال — يحتوي على ${reviewCount.totalDocs} ملاحظة تحريرية. ` +
        'افتح "مراجعات المقالات" واحذفها أولاً، أو حوّل حالة المقال إلى "مؤرشف" بدلاً من الحذف.',
      400,
    )
  }

  // 2) Homepage hero — clear any slot pointing at this article.
  try {
    const settings = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
    })) as {
      homepageHero?: {
        mainArticle?: number | string | null
        secondaryArticles?: Array<number | string> | null
      }
    }
    const hero = settings.homepageHero ?? {}
    const mainHits = hero.mainArticle != null && String(hero.mainArticle) === articleIdStr
    const filteredSecondary = (hero.secondaryArticles ?? []).filter(
      (x) => String(x) !== articleIdStr,
    )
    const secondaryHits = filteredSecondary.length !== (hero.secondaryArticles ?? []).length
    if (mainHits || secondaryHits) {
      await payload.updateGlobal({
        slug: 'site-settings',
        data: {
          homepageHero: {
            ...hero,
            mainArticle: mainHits ? null : hero.mainArticle,
            secondaryArticles: filteredSecondary,
          },
        },
        overrideAccess: true,
      })
    }
  } catch (err) {
    logger.error('articles.before_delete.hero_clear_failed', {
      err,
      articleId: articleIdStr,
    })
    throw new APIError(
      'تعذّر إزالة المقال من شريط الهيرو على الصفحة الرئيسية. أزله يدوياً من "إعدادات الموقع" ثم حاول الحذف مجدداً.',
      500,
    )
  }

  // 3) Anonymous view rows.
  try {
    await payload.delete({
      collection: 'page-views',
      where: { article: { equals: id } },
      overrideAccess: true,
    })
  } catch (err) {
    logger.error('articles.before_delete.page_views_clear_failed', {
      err,
      articleId: articleIdStr,
    })
    throw new APIError('تعذّر حذف سجلات المشاهدات لهذا المقال. حاول مجدداً بعد قليل.', 500)
  }

  // 4) Notifications — keep the inbox row, drop the dangling reference.
  try {
    await payload.update({
      collection: 'notifications',
      where: { relatedArticle: { equals: id } },
      data: { relatedArticle: null },
      overrideAccess: true,
    })
  } catch (err) {
    logger.error('articles.before_delete.notifications_unlink_failed', {
      err,
      articleId: articleIdStr,
    })
    throw new APIError('تعذّر تحديث الإشعارات المرتبطة بهذا المقال. حاول مجدداً بعد قليل.', 500)
  }
}
