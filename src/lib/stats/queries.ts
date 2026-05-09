/**
 * Aggregate queries for the admin "Professional Statistics" view.
 *
 * Uses a dedicated `pg` Pool (separate from Payload's drizzle layer) and
 * raw SQL because Payload's local API isn't built for cross-collection
 * aggregates (counts, sums, group-by). Cached via Next's `unstable_cache`
 * with a 60-second revalidation so a stats-page reload doesn't hammer
 * the DB; cached-by-tag so we can selectively invalidate later.
 */

import { unstable_cache } from 'next/cache'
import { Pool } from 'pg'

let pool: Pool | null = null
function getStatsPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    pool = new Pool({ connectionString: url, max: 3 })
  }
  return pool
}

export interface ArticleCounts {
  publishedToday: number
  publishedThisWeek: number
  publishedThisMonth: number
  publishedTotal: number
  totalViews: number
  awaitingReview: number
  draftCount: number
  breakingCount: number
}

export interface TopArticle {
  id: number
  title: string
  slug: string
  views: number
  publishedAt: string | null
}

export interface AuthorStat {
  id: number
  name: string
  articles: number
  totalViews: number
}

export interface CategoryStat {
  id: number
  name: string
  color: string | null
  count: number
}

export interface DailyPublishCount {
  day: string // ISO date YYYY-MM-DD
  count: number
}

async function fetchArticleCounts(): Promise<ArticleCounts> {
  const { rows } = await getStatsPool().query<{
    published_today: string
    published_week: string
    published_month: string
    published_total: string
    total_views: string
    awaiting_review: string
    drafts: string
    breaking: string
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE status='published' AND published_at >= now() - interval '1 day')::text  AS published_today,
      COUNT(*) FILTER (WHERE status='published' AND published_at >= now() - interval '7 days')::text AS published_week,
      COUNT(*) FILTER (WHERE status='published' AND published_at >= now() - interval '30 days')::text AS published_month,
      COUNT(*) FILTER (WHERE status='published')::text AS published_total,
      COALESCE(SUM(views) FILTER (WHERE status='published'), 0)::text AS total_views,
      COUNT(*) FILTER (WHERE status='in-review')::text AS awaiting_review,
      COUNT(*) FILTER (WHERE status='draft')::text AS drafts,
      COUNT(*) FILTER (WHERE status='published' AND is_breaking=true)::text AS breaking
    FROM articles
    WHERE deleted_at IS NULL
  `)
  const r = rows[0]
  return {
    publishedToday: Number(r?.published_today ?? 0),
    publishedThisWeek: Number(r?.published_week ?? 0),
    publishedThisMonth: Number(r?.published_month ?? 0),
    publishedTotal: Number(r?.published_total ?? 0),
    totalViews: Number(r?.total_views ?? 0),
    awaitingReview: Number(r?.awaiting_review ?? 0),
    draftCount: Number(r?.drafts ?? 0),
    breakingCount: Number(r?.breaking ?? 0),
  }
}

async function fetchTopArticles(limit = 10): Promise<TopArticle[]> {
  const { rows } = await getStatsPool().query<{
    id: number
    title: string
    slug: string
    views: number
    published_at: string | null
  }>(
    `SELECT id, title, slug, COALESCE(views, 0) AS views, published_at
       FROM articles
      WHERE status='published' AND deleted_at IS NULL
      ORDER BY views DESC NULLS LAST, published_at DESC NULLS LAST
      LIMIT $1`,
    [limit],
  )
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    views: Number(r.views) || 0,
    publishedAt: r.published_at,
  }))
}

async function fetchAuthorLeaderboard(limit = 10): Promise<AuthorStat[]> {
  const { rows } = await getStatsPool().query<{
    id: number
    name: string
    articles: string
    total_views: string
  }>(
    `SELECT u.id, u.name,
            COUNT(a.id)::text AS articles,
            COALESCE(SUM(a.views), 0)::text AS total_views
       FROM users u
       LEFT JOIN articles a
              ON a.author_id = u.id
             AND a.status='published'
             AND a.deleted_at IS NULL
       GROUP BY u.id, u.name
      HAVING COUNT(a.id) > 0
      ORDER BY total_views DESC, articles DESC
      LIMIT $1`,
    [limit],
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    articles: Number(r.articles) || 0,
    totalViews: Number(r.total_views) || 0,
  }))
}

async function fetchCategoryDistribution(): Promise<CategoryStat[]> {
  const { rows } = await getStatsPool().query<{
    id: number
    name: string
    color: string | null
    count: string
  }>(`
    SELECT c.id, c.name, c.color,
           COUNT(a.id)::text AS count
      FROM categories c
      LEFT JOIN articles a
             ON a.category_id = c.id
            AND a.status='published'
            AND a.deleted_at IS NULL
     GROUP BY c.id, c.name, c.color
     ORDER BY count DESC NULLS LAST, c.name ASC
  `)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    count: Number(r.count) || 0,
  }))
}

async function fetchDailyPublishCounts(days = 30): Promise<DailyPublishCount[]> {
  const { rows } = await getStatsPool().query<{ day: string; count: string }>(
    `WITH days AS (
       SELECT generate_series(
         (now() - ($1::int - 1) * interval '1 day')::date,
         now()::date,
         '1 day'::interval
       )::date AS day
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COUNT(a.id)::text AS count
       FROM days d
       LEFT JOIN articles a
              ON DATE(a.published_at) = d.day
             AND a.status='published'
             AND a.deleted_at IS NULL
      GROUP BY d.day
      ORDER BY d.day ASC`,
    [days],
  )
  return rows.map((r) => ({ day: r.day, count: Number(r.count) || 0 }))
}

// --------------------------------------------------------------------------
// Cached, public exports — 60 s revalidation by default.
// --------------------------------------------------------------------------

const TAG = 'admin-stats'
const REVALIDATE = 60

export const getArticleCounts = unstable_cache(fetchArticleCounts, ['stats:counts'], {
  tags: [TAG],
  revalidate: REVALIDATE,
})
export const getTopArticles = unstable_cache(fetchTopArticles, ['stats:top'], {
  tags: [TAG],
  revalidate: REVALIDATE,
})
export const getAuthorLeaderboard = unstable_cache(
  fetchAuthorLeaderboard,
  ['stats:authors'],
  { tags: [TAG], revalidate: REVALIDATE },
)
export const getCategoryDistribution = unstable_cache(
  fetchCategoryDistribution,
  ['stats:categories'],
  { tags: [TAG], revalidate: REVALIDATE },
)
export const getDailyPublishCounts = unstable_cache(
  fetchDailyPublishCounts,
  ['stats:daily'],
  { tags: [TAG], revalidate: REVALIDATE },
)
