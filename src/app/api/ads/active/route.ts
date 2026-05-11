import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/payload'
import { logger } from '@/lib/logger'
import { RateLimits, enforce } from '@/lib/rate-limit'

const VALID_PLACEMENTS = new Set([
  'header-banner',
  'sidebar-top',
  'sidebar-bottom',
  'between-articles',
  'article-inline',
  'article-end',
  'footer',
])

interface MediaLike {
  id: number | string
  url?: string
  alt?: string
  mimeType?: string
  sizes?: {
    thumbnail?: { url?: string }
    card?: { url?: string }
    hero?: { url?: string }
    full?: { url?: string }
  }
}

interface AdLite {
  id: number | string
  name: string
  headline?: string
  bodyText?: string
  ctaText?: string
  targetUrl: string
  sponsoredLabel?: boolean
  priority?: number
  image?: MediaLike | number | string
  imageMobile?: MediaLike | number | string | null
  targetCategories?: Array<number | string | { id: number | string }>
}

/**
 * Pick the best URL for an ad image:
 *   • SVG → original (vector scales perfectly).
 *   • Raster → the largest sharp-resized variant available, falling
 *     back to the original. The resized variants are sharpened by
 *     sharp on upload, so they look crisper than the original at
 *     similar display sizes — same logic that makes article images
 *     look sharp in the cards.
 */
function pickAdImageUrl(media: MediaLike | undefined | null): string | undefined {
  if (!media) return undefined
  if (media.mimeType === 'image/svg+xml') return media.url
  return media.sizes?.full?.url || media.sizes?.hero?.url || media.sizes?.card?.url || media.url
}

/**
 * Public endpoint serving currently-active ads for a given placement.
 * Filters: status=active, startDate<=now<=endDate, optional category match.
 * Returns one or more ads, sorted by priority (lower number wins) then random.
 *
 * Read access here is intentionally bypassed for the Ads collection because
 * the row-level access control restricts public reads to keep advertiser
 * contact/billing details private. This endpoint returns only the
 * presentation-safe fields.
 */
export async function GET(req: NextRequest) {
  const limited = enforce(req, RateLimits.view)
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const placement = searchParams.get('placement')
  const categoryId = searchParams.get('category')
  const limit = Math.min(Number(searchParams.get('limit') ?? '1'), 5)

  if (!placement || !VALID_PLACEMENTS.has(placement)) {
    return NextResponse.json({ error: 'invalid placement' }, { status: 400 })
  }

  try {
    const payload = await getPayloadClient()
    const now = new Date().toISOString()

    const where: Record<string, unknown> = {
      status: { equals: 'active' },
      placement: { equals: placement },
      startDate: { less_than_equal: now },
      endDate: { greater_than_equal: now },
    }

    const result = await payload.find({
      collection: 'ads',
      where: where as never,
      limit: 50, // grab candidates; we'll filter client-side for category
      sort: 'priority',
      depth: 1,
      overrideAccess: true, // public endpoint with curated fields below
    })

    // Filter by category if provided (DB-level filter for relationship hasMany
    // requires custom predicates; doing it in app layer is fine for ad volumes).
    const cat = categoryId ? Number(categoryId) || categoryId : null
    let ads = result.docs as unknown as AdLite[]

    if (cat !== null) {
      ads = ads.filter((ad) => {
        if (!ad.targetCategories || ad.targetCategories.length === 0) {
          return true // no targeting = show everywhere
        }
        return ad.targetCategories.some((c) => {
          const id = typeof c === 'object' && c !== null ? c.id : c
          return id === cat || String(id) === String(cat)
        })
      })
    }

    // Sort: lower priority first, then stable order. Then take `limit`.
    ads.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
    ads = ads.slice(0, limit)

    // Project only safe fields (drop contact info, price, notes, etc.)
    const projected = ads.map((ad) => ({
      id: ad.id,
      headline: ad.headline,
      bodyText: ad.bodyText,
      ctaText: ad.ctaText,
      targetUrl: ad.targetUrl,
      sponsoredLabel: ad.sponsoredLabel !== false,
      image:
        ad.image && typeof ad.image === 'object'
          ? { url: pickAdImageUrl(ad.image), alt: ad.image.alt }
          : null,
      imageMobile:
        ad.imageMobile && typeof ad.imageMobile === 'object'
          ? { url: pickAdImageUrl(ad.imageMobile), alt: ad.imageMobile.alt }
          : null,
    }))

    return NextResponse.json(
      { ads: projected },
      {
        headers: {
          // Cache briefly so we don't hammer the DB. Stale-while-revalidate
          // on Cloudflare/edge means most requests are sub-ms.
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
        },
      },
    )
  } catch (err) {
    logger.error('ads.active.failed', { err, placement })
    return NextResponse.json({ ads: [] }, { status: 200 })
  }
}
