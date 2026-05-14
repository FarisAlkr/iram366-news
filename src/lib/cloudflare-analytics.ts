/**
 * Cloudflare Web Analytics — server-side GraphQL fetcher for the admin
 * "إحصاءات" panel.
 *
 * Why RUM (rumPageloadEventsAdaptiveGroups) instead of zone HTTP analytics
 * (httpRequestsAdaptiveGroups):
 *
 *   The iram366news.com DNS record is grey-cloud (DNS-only, NOT proxied
 *   through Cloudflare's edge). Caddy on the VPS serves traffic directly —
 *   no `cf-ray` header, no Cloudflare proxy hop. zone-level HTTP analytics
 *   would therefore report zero pageviews. We use the Real-User-Monitoring
 *   beacon (static.cloudflareinsights.com/beacon.min.js) which runs in the
 *   browser and POSTs telemetry directly to Cloudflare regardless of
 *   proxy status. Its queryable surface is the
 *   `rumPageloadEventsAdaptiveGroups` dataset, scoped by accountTag +
 *   siteTag (where siteTag === the beacon token === the value in
 *   NEXT_PUBLIC_CF_ANALYTICS_TOKEN).
 *
 * Required env (per docs/infrastructure-contracts.md Rule 2 — already
 * wired in compose.environment):
 *
 *   CF_ANALYTICS_API_TOKEN          — Bearer token, "Account Analytics: Read"
 *   CF_ACCOUNT_ID                   — Cloudflare account tag
 *   NEXT_PUBLIC_CF_ANALYTICS_TOKEN  — Web Analytics beacon site tag
 *
 * Returns `null` (rather than throwing) on any missing-credential or
 * network failure — callers render the "not connected" panel and the
 * StatsView page keeps working.
 *
 * Cached with `unstable_cache` for 5 minutes. The cache key includes the
 * (since, until) pair so different windows don't collide.
 */
import { unstable_cache } from 'next/cache'

import { logger } from './logger.ts'

const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'
const REQUEST_TIMEOUT_MS = 15_000
const CACHE_TTL_SECONDS = 300
const TOP_LIMIT = 10

export interface SiteAnalytics {
  /** Total pageload events in the window. */
  pageviews: number
  /** Cloudflare's deduplicated visit count for the window. */
  uniqueVisitors: number
  /** Up to 10 most-requested paths in the window. */
  topPaths: Array<{ path: string; views: number }>
  /** Up to 10 most-frequent referrer hosts in the window. */
  topReferrers: Array<{ referrer: string; views: number }>
  /** One entry per day in the window (YYYY-MM-DD), oldest first. */
  timeSeries: Array<{ date: string; views: number; visitors: number }>
}

export interface AnalyticsOptions {
  /** ISO 8601 datetime, inclusive lower bound. */
  since: string
  /** ISO 8601 datetime, exclusive upper bound. */
  until: string
}

interface CfPageloadGroup<D = Record<string, unknown>> {
  count: number
  sum?: { visits?: number }
  dimensions?: D
}

interface CfResponse<K extends string, D> {
  viewer: { accounts: Array<{ [key in K]: Array<CfPageloadGroup<D>> }> }
}

