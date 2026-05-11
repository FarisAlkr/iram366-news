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
  const payload = await getPayloadClient()
  const result = await payload.findGlobal({ slug: 'site-settings', depth: 2 })
  return result as unknown as SiteSettings
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
  const payload = await getPayloadClient()
  try {
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
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'categories',
      limit: 50,
      sort: 'name',
      depth: 0,
    })
    return result.docs as unknown as Category[]
  },
  ['categories:list'],
  { tags: [CacheTags.Categories], revalidate: 300 },
)

export const getCategories = cache(async (): Promise<Category[]> => fetchCategories())

export const getCategoryBySlug = cache(async (slug: string): Promise<Category | undefined> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  return result.docs[0] as unknown as Category | undefined
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
}

export const getArticleBySlug = cache(
  async (slug: string, opts: { allowDraft?: boolean } = {}): Promise<Article | undefined> => {
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
  },
)
