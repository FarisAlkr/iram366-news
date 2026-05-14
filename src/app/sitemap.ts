export const dynamic = 'force-dynamic'

import type { MetadataRoute } from 'next'

import { ArticleStatus } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

interface SitemapDoc {
  slug: string
  publishedAt?: string | null
  updatedAt: string
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Build-safe: if the DB isn't reachable during `next build`, return just
  // the homepage entry. force-dynamic above means the real sitemap is
  // regenerated on every request, so the build-time stub is never served.
  let articles = { docs: [] as Array<unknown> }
  let categories = { docs: [] as Array<unknown> }
  let pages = { docs: [] as Array<unknown> }
  try {
    const payload = await getPayloadClient()
    ;[articles, categories, pages] = await Promise.all([
      payload.find({
        collection: 'articles',
        where: { status: { equals: ArticleStatus.Published } },
        limit: 1000,
        sort: '-publishedAt',
        depth: 0,
      }),
      payload.find({ collection: 'categories', limit: 100, depth: 0 }),
      payload.find({ collection: 'pages', limit: 100, depth: 0 }),
    ])
  } catch {
    // fall through with empty arrays
  }

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
  ]

  for (const cat of categories.docs as unknown as { slug: string }[]) {
    entries.push({
      url: `${SITE_URL}/category/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    })
  }

  for (const article of articles.docs as unknown as SitemapDoc[]) {
    entries.push({
      url: `${SITE_URL}/articles/${article.slug}`,
      lastModified: new Date(article.publishedAt || article.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  }

  for (const page of pages.docs as unknown as SitemapDoc[]) {
    entries.push({
      url: `${SITE_URL}/${page.slug}`,
      lastModified: new Date(page.publishedAt || page.updatedAt),
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  return entries
}
