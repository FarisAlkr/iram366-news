'use server'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { ArticleStatus, HeroMode } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'

export type Placement = 'main' | 'secondary-1' | 'secondary-2' | 'secondary-3' | 'none'

export interface CreateState {
  error?: string
  fieldErrors?: Partial<Record<'title' | 'excerpt' | 'body' | 'category' | 'image', string>>
}

function plainTextToLexical(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'rtl' as const,
      children: paragraphs.length
        ? paragraphs.map((p) => ({
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            direction: 'rtl' as const,
            children: [
              {
                type: 'text',
                text: p,
                format: 0,
                style: '',
                mode: 'normal',
                detail: 0,
                version: 1,
              },
            ],
          }))
        : [
            {
              type: 'paragraph',
              format: '',
              indent: 0,
              version: 1,
              direction: 'rtl' as const,
              children: [],
            },
          ],
    },
  }
}

function refId(ref: unknown): string | number | null {
  if (ref == null) return null
  if (typeof ref === 'object' && 'id' in (ref as object)) return (ref as { id: string | number }).id
  if (typeof ref === 'string' || typeof ref === 'number') return ref
  return null
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
  const excerpt = String(formData.get('excerpt') ?? '').trim()
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

  const validPlacements: Placement[] = ['main', 'secondary-1', 'secondary-2', 'secondary-3', 'none']
  if (!validPlacements.includes(placement)) {
    return { error: 'موضع المقال غير صالح.' }
  }

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const auth = await payload.auth({ headers })
  if (!auth.user) return { error: 'انتهت الجلسة. سجّل الدخول مجدداً.' }

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
      })
      mediaId = mediaDoc.id
    } catch (err) {
      console.error('[mobile] media upload failed:', err)
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
      })
      galleryItems.push({ image: media.id })
    } catch (err) {
      console.error('[mobile] gallery upload failed for one file:', err)
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
        status,
        isBreaking,
        ...(mediaId ? { featuredImage: mediaId } : {}),
        ...(galleryItems.length > 0 ? { gallery: galleryItems } : {}),
        ...(status === ArticleStatus.Published ? { publishedAt: new Date().toISOString() } : {}),
      },
      user: auth.user,
    })
    createdId = created.id
  } catch (err) {
    console.error('[mobile] article create failed:', err)
    return { error: friendlyError(err) }
  }

  // 4) Apply hero placement (if non-default and article was published)
  if (placement !== 'none' && createdId && status === ArticleStatus.Published) {
    try {
      const settings = (await payload.findGlobal({
        slug: 'site-settings',
        depth: 0,
      })) as {
        homepageHero?: {
          mode?: string
          mainArticle?: unknown
          secondaryArticles?: unknown[]
        }
      }
      const current = settings.homepageHero ?? {}
      const newHero: {
        mode: string
        mainArticle: string | number | null
        secondaryArticles: (string | number)[]
      } = {
        mode: HeroMode.Manual,
        mainArticle: refId(current.mainArticle),
        secondaryArticles: (current.secondaryArticles ?? [])
          .map(refId)
          .filter((x): x is string | number => x != null),
      }

      if (placement === 'main') {
        newHero.mainArticle = createdId
        newHero.secondaryArticles = newHero.secondaryArticles.filter((x) => x !== createdId)
      } else if (placement.startsWith('secondary-')) {
        const slot = Number(placement.split('-')[1]) - 1
        const arr = newHero.secondaryArticles.filter((x) => x !== createdId)
        while (arr.length <= slot) arr.push(0)
        arr[slot] = createdId
        newHero.secondaryArticles = arr.filter((x) => x !== 0)
        if (newHero.mainArticle === createdId) newHero.mainArticle = null
      }

      await payload.updateGlobal({
        slug: 'site-settings',
        data: { homepageHero: newHero },
        user: auth.user,
      })
    } catch (err) {
      // Don't fail the whole publish if hero update fails — article is
      // already saved. Log and continue.
      console.error('[mobile] hero placement update failed:', err)
    }
  }

  redirect('/m')
}
