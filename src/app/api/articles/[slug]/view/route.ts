import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

import { getPayloadClient } from '@/lib/payload'
import { getChatbotPool } from '@/lib/chatbot/db'
import { logger } from '@/lib/logger'
import { RateLimits, enforce } from '@/lib/rate-limit'
import { isValidSlug } from '@/lib/slug'

const VIEW_COOKIE_TTL_SEC = 60 * 60 // 1 hour

interface ViewUpdateRow {
  id: number | string
  category_id: number | string | null
}

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

  // Atomic increment via raw SQL, deliberately bypassing payload.update().
  // Routing the counter through Payload's collection hooks meant every page
  // view fired afterChange — auditAfterChange (one audit-log row per view),
  // notifyOnArticleStatusChange, and embedArticleAfterChange (re-runs the
  // paid OpenAI/Voyage embedding API call for the same unchanged content).
  // Doing the UPDATE here keeps the counter atomic (no lost-update race) and
  // skips the hook chain entirely.
  const pool = getChatbotPool()
  let row: ViewUpdateRow | undefined
  try {
    const result = await pool.query<ViewUpdateRow>(
      `UPDATE articles
         SET views = COALESCE(views, 0) + 1
       WHERE slug = $1
         AND status = 'published'
         AND deleted_at IS NULL
       RETURNING id, category_id`,
      [slug],
    )
    row = result.rows[0]
  } catch (err) {
    logger.error('article.view.update_failed', { err, slug })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  if (!row) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  // Page-views timeseries insert stays best-effort. PageViews is in the
  // audit-log SKIP_COLLECTIONS list, so this write doesn't fan out.
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'page-views',
      data: {
        article: row.id,
        date: new Date().toISOString(),
        category: row.category_id ?? undefined,
      } as never,
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
