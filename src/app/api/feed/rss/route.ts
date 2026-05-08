import { NextResponse, type NextRequest } from 'next/server'

import { ArticleStatus } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'
import { RateLimits, enforce } from '@/lib/rate-limit'
import { resolveRef } from '@/types/payload'
import type { Article, Category, SiteSettings, User } from '@/types/payload'

export const dynamic = 'force-dynamic'

const RSS_LIMIT = 50
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function escapeCdata(text: string): string {
  // Prevents premature CDATA termination in user-supplied text.
  return text.replace(/]]>/g, ']]]]><![CDATA[>')
}

function renderItem(article: Article, fallbackAuthor: string): string {
  const category = resolveRef(article.category as Category | string | number | null | undefined)
  const author = resolveRef(article.author as User | string | number | null | undefined)
  const link = `${SITE_URL}/articles/${article.slug}`
  const pubDate = article.publishedAt ? new Date(article.publishedAt).toUTCString() : ''
  const categoryLine = category?.name
    ? `\n      <category><![CDATA[${escapeCdata(category.name)}]]></category>`
    : ''

  return `    <item>
      <title><![CDATA[${escapeCdata(article.title)}]]></title>
      <link>${link}</link>
      <description><![CDATA[${escapeCdata(article.excerpt)}]]></description>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeCdata(author?.name || fallbackAuthor)}</author>${categoryLine}
      <guid isPermaLink="true">${link}</guid>
    </item>`
}

export async function GET(request: NextRequest) {
  const limited = enforce(request, RateLimits.rss)
  if (limited) return limited

  const payload = await getPayloadClient()

  const [siteSettings, articles] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings' }) as Promise<SiteSettings>,
    payload.find({
      collection: 'articles',
      where: { status: { equals: ArticleStatus.Published } },
      limit: RSS_LIMIT,
      sort: '-publishedAt',
      depth: 1,
    }),
  ])

  const siteName = siteSettings.siteName || 'إرم 366 الإخبارية'
  const siteDescription = siteSettings.siteDescription || ''
  const items = (articles.docs as unknown as Article[])
    .map((a) => renderItem(a, siteName))
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeCdata(siteName)}</title>
    <link>${SITE_URL}</link>
    <description><![CDATA[${escapeCdata(siteDescription)}]]></description>
    <language>ar</language>
    <atom:link href="${SITE_URL}/api/feed/rss" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  })
}
