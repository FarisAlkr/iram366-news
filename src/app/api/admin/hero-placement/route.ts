import { NextResponse, type NextRequest } from 'next/server'
import { headers as getHeaders } from 'next/headers'

import { getPayloadClient } from '@/lib/payload'
import { logger } from '@/lib/logger'
import { UserRole, HeroMode } from '@/domain/enums'

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
 *   3. updateGlobal('site-settings', …, overrideAccess: true) — bypasses
 *      the global's admin-only update access. Safe because the endpoint
 *      only ever writes the `homepageHero` field; nothing else.
 *
 * Body shape:
 *   { articleId: string | number, placement: 'main' | 'secondary-1' |
 *     'secondary-2' | 'secondary-3' | 'none' }
 */

type Placement = 'main' | 'secondary-1' | 'secondary-2' | 'secondary-3' | 'none'

const PLACEMENTS: ReadonlyArray<Placement> = [
  'main',
  'secondary-1',
  'secondary-2',
  'secondary-3',
  'none',
]

interface HeroSettings {
  mode?: string
  mainArticle?: { id: string | number } | string | number | null
  secondaryArticles?: Array<{ id: string | number } | string | number> | null
}

const refId = (ref: HeroSettings['mainArticle']): string | number | null => {
  if (ref == null) return null
  if (typeof ref === 'object') return ref.id
  return ref
}

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
  if (typeof placement !== 'string' || !PLACEMENTS.includes(placement as Placement)) {
    return NextResponse.json({ error: 'invalid placement' }, { status: 400 })
  }
  const target = placement as Placement

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const auth = await payload.auth({ headers })
  if (!auth.user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  }

  const role = (auth.user as { role?: string }).role
  if (role !== UserRole.Admin && role !== UserRole.Editor) {
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

  // Pull current hero, merge the requested placement, write back. Same
  // shape the picker used to compose client-side; centralized here so
  // the merge logic isn't duplicated across UIs.
  let current: HeroSettings
  try {
    const settings = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
    })) as { homepageHero?: HeroSettings }
    current = settings.homepageHero ?? {}
  } catch (err) {
    logger.error('hero-placement.read.failed', { err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'تعذّر قراءة إعدادات الصفحة' }, { status: 500 })
  }

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

  if (target === 'main') {
    newHero.mainArticle = articleId
    newHero.secondaryArticles = newHero.secondaryArticles.filter((x) => x !== articleId)
  } else if (target.startsWith('secondary-')) {
    const slot = Number(target.split('-')[1]) - 1
    const arr = newHero.secondaryArticles.filter((x) => x !== articleId)
    // Pad up to slot index with the article's own id as a sentinel
    // (we'd never have collisions with real article ids here because
    // we filtered it out above); then overwrite at slot.
    while (arr.length <= slot) arr.push(0)
    arr[slot] = articleId
    newHero.secondaryArticles = arr.filter((x) => x !== 0)
    if (newHero.mainArticle === articleId) newHero.mainArticle = null
  } else {
    // 'none' — remove from any slot
    if (newHero.mainArticle === articleId) newHero.mainArticle = null
    newHero.secondaryArticles = newHero.secondaryArticles.filter((x) => x !== articleId)
  }

  try {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { homepageHero: newHero },
      overrideAccess: true,
      user: auth.user,
    })
  } catch (err) {
    logger.error('hero-placement.write.failed', { err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'فشل الحفظ — حاول لاحقاً' }, { status: 500 })
  }

  return NextResponse.json({ success: true, homepageHero: newHero })
}
