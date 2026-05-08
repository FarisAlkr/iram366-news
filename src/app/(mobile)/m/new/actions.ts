'use server'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { getPayloadClient } from '@/lib/payload'

export interface CreateState {
  error?: string
  success?: boolean
}

function plainTextToLexical(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
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
              { type: 'text', text: p, format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
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

export async function createArticleAction(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const title = String(formData.get('title') ?? '').trim()
  const excerpt = String(formData.get('excerpt') ?? '').trim()
  const bodyText = String(formData.get('body') ?? '').trim()
  const categoryId = String(formData.get('category') ?? '')
  const status = String(formData.get('status') ?? 'draft')
  const image = formData.get('image')

  if (!title || !excerpt || !bodyText || !categoryId) {
    return { error: 'العنوان والمقتطف ونص المقال والتصنيف كلها مطلوبة' }
  }
  if (status !== 'draft' && status !== 'published' && status !== 'inReview') {
    return { error: 'حالة غير صالحة' }
  }

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const auth = await payload.auth({ headers })
  if (!auth.user) return { error: 'الجلسة منتهية، الرجاء تسجيل الدخول' }

  let mediaId: string | number | undefined
  if (image instanceof File && image.size > 0) {
    try {
      const arrayBuf = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuf)
      const mediaDoc = await payload.create({
        collection: 'media',
        data: { alt: title.slice(0, 120) },
        file: {
          data: buffer,
          mimetype: image.type,
          name: image.name,
          size: image.size,
        },
        user: auth.user,
      })
      mediaId = mediaDoc.id
    } catch (err) {
      console.error('mobile.upload.failed:', err)
      return { error: 'فشل رفع الصورة، حاول لاحقاً' }
    }
  }

  try {
    await payload.create({
      collection: 'articles',
      data: {
        title,
        excerpt,
        body: plainTextToLexical(bodyText),
        category: Number(categoryId) || categoryId,
        author: auth.user.id,
        status,
        ...(mediaId ? { featuredImage: mediaId } : {}),
        ...(status === 'published' ? { publishedAt: new Date().toISOString() } : {}),
      },
      user: auth.user,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذّر النشر'
    console.error('mobile.create.failed:', err)
    return { error: msg }
  }

  redirect('/m')
}
