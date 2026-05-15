import { logger } from './logger'
import { getPayloadClient } from './payload'

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
  placement: string
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

export interface PublicAd {
  id: number | string
  headline?: string
  bodyText?: string
  ctaText?: string
  targetUrl: string
  sponsoredLabel: boolean
  image: { url?: string; alt?: string } | null
  imageMobile: { url?: string; alt?: string } | null
}

// SVG → original (vector scales perfectly). Raster → largest sharp-resized
// variant available, falling back to the original. Same logic as the
// per-placement endpoint so client-rendered ads (Header) look identical to
// server-prefetched ads (homepage).
function pickAdImageUrl(media: MediaLike | undefined | null): string | undefined {
  if (!media) return undefined
  if (media.mimeType === 'image/svg+xml') return media.url
  return media.sizes?.full?.url || media.sizes?.hero?.url || media.sizes?.card?.url || media.url
}

function projectAd(ad: AdLite): PublicAd {
  return {
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
  }
}

/**
 * Fetch the best active ad for each requested placement in a single
 * Postgres round-trip. Replaces the per-AdSlot client fetch N+1 (one
 * /api/ads/active call per slot — 6 on the homepage, flagged by Sentry
 * as `JAVASCRIPT-NEXTJS-4`).
 *
 * Called server-side from the page component; the resulting map is
 * passed to each AdSlot via the `ad` prop. Map values:
 *
 *   - `undefined`  → placement not requested
 *   - `null`       → placement was requested, no active ad available
 *   - `PublicAd`   → render this ad
 *
 * Selection per placement: filter by category targeting (if specified),
 * then take the lowest `priority` number. Matches the existing
 * /api/ads/active behavior exactly so editors don't see a different ad
 * after this rolls out.
 */
export async function getAdsForPlacements(
  placements: readonly string[],
  categoryId?: number | string,
): Promise<Map<string, PublicAd | null>> {
  const out = new Map<string, PublicAd | null>(placements.map((p) => [p, null]))
  if (placements.length === 0) return out

  try {
    const payload = await getPayloadClient()
    const now = new Date().toISOString()

    const result = await payload.find({
      collection: 'ads',
      where: {
        status: { equals: 'active' },
        placement: { in: placements as string[] },
        startDate: { less_than_equal: now },
        endDate: { greater_than_equal: now },
      } as never,
      limit: 200,
      sort: 'priority',
      depth: 1,
      overrideAccess: true,
    })

    const cat = categoryId !== undefined ? Number(categoryId) || categoryId : null
    const ads = result.docs as unknown as AdLite[]

    for (const placement of placements) {
      const chosen = ads
        .filter((a) => a.placement === placement)
        .filter((a) => {
          if (cat === null) return true
          if (!a.targetCategories || a.targetCategories.length === 0) return true
          return a.targetCategories.some((c) => {
            const id = typeof c === 'object' && c !== null ? c.id : c
            return id === cat || String(id) === String(cat)
          })
        })
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))[0]

      if (chosen) out.set(placement, projectAd(chosen))
    }
  } catch (err) {
    logger.error('ads.get_for_placements_failed', { err, placements })
  }

  return out
}
