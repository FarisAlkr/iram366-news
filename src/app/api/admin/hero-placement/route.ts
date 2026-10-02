import { NextResponse, type NextRequest } from 'next/server'
import { headers as getHeaders } from 'next/headers'

import { canPlaceHero } from '@/lib/editorial-roles'
import { applyHeroPlacement, isHeroPlacement } from '@/lib/hero-placement'
import { getPayloadClient } from '@/lib/payload'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * POST /api/admin/hero-placement
 *
 * Sets the homepage placement (Main / Secondary 1-3 / None) for one
 * article. Exists so editors can use the per-article placement picker
 * without being granted full update access on the `site-settings`
 * global — which is locked to role `admin` in SiteSettings.ts and
 * shouldn't be loosened (admins control the site name, logo, footer
 * text, etc.; editors don't need any of that).
 *
 * Auth flow:
 *   1. payload.auth({ headers }) → resolve the user from cookies
 *   2. role must be Admin or Editor (Authors are excluded — they write
 *      their own articles but don't curate the homepage)
 *   3. applyHeroPlacement (src/lib/hero-placement.ts) writes only the
 *      `homepageHero` field with overrideAccess.
 *
 * Body shape:
 *   { articleId: string | number, placement: 'main' | 'secondary-1' |
 *     'secondary-2' | 'secondary-3' | 'none' }
 */
export async function POST(req: NextRequest) {
  let body: { articleId?: unknown; placement?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { articleId, placement } = body
  if (typeof articleId !== 'string' && typeof articleId !== 'number') {
    return NextResponse.json({ error: 'articleId required' }, { status: 400 })
  }
  if (!isHeroPlacement(placement)) {
    return NextResponse.json({ error: 'invalid placement' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const auth = await payload.auth({ headers })
  if (!auth.user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  }

  if (!canPlaceHero((auth.user as { role?: string }).role)) {
    return NextResponse.json(
      { error: 'هذه الصلاحية متاحة للمحررين والإداريين فقط' },
      { status: 403 },
    )
  }

  // Sanity-check: the article must actually exist. Don't allow placement
  // updates that reference a deleted / invalid ID. Use `overrideAccess`
  // so an Editor reading an Author-owned draft article won't bounce.
  try {
    await payload.findByID({
      collection: 'articles',
      id: articleId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return NextResponse.json({ error: 'المقال غير موجود' }, { status: 404 })
  }

  try {
    const homepageHero = await applyHeroPlacement(payload, {
      articleId,
      placement,
      user: auth.user,
    })
    return NextResponse.json({ success: true, homepageHero })
  } catch (err) {
    logger.error('hero-placement.write.failed', { err, articleId, placement })
    return NextResponse.json({ error: 'فشل الحفظ — حاول لاحقاً' }, { status: 500 })
  }
}