async function postGraphQL<TData>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData | null> {
  const token = process.env.CF_ANALYTICS_API_TOKEN
  if (!token) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    })
    if (!response.ok) {
      logger.error('cf.analytics.http_error', { status: response.status })
      return null
    }
    const payload = (await response.json()) as { data?: TData; errors?: unknown[] }
    if (payload.errors && payload.errors.length > 0) {
      logger.error('cf.analytics.api_errors', { errors: payload.errors })
      return null
    }
    return payload.data ?? null
  } catch (err) {
    logger.error('cf.analytics.fetch_failed', {
      err: err instanceof Error ? err.message : String(err),
    })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

const TOTALS_QUERY = `
  query($a: String!, $s: String!, $since: Time!, $until: Time!) {
    viewer {
      accounts(filter: { accountTag: $a }) {
        totals: rumPageloadEventsAdaptiveGroups(
          limit: 1,
          filter: { siteTag: $s, datetime_geq: $since, datetime_lt: $until }
        ) {
          count
          sum { visits }
        }
      }
    }
  }
`

const SERIES_QUERY = `
  query($a: String!, $s: String!, $since: Time!, $until: Time!) {
    viewer {
      accounts(filter: { accountTag: $a }) {
        series: rumPageloadEventsAdaptiveGroups(
          limit: 100,
          filter: { siteTag: $s, datetime_geq: $since, datetime_lt: $until },
          orderBy: [date_ASC]
        ) {
          count
          sum { visits }
          dimensions { date }
        }
      }
    }
  }
`

const PATHS_QUERY = `
  query($a: String!, $s: String!, $since: Time!, $until: Time!, $limit: Int!) {
    viewer {
      accounts(filter: { accountTag: $a }) {
        paths: rumPageloadEventsAdaptiveGroups(
          limit: $limit,
          filter: { siteTag: $s, datetime_geq: $since, datetime_lt: $until },
          orderBy: [count_DESC]
        ) {
          count
          dimensions { requestPath }
        }
      }
    }
  }
`

const REFERRERS_QUERY = `
  query($a: String!, $s: String!, $since: Time!, $until: Time!, $limit: Int!) {
    viewer {
      accounts(filter: { accountTag: $a }) {
        referrers: rumPageloadEventsAdaptiveGroups(
          limit: $limit,
          filter: { siteTag: $s, datetime_geq: $since, datetime_lt: $until },
          orderBy: [count_DESC]
        ) {
          count
          dimensions { refererHost }
        }
      }
    }
  }
`

async function fetchSiteAnalyticsRaw(opts: AnalyticsOptions): Promise<SiteAnalytics | null> {
  const accountTag = process.env.CF_ACCOUNT_ID
  const siteTag = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN
  if (!accountTag || !siteTag) return null

  const variables = {
    a: accountTag,
    s: siteTag,
    since: opts.since,
    until: opts.until,
  }

  const [totals, series, paths, referrers] = await Promise.all([
    postGraphQL<CfResponse<'totals', never>>(TOTALS_QUERY, variables),
    postGraphQL<CfResponse<'series', { date: string }>>(SERIES_QUERY, variables),
    postGraphQL<CfResponse<'paths', { requestPath: string }>>(PATHS_QUERY, {
      ...variables,
      limit: TOP_LIMIT,
    }),
    postGraphQL<CfResponse<'referrers', { refererHost: string }>>(REFERRERS_QUERY, {
      ...variables,
      limit: TOP_LIMIT,
    }),
  ])

  // If every query failed (no data structure returned at all), bail out so
  // the caller can show the disconnected-state panel. Partial failures fall
  // through with zeros for the missing section — better than throwing.
  if (!totals && !series && !paths && !referrers) return null

  const totalsRow = totals?.viewer.accounts[0]?.totals[0]
  const seriesRows = series?.viewer.accounts[0]?.series ?? []
  const pathRows = paths?.viewer.accounts[0]?.paths ?? []
  const referrerRows = referrers?.viewer.accounts[0]?.referrers ?? []

  return {
    pageviews: totalsRow?.count ?? 0,
    uniqueVisitors: totalsRow?.sum?.visits ?? 0,
    timeSeries: seriesRows
      .map((row) => ({
        date: row.dimensions?.date ?? '',
        views: row.count,
        visitors: row.sum?.visits ?? 0,
      }))
      .filter((entry) => entry.date.length > 0),
    topPaths: pathRows
      .map((row) => ({
        path: row.dimensions?.requestPath ?? '',
        views: row.count,
      }))
      .filter((entry) => entry.path.length > 0),
    topReferrers: referrerRows
      .map((row) => ({
        referrer: row.dimensions?.refererHost ?? '',
        views: row.count,
      }))
      .filter((entry) => entry.referrer.length > 0),
  }
}

export const fetchSiteAnalytics = unstable_cache(fetchSiteAnalyticsRaw, ['cf-analytics-v1'], {
  revalidate: CACHE_TTL_SECONDS,
  tags: ['cf-analytics'],
})

/**
 * Convenience helper — sums the last N entries of a timeSeries into a
 * combined pageviews + visitors total. Visitor counts in this representation
 * are CF's per-day unique-visit counters; summing daily uniques over a
 * window overcounts true distinct visitors (a person who comes back two
 * days in a row gets counted twice). This is a known imprecision of
 * derived rollups; if you need a truly-deduped multi-day visitor count,
 * call `fetchSiteAnalytics` with the matching `since` window directly.
 */
export function rollupLastN(
  timeSeries: SiteAnalytics['timeSeries'],
  days: number,
): { views: number; visitors: number } {
  const tail = timeSeries.slice(-days)
  return tail.reduce(
    (acc, entry) => ({
      views: acc.views + entry.views,
      visitors: acc.visitors + entry.visitors,
    }),
    { views: 0, visitors: 0 },
  )
}
