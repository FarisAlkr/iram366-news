/**
 * Read-side data access for the public site.
 *
 * Wraps Payload's local API in named, typed functions so pages and components
 * never call `payload.find` directly. Two layers of caching:
 *
 *   1. React `cache()` — dedupes within a single server render. Calling
 *      `getSiteSettings()` from the layout, header, and footer hits Postgres
 *      once.
 *   2. Per-call `unstable_cache` for slow queries (categories) — survives
 *      across requests with a TTL, invalidated by tag.
 *
 * Mutations elsewhere should `revalidateTag('categories')` etc. when changing
 * the underlying collection. For now the homepage uses `revalidate: 60` so
 * stale-by-a-minute is acceptable.
 */

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getPayloadClient } from '@/lib/payload'
import { ArticleStatus } from '@/domain/enums'
import type { Article, Category, SiteSettings } from '@/types/payload'

// During `next build` inside Docker the DB is unreachable on purpose (see
// Dockerfile — DATABASE_URL is intentionally not forwarded as a build arg).
// Pages with `revalidate` still get prerendered once at build, so every
// read-side helper here must fall back to a safe empty value instead of
// throwing — otherwise the build crashes. The first request after deploy
// repopulates real data and ISR keeps it fresh.
//
// Two layers of defence:
//   1. `IS_BUILD` short-circuits Payload init entirely during `next build`.
//      Even with a try/catch in place, Payload's internal logger writes the
//      connection-refused trace to stderr, which clutters build output and
//      historically masked the real failure.
//   2. The try/catch around every Payload call still runs at request time,
//      so a runtime DB blip degrades gracefully to empty content instead of
//      a 500.
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build'

const SAFE_EMPTY_SITE_SETTINGS = {} as SiteSettings
const SAFE_EMPTY_LIST = { docs: [], totalPages: 0, totalDocs: 0 } as {
  docs: Article[]
  totalPages: number
  totalDocs: number
}

// --------------------------------------------------------------------------
// Cache tags — use these to invalidate from mutations.
// --------------------------------------------------------------------------

export const CacheTags = {
  Categories: 'categories',
  SiteSettings: 'site-settings',
  Articles: 'articles',
} as const

// --------------------------------------------------------------------------
// Site settings
// --------------------------------------------------------------------------

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (IS_BUILD) return SAFE_EMPTY_SITE_SETTINGS
  try {
    const payload = await getPayloadClient()
    const result = await payload.findGlobal({ slug: 'site-settings', depth: 2 })
    return result as unknown as SiteSettings
  } catch {
    return SAFE_EMPTY_SITE_SETTINGS
  }
})

// --------------------------------------------------------------------------
// Weather towns (header city picker)
// --------------------------------------------------------------------------

export interface WeatherTown {
  name: string
  lat: number
  lon: number
  region: string
}

export const getWeatherTowns = cache(async (): Promise<WeatherTown[]> => {
  if (IS_BUILD) return []
  try {
    const payload = await getPayloadClient()
    const result = (await payload.findGlobal({
      slug: 'weather-towns',
      depth: 0,
    })) as { towns?: WeatherTown[] }
    return Array.isArray(result.towns) ? result.towns : []
  } catch {
    return []
  }
})

// --------------------------------------------------------------------------
// Categories — cached for 5 minutes across requests, deduped per request
// --------------------------------------------------------------------------

const fetchCategories = unstable_cache(
  async (): Promise<Category[]> => {
    if (IS_BUILD) return []
    try {
      const payload = await getPayloadClient()
      const result = await payload.find({
        collection: 'categories',
        limit: 50,
        sort: 'name',
        depth: 0,
      })
      return result.docs as unknown as Category[]
    } catch {
      return []
    }
  },
  ['categories:list'],
  { tags: [CacheTags.Categories], revalidate: 300 },
)

export const getCategories = cache(async (): Promise<Category[]> => fetchCategories())

export const getCategoryBySlug = cache(async (slug: string): Promise<Category | undefined> => {
  if (IS_BUILD) return undefined
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    return result.docs[0] as unknown as Category | undefined
  } catch {
    return undefined
  }
})

// --------------------------------------------------------------------------
// Articles
// --------------------------------------------------------------------------

interface ListArticlesOptions {
  limit?: number
  page?: number
  categoryId?: string | number
  isFeatured?: boolean
  isBreaking?: boolean
  sort?: '-publishedAt' | '-views'
  depth?: number
}

export async function listPublishedArticles(
  opts: ListArticlesOptions = {},
): Promise<{ docs: Article[]; totalPages: number; totalDocs: number }> {
  if (IS_BUILD) return SAFE_EMPTY_LIST
  try {
    const payload = await getPayloadClient()
    // Scheduled publishing: an article with status=published but a future
    // `publishedAt` is treated as scheduled — held back from public listings
    // until that time. The editor sees it in admin; readers don't.
    const now = new Date().toISOString()
    const where: Record<string, unknown> = {
      status: { equals: ArticleStatus.Published },
      publishedAt: { less_than_equal: now },
    }
    // Soft-delete is a planned feature; no articles are soft-deleted yet.
    // Adding a `deletedAt` filter via Payload's `exists: false` produced
    // empty result sets (article pages 404'd even when DB rows existed).
    // We'll re-introduce the filter later once we lock down which operator
    // the Postgres adapter compiles correctly for nullable timestamp columns.
    if (opts.categoryId !== undefined) where.category = { equals: opts.categoryId }
    if (opts.isFeatured) where.isFeatured = { equals: true }
    if (opts.isBreaking) where.isBreaking = { equals: true }

    const result = await payload.find({
      collection: 'articles',
      where: where as never,
      limit: opts.limit ?? 12,
      page: opts.page,
      sort: opts.sort ?? '-publishedAt',
      depth: opts.depth ?? 2,
    })
    return {
      docs: result.docs as unknown as Article[],
      totalPages: result.totalPages,
      totalDocs: result.totalDocs,
    }
  } catch {
    return SAFE_EMPTY_LIST
  }
}

export const getArticleBySlug = cache(
  async (slug: string, opts: { allowDraft?: boolean } = {}): Promise<Article | undefined> => {
    if (IS_BUILD) return undefined
    try {
      const payload = await getPayloadClient()
      const where: Record<string, unknown> = { slug: { equals: slug } }
      if (!opts.allowDraft) {
        where.status = { equals: ArticleStatus.Published }
        where.publishedAt = { less_than_equal: new Date().toISOString() }
      }
      const result = await payload.find({
        collection: 'articles',
        where: where as never,
        limit: 1,
        depth: 2,
        overrideAccess: opts.allowDraft,
      })
      return result.docs[0] as unknown as Article | undefined
    } catch {
      return undefined
    }
  },
)
