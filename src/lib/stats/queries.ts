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

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ArticleCounts {
  publishedToday: number
  publishedThisWeek: number
  publishedThisMonth: number
  publishedTotal: number
  totalViews: number
  awaitingReview: number
  draftCount: number
  breakingCount: number
  // Period-over-period comparison
  publishedLastWeek: number // 7 days before this week
  totalViewsLastMonth: number // for trend
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
  day: string // ISO YYYY-MM-DD
  count: number
}

export interface StatusBreakdown {
  draft: number
  inReview: number
  published: number
  archived: number
}

export interface ViewStats {
  mean: number
  median: number
  max: number
}

export interface TimeToPublish {
  avgHours: number | null
  medianHours: number | null
}

export interface DowActivity {
  dow: number // 0=Sun … 6=Sat
  week: string // YYYY-MM-DD (Monday)
  count: number
}

export interface TagFreq {
  tag: string
  count: number
}

export interface DataQuality {
  noImage: number
  noCategory: number
  noTags: number
  noExcerpt: number
  totalPublished: number
}

// --------------------------------------------------------------------------
// Raw fetchers
// --------------------------------------------------------------------------

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
    published_last_week: string
    total_views_last_month: string
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE status='published' AND published_at >= now() - interval '1 day')::text  AS published_today,
      COUNT(*) FILTER (WHERE status='published' AND published_at >= now() - interval '7 days')::text AS published_week,
      COUNT(*) FILTER (WHERE status='published' AND published_at >= now() - interval '30 days')::text AS published_month,
      COUNT(*) FILTER (WHERE status='published')::text AS published_total,
      COALESCE(SUM(views) FILTER (WHERE status='published'), 0)::text AS total_views,
      COUNT(*) FILTER (WHERE status='in-review')::text AS awaiting_review,
      COUNT(*) FILTER (WHERE status='draft')::text AS drafts,
      COUNT(*) FILTER (WHERE status='published' AND is_breaking=true)::text AS breaking,
      COUNT(*) FILTER (
        WHERE status='published'
          AND published_at >= now() - interval '14 days'
          AND published_at <  now() - interval '7 days'
      )::text AS published_last_week,
      COALESCE(SUM(views) FILTER (
        WHERE status='published'
          AND published_at >= now() - interval '60 days'
          AND published_at <  now() - interval '30 days'
      ), 0)::text AS total_views_last_month
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
    publishedLastWeek: Number(r?.published_last_week ?? 0),
    totalViewsLastMonth: Number(r?.total_views_last_month ?? 0),
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

