import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

import { ArticleStatus } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'
import { logger } from '@/lib/logger'
import { RateLimits, enforce } from '@/lib/rate-limit'
import { isValidSlug } from '@/lib/slug'

const VIEW_COOKIE_TTL_SEC = 60 * 60 // 1 hour

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = enforce(request, RateLimits.view)
  if (limited) return limited

  const { slug } = await params
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const cookieKey = `viewed_${slug}`
  if (cookieStore.get(cookieKey)) {
    return NextResponse.json({ success: true, deduplicated: true })
  }

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: {
      slug: { equals: slug },
      status: { equals: ArticleStatus.Published },
    },
    limit: 1,
    depth: 0,
  })

  const article = result.docs[0] as { id: string | number; views?: number; category?: unknown } | undefined
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  await payload.update({
    collection: 'articles',
    id: article.id,
    data: { views: (article.views ?? 0) + 1 },
  })

  // Fire-and-forget timeseries log — non-fatal but audited.
  try {
    await payload.create({
      collection: 'page-views',
      data: {
        article: article.id,
        date: new Date().toISOString(),
        category: article.category as never,
      },
    })
  } catch (err) {
    logger.warn('page_views.log_failed', { err, slug })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(cookieKey, '1', {
    maxAge: VIEW_COOKIE_TTL_SEC,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return response
}
