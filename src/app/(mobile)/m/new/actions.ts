'use server'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { ArticleStatus } from '@/domain/enums'
import { canPlaceHero, effectiveStatus } from '@/lib/editorial-roles'
import { applyHeroPlacement, isHeroPlacement, type HeroPlacement } from '@/lib/hero-placement'
import { plainTextToLexical } from '@/lib/lexical-paragraphs'
import { logger } from '@/lib/logger'
import { getPayloadClient } from '@/lib/payload'

export type Placement = HeroPlacement

export interface CreateState {
  error?: string
  fieldErrors?: Partial<Record<'title' | 'excerpt' | 'body' | 'category' | 'image', string>>
}

function friendlyError(err: unknown): string {
  if (!(err instanceof Error)) return 'حدث خطأ غير متوقع. حاول مجدداً.'
  const msg = err.message || ''
  if (/body exceeded/i.test(msg)) return 'حجم الصورة كبير جداً. اختر صورة أصغر من ٣٠ ميغابايت.'
  if (/connect.*ECONNREFUSED/i.test(msg) || /cannot connect to postgres/i.test(msg)) {
    return 'تعذّر الاتصال بقاعدة البيانات. حاول بعد دقيقة.'
  }
  if (/duplicate key|unique/i.test(msg)) return 'هناك مقال آخر بنفس الرابط. غيّر العنوان قليلاً.'
  if (/not authorized|access denied/i.test(msg)) {
    return 'حسابك لا يملك صلاحية النشر. تواصل مع المدير.'
  }
  if (/invalid|validation/i.test(msg)) return 'بعض الحقول غير صالحة. راجع البيانات وحاول مجدداً.'
  return `تعذّر النشر: ${msg.slice(0, 140)}`
}

export async function createArticleAction(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const title = String(formData.get('title') ?? '').trim()
  // The excerpt renders as one line in cards and meta tags, and textarea
  // submissions carry CRLF line breaks that also count against maxLength.
  const excerpt = String(formData.get('excerpt') ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const bodyText = String(formData.get('body') ?? '').trim()
  const categoryId = String(formData.get('category') ?? '')
  const status = String(formData.get('status') ?? 'draft')
  const isBreaking = String(formData.get('isBreaking') ?? '') === 'true'
  const placement = String(formData.get('placement') ?? 'none') as Placement
  const image = formData.get('image')

  const fieldErrors: CreateState['fieldErrors'] = {}
  if (!title) fieldErrors.title = 'العنوان مطلوب'
  if (!excerpt) fieldErrors.excerpt = 'المقتطف مطلوب'
  if (!bodyText) fieldErrors.body = 'نص المقال مطلوب'
  if (!categoryId) fieldErrors.category = 'اختر تصنيفاً'
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'يوجد حقول فارغة. راجع النموذج.', fieldErrors }
  }

  const validStatuses = [
    ArticleStatus.Draft,
    ArticleStatus.Published,
    ArticleStatus.InReview,
  ] as string[]
  if (!validStatuses.includes(status)) {
    return { error: 'حالة المقال غير صالحة.' }
  }

  if (!isHeroPlacement(placement)) {
    return { error: 'موضع المقال غير صالح.' }
  }

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const auth = await payload.auth({ headers })
  if (!auth.user) return { error: 'انتهت الجلسة. سجّل الدخول مجدداً.' }

  // Authors submit for review instead of publishing (the Articles hook
  // enforces the same rule); hero curation is for editors and the admin.
  const role = (auth.user as { role?: string }).role
  const finalStatus = effectiveStatus(role, status)

  // 1) Upload image (optional)
  let mediaId: string | number | undefined
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith('image/')) {
      return { error: 'الملف المختار ليس صورة.', fieldErrors: { image: 'يجب أن تكون صورة' } }
    }
    try {
      const arrayBuf = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuf)
      const mediaDoc = await payload.create({
        collection: 'media',
        data: { alt: title.slice(0, 120) },
        file: { data: buffer, mimetype: image.type, name: image.name, size: image.size },
        user: auth.user,
        overrideAccess: false,
      })
      mediaId = mediaDoc.id
    } catch (err) {
      logger.error('mobile.article.media_upload_failed', { err, userId: auth.user.id })
      return { error: friendlyError(err), fieldErrors: { image: 'تعذّر رفع الصورة' } }
    }
  }

  // 2) Upload gallery images (optional, multiple). Each is uploaded
  //    individually; if one fails we continue with the rest so the
  //    article still gets the others.
  const galleryFiles = formData
    .getAll('gallery')
    .filter((f): f is File => f instanceof File && f.size > 0 && f.type.startsWith('image/'))

  const galleryItems: { image: string | number }[] = []
  for (const file of galleryFiles) {
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const media = await payload.create({
        collection: 'media',
        data: { alt: title.slice(0, 120) },
        file: { data: buf, mimetype: file.type, name: file.name, size: file.size },
        user: auth.user,
        overrideAccess: false,
      })
      galleryItems.push({ image: media.id })
    } catch (err) {
      logger.warn('mobile.article.gallery_upload_failed', {
        err,
        userId: auth.user.id,
        file: file.name,
      })
    }
  }

  // 3) Create article
  let createdId: string | number | undefined
  try {
    const created = await payload.create({
      collection: 'articles',
      data: {
        title,
        excerpt,
        body: plainTextToLexical(bodyText),
        category: Number(categoryId) || categoryId,
        author: auth.user.id,
        status: finalStatus,
        isBreaking,
        ...(mediaId ? { featuredImage: mediaId } : {}),
        ...(galleryItems.length > 0 ? { gallery: galleryItems } : {}),
        ...(finalStatus === ArticleStatus.Published
          ? { publishedAt: new Date().toISOString() }
          : {}),
      },
      user: auth.user,
      // The Local API skips access control unless told otherwise.
      overrideAccess: false,
    })
    createdId = created.id
  } catch (err) {
    logger.error('mobile.article.create_failed', { err, userId: auth.user.id })
    return { error: friendlyError(err) }
  }

  // 4) Apply hero placement (editors/admin only, published articles only).
  //    applyHeroPlacement elevates the write past the admin-only global, so
  //    the canPlaceHero check here is what keeps authors out.
  if (
    placement !== 'none' &&
    createdId &&
    finalStatus === ArticleStatus.Published &&
    canPlaceHero(role)
  ) {
    try {
      await applyHeroPlacement(payload, { articleId: createdId, placement, user: auth.user })
    } catch (err) {
      // Don't fail the whole publish if hero update fails — article is
      // already saved. Log and continue.
      logger.error('mobile.article.hero_placement_failed', {
        err,
        articleId: createdId,
        placement,
      })
    }
  }

  redirect('/m')
}