async function fetchStatusBreakdown(): Promise<StatusBreakdown> {
  const { rows } = await getStatsPool().query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count
       FROM articles
      WHERE deleted_at IS NULL
      GROUP BY status`,
  )
  const out: StatusBreakdown = { draft: 0, inReview: 0, published: 0, archived: 0 }
  for (const r of rows) {
    const c = Number(r.count) || 0
    if (r.status === 'draft') out.draft = c
    else if (r.status === 'in-review') out.inReview = c
    else if (r.status === 'published') out.published = c
    else if (r.status === 'archived') out.archived = c
  }
  return out
}

async function fetchViewStats(): Promise<ViewStats> {
  const { rows } = await getStatsPool().query<{
    mean: string
    median: string
    max: string
  }>(`
    SELECT
      COALESCE(AVG(views), 0)::bigint::text AS mean,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY views), 0)::bigint::text AS median,
      COALESCE(MAX(views), 0)::text AS max
    FROM articles
    WHERE status='published' AND deleted_at IS NULL
  `)
  return {
    mean: Number(rows[0]?.mean ?? 0),
    median: Number(rows[0]?.median ?? 0),
    max: Number(rows[0]?.max ?? 0),
  }
}

async function fetchTimeToPublish(): Promise<TimeToPublish> {
  const { rows } = await getStatsPool().query<{
    avg_hours: string | null
    median_hours: string | null
  }>(`
    SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM (published_at - created_at)) / 3600.0)::numeric, 1)::text AS avg_hours,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (published_at - created_at)) / 3600.0
      )::numeric, 1)::text AS median_hours
    FROM articles
    WHERE status='published'
      AND deleted_at IS NULL
      AND published_at IS NOT NULL
      AND published_at >= created_at
  `)
  return {
    avgHours: rows[0]?.avg_hours != null ? Number(rows[0].avg_hours) : null,
    medianHours: rows[0]?.median_hours != null ? Number(rows[0].median_hours) : null,
  }
}

async function fetchDowActivity(weeks = 12): Promise<DowActivity[]> {
  const { rows } = await getStatsPool().query<{ dow: number; week: string; count: string }>(
    `SELECT
       EXTRACT(DOW FROM published_at)::int AS dow,
       to_char(DATE_TRUNC('week', published_at), 'YYYY-MM-DD') AS week,
       COUNT(*)::text AS count
     FROM articles
     WHERE status='published'
       AND deleted_at IS NULL
       AND published_at >= now() - ($1::int * interval '7 days')
     GROUP BY dow, week
     ORDER BY week ASC, dow ASC`,
    [weeks],
  )
  return rows.map((r) => ({ dow: r.dow, week: r.week, count: Number(r.count) || 0 }))
}

async function fetchTagFrequencies(limit = 30): Promise<TagFreq[]> {
  // articles_tags table: { _parent_id, _order, id, tag }
  try {
    const { rows } = await getStatsPool().query<{ tag: string; count: string }>(
      `SELECT t.tag, COUNT(*)::text AS count
         FROM articles_tags t
         JOIN articles a ON a.id = t._parent_id
        WHERE a.status='published' AND a.deleted_at IS NULL
          AND t.tag IS NOT NULL AND t.tag <> ''
        GROUP BY t.tag
        ORDER BY count DESC
        LIMIT $1`,
      [limit],
    )
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) || 0 }))
  } catch {
    // Table may not exist on older schemas — silently return empty
    return []
  }
}

async function fetchDataQuality(): Promise<DataQuality> {
  const { rows } = await getStatsPool().query<{
    no_image: string
    no_category: string
    no_tags: string
    no_excerpt: string
    total: string
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE featured_image_id IS NULL)::text AS no_image,
      COUNT(*) FILTER (WHERE category_id IS NULL)::text AS no_category,
      COUNT(*) FILTER (WHERE excerpt IS NULL OR excerpt = '')::text AS no_excerpt,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM articles_tags t WHERE t._parent_id = articles.id
        )
      )::text AS no_tags,
      COUNT(*)::text AS total
    FROM articles
    WHERE status='published' AND deleted_at IS NULL
  `)
  const r = rows[0]
  return {
    noImage: Number(r?.no_image ?? 0),
    noCategory: Number(r?.no_category ?? 0),
    noTags: Number(r?.no_tags ?? 0),
    noExcerpt: Number(r?.no_excerpt ?? 0),
    totalPublished: Number(r?.total ?? 0),
  }
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
export const getStatusBreakdown = unstable_cache(
  fetchStatusBreakdown,
  ['stats:status'],
  { tags: [TAG], revalidate: REVALIDATE },
)
export const getViewStats = unstable_cache(fetchViewStats, ['stats:views'], {
  tags: [TAG],
  revalidate: REVALIDATE,
})
export const getTimeToPublish = unstable_cache(
  fetchTimeToPublish,
  ['stats:ttp'],
  { tags: [TAG], revalidate: REVALIDATE },
)
export const getDowActivity = unstable_cache(fetchDowActivity, ['stats:dow'], {
  tags: [TAG],
  revalidate: REVALIDATE,
})
export const getTagFrequencies = unstable_cache(
  fetchTagFrequencies,
  ['stats:tags'],
  { tags: [TAG], revalidate: REVALIDATE },
)
export const getDataQuality = unstable_cache(
  fetchDataQuality,
  ['stats:quality'],
  { tags: [TAG], revalidate: REVALIDATE },
)
