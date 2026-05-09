import React from 'react'
import { getPayload } from 'payload'

import config from '@payload-config'

// ==========================================================================
// Types
// ==========================================================================
type DailyPoint = { date: string; count: number }

interface PageViewRow {
  id: number | string
  date: string
  category?: { id: number | string; name?: string; color?: string } | number | string | null
}

interface ArticleRow {
  id: number | string
  title: string
  slug?: string
  status: string
  views?: number
  publishedAt?: string | null
  updatedAt: string
  createdAt?: string
  category?: { id: number | string; name?: string; color?: string } | number | string | null
  featuredImage?: { url?: string; sizes?: { thumbnail?: { url?: string } } } | number | string | null
  isFeatured?: boolean
  isBreaking?: boolean
}

interface UserRow {
  id: number | string
  name?: string
  email?: string
  role?: string
}

// ==========================================================================
// Data aggregation
// ==========================================================================
const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function buildDailyBuckets(days: number, now: Date): DailyPoint[] {
  const buckets: DailyPoint[] = []
  const today = startOfDay(now)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS)
    buckets.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  return buckets
}

async function getStats(currentUser: UserRow | null) {
  const payload = await getPayload({ config })
  const now = new Date()
  const today = startOfDay(now)
  const periodStart = new Date(today.getTime() - 29 * DAY_MS)
  const previousStart = new Date(today.getTime() - 59 * DAY_MS)
  const previousEnd = periodStart

  const [
    publishedCount,
    draftCount,
    archivedCount,
    categoriesResult,
    usersCount,
    viewsCurrent,
    viewsPrevious,
    articlesRecent30d,
    articlesPrevious30d,
    topArticles,
    recentActivity,
    articlesMissingImage,
    breakingCount,
    featuredCount,
    allArticlesForBars,
  ] = await Promise.all([
    payload.count({ collection: 'articles', where: { status: { equals: 'published' } } }),
    payload.count({ collection: 'articles', where: { status: { equals: 'draft' } } }),
    payload.count({ collection: 'articles', where: { status: { equals: 'archived' } } }),
    payload.find({ collection: 'categories', limit: 50, depth: 0 }),
    payload.count({ collection: 'users' }),

    // Current 30d views
    payload.find({
      collection: 'page-views',
      where: { date: { greater_than_equal: periodStart.toISOString() } },
      limit: 100000,
      depth: 1,
      sort: '-date',
    }),

    // Previous 30d views (for trend delta)
    payload.count({
      collection: 'page-views',
      where: {
        date: {
          greater_than_equal: previousStart.toISOString(),
          less_than: previousEnd.toISOString(),
        },
      },
    }),

    // Articles published in current 30d
    payload.count({
      collection: 'articles',
      where: {
        status: { equals: 'published' },
        publishedAt: { greater_than_equal: periodStart.toISOString() },
      },
    }),
    payload.count({
      collection: 'articles',
      where: {
        status: { equals: 'published' },
        publishedAt: {
          greater_than_equal: previousStart.toISOString(),
          less_than: previousEnd.toISOString(),
        },
      },
    }),

    // Top 5 articles by views
    payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      sort: '-views',
      limit: 5,
      depth: 2,
    }),

    // Recent 8 activity items (any status)
    payload.find({
      collection: 'articles',
      sort: '-updatedAt',
      limit: 8,
      depth: 1,
    }),

    // Articles missing featured image
    payload.count({
      collection: 'articles',
      where: {
        status: { equals: 'published' },
        featuredImage: { exists: false },
      },
    }),

    payload.count({
      collection: 'articles',
      where: { isBreaking: { equals: true }, status: { equals: 'published' } },
    }),
    payload.count({
      collection: 'articles',
      where: { isFeatured: { equals: true }, status: { equals: 'published' } },
    }),

    // Articles with views for category bar chart
    payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      limit: 200,
      depth: 1,
    }),
  ])

  // ------ Aggregate page views into daily + by-category ------
  const viewsByDay = buildDailyBuckets(30, now)
  const dayIndex = new Map(viewsByDay.map((p, i) => [p.date, i]))
  const viewsByCategory = new Map<string, { name: string; color: string; views: number }>()
  const viewsByHour = Array.from({ length: 24 }, () => 0)

  for (const v of viewsCurrent.docs as unknown as PageViewRow[]) {
    const key = new Date(v.date).toISOString().slice(0, 10)
    const idx = dayIndex.get(key)
    if (idx !== undefined) viewsByDay[idx]!.count++

    const hour = new Date(v.date).getHours()
    viewsByHour[hour] = (viewsByHour[hour] ?? 0) + 1

    const cat = v.category
    if (cat && typeof cat === 'object') {
      const existing = viewsByCategory.get(String(cat.id))
      if (existing) existing.views++
      else
        viewsByCategory.set(String(cat.id), {
          name: cat.name || 'غير مصنف',
          color: cat.color || '#c8a84e',
          views: 1,
        })
    }
  }

  const totalViewsCurrent = viewsCurrent.docs.length
  const viewsDelta = percentDelta(totalViewsCurrent, viewsPrevious.totalDocs)
  const articlesDelta = percentDelta(articlesRecent30d.totalDocs, articlesPrevious30d.totalDocs)

  // ------ Articles per day (publishing velocity) ------
  const velocity = buildDailyBuckets(30, now)
  const velIndex = new Map(velocity.map((p, i) => [p.date, i]))
  for (const a of allArticlesForBars.docs as unknown as ArticleRow[]) {
    if (!a.publishedAt) continue
    const key = new Date(a.publishedAt).toISOString().slice(0, 10)
    const idx = velIndex.get(key)
    if (idx !== undefined) velocity[idx]!.count++
  }

  // ------ Category ranking ------
  const categoryBars = Array.from(viewsByCategory.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
  const maxCatViews = Math.max(1, ...categoryBars.map((c) => c.views))

  // ------ Top articles with deltas ------
  const topArticlesEnriched = (topArticles.docs as unknown as ArticleRow[]).map((a, i) => {
    const fi = typeof a.featuredImage === 'object' ? a.featuredImage : null
    const cat = typeof a.category === 'object' ? a.category : null
    return {
      ...a,
      rank: i + 1,
      imageUrl: fi?.sizes?.thumbnail?.url || fi?.url || null,
      categoryName: cat?.name,
      categoryColor: cat?.color || '#c8a84e',
    }
  })

  // ------ Action items (things needing attention) ------
  const actions: { icon: string; label: string; href: string; tone: 'warning' | 'info' }[] = []
  if (articlesMissingImage.totalDocs > 0) {
    actions.push({
      icon: 'image',
      label: `${articlesMissingImage.totalDocs} مقال منشور بدون صورة رئيسية`,
      href: '/admin/collections/articles?where[status][equals]=published',
      tone: 'warning',
    })
  }
  if (draftCount.totalDocs > 0) {
    actions.push({
      icon: 'edit',
      label: `${draftCount.totalDocs} مسودة في انتظار المراجعة والنشر`,
      href: '/admin/collections/articles?where[status][equals]=draft',
      tone: 'info',
    })
  }
  if (breakingCount.totalDocs > 3) {
    actions.push({
      icon: 'alert',
      label: `${breakingCount.totalDocs} أخبار عاجلة نشطة — قد يكون العدد مبالغاً فيه`,
      href: '/admin/collections/articles?where[isBreaking][equals]=true',
      tone: 'warning',
    })
  }
  const emptyCategoriesCount = (
    categoriesResult.docs as unknown as Array<{ name: string }>
  ).filter((c) => !categoryBars.find((b) => b.name === c.name)).length
  if (emptyCategoriesCount > 0 && categoryBars.length > 0) {
    actions.push({
      icon: 'tag',
      label: `${emptyCategoriesCount} تصنيف لم يُسجَّل عليه مشاهدات هذا الشهر`,
      href: '/admin/collections/categories',
      tone: 'info',
    })
  }

  // ------ Hourly peak ------
  const peakHour = viewsByHour.indexOf(Math.max(...viewsByHour))
  const peakHourStr = `${peakHour.toString().padStart(2, '0')}:00`

  return {
    user: currentUser,
    now,
    kpi: {
      totalViews: {
        value: totalViewsCurrent,
        delta: viewsDelta,
        series: viewsByDay.map((p) => p.count),
      },
      published: {
        value: publishedCount.totalDocs,
        delta: articlesDelta,
        thisMonth: articlesRecent30d.totalDocs,
      },
      avgPerArticle: {
        value: publishedCount.totalDocs
          ? Math.round(totalViewsCurrent / Math.max(1, publishedCount.totalDocs))
          : 0,
      },
      peakHour: {
        value: peakHourStr,
      },
    },
    pipeline: {
      draft: draftCount.totalDocs,
      published: publishedCount.totalDocs,
      archived: archivedCount.totalDocs,
      breaking: breakingCount.totalDocs,
      featured: featuredCount.totalDocs,
    },
    viewsByDay,
    velocity,
    categoryBars,
    maxCatViews,
    topArticles: topArticlesEnriched,
    recent: (recentActivity.docs as unknown as ArticleRow[]).slice(0, 6),
    actions,
    userCount: usersCount.totalDocs,
    categoryCount: categoriesResult.totalDocs,
  }
}

function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function greeting(now: Date, userName: string | undefined): string {
  const h = now.getHours()
  const name = userName?.trim() || 'أهلاً بك'
  if (h < 5) return `ليلة هادئة، ${name}`
  if (h < 12) return `صباح الخير، ${name}`
  if (h < 17) return `نهارك سعيد، ${name}`
  if (h < 21) return `مساء الخير، ${name}`
  return `أمسية هادئة، ${name}`
}

function formatNum(n: number): string {
  return n.toLocaleString('en-US')
}

function formatDateShort(d: string | Date): string {
  const date = new Date(d)
  return date.toLocaleDateString('ar-EG-u-nu-latn', { day: '2-digit', month: 'short' })
}

function timeAgo(d: string | Date): string {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `منذ ${days} يوم`
  return new Date(d).toLocaleDateString('ar-EG-u-nu-latn', {
    day: 'numeric',
    month: 'short',
  })
}

// ==========================================================================
// SVG Chart primitives
// ==========================================================================
const AreaChart: React.FC<{
  data: number[]
  height?: number
  width?: number
}> = ({ data, height = 180, width = 720 }) => {
  if (data.length === 0) return null
  const max = Math.max(1, ...data)
  const stepX = width / Math.max(1, data.length - 1)
  const points = data.map((v, i) => [i * stepX, height - (v / max) * (height - 20) - 8])
  const pathLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const pathArea = `${pathLine} L ${width} ${height} L 0 ${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="iram-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8a84e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c8a84e" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={width}
          y1={height * f}
          y2={height * f}
          stroke="#e5e4e0"
          strokeDasharray="3,4"
          strokeWidth="1"
        />
      ))}
      <path d={pathArea} fill="url(#areaGrad)" />
      <path d={pathLine} fill="none" stroke="#c8a84e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {(() => {
        const last = points[points.length - 1]
        if (!last) return null
        return (
          <circle
            cx={last[0]}
            cy={last[1]}
            r="5"
            fill="#fff"
            stroke="#c8a84e"
            strokeWidth="2.5"
          />
        )
      })()}
    </svg>
  )
}

const Sparkline: React.FC<{ data: number[]; tone?: 'up' | 'down' | 'flat' }> = ({
  data,
  tone = 'up',
}) => {
  if (data.length === 0) return null
  const width = 90
  const height = 28
  const max = Math.max(1, ...data)
  const stepX = width / Math.max(1, data.length - 1)
  const pts = data.map((v, i) => `${i * stepX},${height - (v / max) * (height - 4) - 2}`).join(' ')
  const color =
    tone === 'up' ? '#059669' : tone === 'down' ? '#dc2626' : '#7d8b8f'
  return (
    <svg width={width} height={height} className="iram-sparkline">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const VelocityBars: React.FC<{ data: { date: string; count: number }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="iram-velocity">
      {data.map((d, i) => {
        const h = (d.count / max) * 100
        return (
          <div
            key={i}
            className="iram-velocity__bar"
            style={{ height: `${Math.max(3, h)}%` }}
            title={`${formatDateShort(d.date)}: ${d.count} مقالات`}
          >
            <span className="iram-velocity__bar-fill" />
          </div>
        )
      })}
    </div>
  )
}

// ==========================================================================
// Icons
// ==========================================================================
const I = {
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Eye: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>),
  Doc: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>),
  Avg: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="4 17 9 12 13 15 20 7" /></svg>),
  Clock: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>),
  Up: () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><polyline points="6 15 12 9 18 15" /></svg>),
  Down: () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>),
  Flame: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>),
  Alert: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>),
  Image: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>),
  Edit: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>),
  Tag: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /></svg>),
  Arrow: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>),
  Media: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>),
  Cat: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /></svg>),
  World: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>),
}

// ==========================================================================
// Sub-components
// ==========================================================================
const TrendBadge: React.FC<{ delta: number }> = ({ delta }) => {
  const tone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const sign = delta > 0 ? '+' : ''
  return (
    <span className={`iram-trend iram-trend--${tone}`}>
      {delta > 0 ? <I.Up /> : delta < 0 ? <I.Down /> : null}
      <span>{sign}{delta}%</span>
    </span>
  )
}

const ActionIcon: React.FC<{ icon: string }> = ({ icon }) => {
  switch (icon) {
    case 'image': return <I.Image />
    case 'edit': return <I.Edit />
    case 'alert': return <I.Alert />
    case 'tag': return <I.Tag />
    default: return <I.Edit />
  }
}

const ActivityIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'published') return <span className="iram-activity__dot iram-activity__dot--pub" />
  if (status === 'draft') return <span className="iram-activity__dot iram-activity__dot--draft" />
  return <span className="iram-activity__dot iram-activity__dot--arch" />
}

// ==========================================================================
// Main Component
// ==========================================================================
export const AnalyticsWidget: React.FC = async () => {
  const payload = await getPayload({ config })

  // Get current user — pick first admin if no request context.
  // The dashboard widget renders without a request body in some Payload
  // versions, so we fall back to the admin row.
  const user = await payload
    .find({ collection: 'users', where: { role: { equals: 'admin' } }, limit: 1 })
    .then((r) => (r.docs[0] as unknown as UserRow | undefined) ?? null)
    .catch(() => null)

  const stats = await getStats(user)

  return (
    <section className="iram-dash" dir="rtl">
      {/* HERO STRIP */}
      <header className="iram-dash__hero">
        <div className="iram-dash__hero-content">
          <p className="iram-dash__hero-label">لوحة التحكم الإدارية</p>
          <h1 className="iram-dash__hero-title">
            {greeting(stats.now, user?.name || 'أهلاً')}
          </h1>
          <p className="iram-dash__hero-subtitle">
            إليك ملخص أداء المحتوى خلال آخر 30 يوماً
          </p>
        </div>
        <div className="iram-dash__hero-cta">
          <a
            href="/admin/collections/articles/create"
            className="iram-btn iram-btn--primary"
          >
            <I.Plus />
            <span>مقال جديد</span>
          </a>
          <a href="/admin/collections/media" className="iram-btn iram-btn--ghost">
            <I.Media />
            <span>رفع وسائط</span>
          </a>
          <a href="/admin/stats" className="iram-btn iram-btn--ghost">
            <span aria-hidden>📊</span>
            <span>الإحصائيات الاحترافية</span>
          </a>
          <a href="/" className="iram-btn iram-btn--ghost" target="_blank" rel="noopener">
            <I.World />
            <span>عرض الموقع</span>
          </a>
        </div>
      </header>

      {/* KPI CARDS */}
      <div className="iram-dash__kpis">
        <div className="iram-kpi">
          <div className="iram-kpi__head">
            <span className="iram-kpi__icon iram-kpi__icon--info"><I.Eye /></span>
            <span className="iram-kpi__label">المشاهدات — 30 يوماً</span>
          </div>
          <div className="iram-kpi__row">
            <span className="iram-kpi__value">{formatNum(stats.kpi.totalViews.value)}</span>
            <TrendBadge delta={stats.kpi.totalViews.delta} />
          </div>
          <div className="iram-kpi__spark">
            <Sparkline
              data={stats.kpi.totalViews.series}
              tone={stats.kpi.totalViews.delta >= 0 ? 'up' : 'down'}
            />
          </div>
        </div>

        <div className="iram-kpi">
          <div className="iram-kpi__head">
            <span className="iram-kpi__icon iram-kpi__icon--success"><I.Doc /></span>
            <span className="iram-kpi__label">المقالات المنشورة</span>
          </div>
          <div className="iram-kpi__row">
            <span className="iram-kpi__value">{formatNum(stats.kpi.published.value)}</span>
            <TrendBadge delta={stats.kpi.published.delta} />
          </div>
          <div className="iram-kpi__hint">
            {formatNum(stats.kpi.published.thisMonth)} مقال نُشر هذا الشهر
          </div>
        </div>

        <div className="iram-kpi">
          <div className="iram-kpi__head">
            <span className="iram-kpi__icon iram-kpi__icon--gold"><I.Avg /></span>
            <span className="iram-kpi__label">متوسط القراءة لكل مقال</span>
          </div>
          <div className="iram-kpi__row">
            <span className="iram-kpi__value">{formatNum(stats.kpi.avgPerArticle.value)}</span>
          </div>
          <div className="iram-kpi__hint">مشاهدة / مقال خلال آخر 30 يوماً</div>
        </div>

        <div className="iram-kpi">
          <div className="iram-kpi__head">
            <span className="iram-kpi__icon iram-kpi__icon--warning"><I.Clock /></span>
            <span className="iram-kpi__label">ساعة الذروة للقراء</span>
          </div>
          <div className="iram-kpi__row">
            <span className="iram-kpi__value iram-kpi__value--sm">{stats.kpi.peakHour.value}</span>
          </div>
          <div className="iram-kpi__hint">
            أفضل وقت لنشر المقالات الجديدة
          </div>
        </div>
      </div>

      {/* TRAFFIC CHART + PIPELINE */}
      <div className="iram-dash__row iram-dash__row--2-1">
        <div className="iram-panel">
          <div className="iram-panel__head">
            <div>
              <h3 className="iram-panel__title">حركة القراء اليومية</h3>
              <p className="iram-panel__subtitle">إجمالي المشاهدات يومياً خلال آخر 30 يوماً</p>
            </div>
          </div>
          <div className="iram-panel__chart">
            <AreaChart data={stats.kpi.totalViews.series} />
            <div className="iram-chart__x">
              {[0, 14, 29].map((i) => {
                const point = stats.viewsByDay[i]
                return point ? <span key={i}>{formatDateShort(point.date)}</span> : null
              })}
            </div>
          </div>
        </div>

        <div className="iram-panel">
          <div className="iram-panel__head">
            <div>
              <h3 className="iram-panel__title">خط إنتاج المحتوى</h3>
              <p className="iram-panel__subtitle">الحالة الحالية للمقالات في النظام</p>
            </div>
          </div>
          <div className="iram-pipeline">
            <a href="/admin/collections/articles?where[status][equals]=draft" className="iram-pipeline__stage iram-pipeline__stage--draft">
              <div className="iram-pipeline__count">{stats.pipeline.draft}</div>
              <div className="iram-pipeline__label">مسودة</div>
            </a>
            <div className="iram-pipeline__arrow"><I.Arrow /></div>
            <a href="/admin/collections/articles?where[status][equals]=published" className="iram-pipeline__stage iram-pipeline__stage--pub">
              <div className="iram-pipeline__count">{stats.pipeline.published}</div>
              <div className="iram-pipeline__label">منشور</div>
            </a>
            <div className="iram-pipeline__arrow"><I.Arrow /></div>
            <a href="/admin/collections/articles?where[status][equals]=archived" className="iram-pipeline__stage iram-pipeline__stage--arch">
              <div className="iram-pipeline__count">{stats.pipeline.archived}</div>
              <div className="iram-pipeline__label">مؤرشف</div>
            </a>
          </div>
          <div className="iram-pipeline__meta">
            <div className="iram-pipeline__meta-item">
              <span className="iram-badge iram-badge--danger">{stats.pipeline.breaking}</span>
              <span>خبر عاجل</span>
            </div>
            <div className="iram-pipeline__meta-item">
              <span className="iram-badge iram-badge--gold">{stats.pipeline.featured}</span>
              <span>مميّز</span>
            </div>
            <div className="iram-pipeline__meta-item">
              <span className="iram-badge">{stats.userCount}</span>
              <span>مستخدم</span>
            </div>
            <div className="iram-pipeline__meta-item">
              <span className="iram-badge">{stats.categoryCount}</span>
              <span>تصنيف</span>
            </div>
          </div>
        </div>
      </div>

      {/* TOP ARTICLES + CATEGORY BARS */}
      <div className="iram-dash__row iram-dash__row--2-1">
        <div className="iram-panel">
          <div className="iram-panel__head">
            <div>
              <h3 className="iram-panel__title"><I.Flame /> الأكثر قراءة</h3>
              <p className="iram-panel__subtitle">أفضل 5 مقالات حسب إجمالي المشاهدات</p>
            </div>
            <a href="/admin/collections/articles?sort=-views" className="iram-panel__link">عرض الكل</a>
          </div>
          <div className="iram-top-list">
            {stats.topArticles.length === 0 ? (
              <div className="iram-empty">لا توجد مقالات منشورة بعد</div>
            ) : (
              stats.topArticles.map((a) => (
                <a key={a.id} href={`/admin/collections/articles/${a.id}`} className="iram-top-row">
                  <span className={`iram-top-row__rank${a.rank <= 3 ? ' iram-top-row__rank--gold' : ''}`}>
                    {a.rank}
                  </span>
                  {a.imageUrl ? (
                    <img src={a.imageUrl} alt="" className="iram-top-row__thumb" />
                  ) : (
                    <div className="iram-top-row__thumb iram-top-row__thumb--empty"><I.Image /></div>
                  )}
                  <div className="iram-top-row__body">
                    <div className="iram-top-row__title">{a.title}</div>
                    <div className="iram-top-row__meta">
                      {a.categoryName && (
                        <span
                          className="iram-cat-pill"
                          style={{ background: `${a.categoryColor}20`, color: a.categoryColor }}
                        >
                          {a.categoryName}
                        </span>
                      )}
                      <span className="iram-top-row__views">
                        <I.Eye />
                        <span>{formatNum(a.views || 0)}</span>
                      </span>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        <div className="iram-panel">
          <div className="iram-panel__head">
            <div>
              <h3 className="iram-panel__title">أداء التصنيفات</h3>
              <p className="iram-panel__subtitle">المشاهدات حسب التصنيف — 30 يوم</p>
            </div>
          </div>
          <div className="iram-catbars">
            {stats.categoryBars.length === 0 ? (
              <div className="iram-empty">لا توجد بيانات بعد</div>
            ) : (
              stats.categoryBars.map((c, i) => {
                const pct = (c.views / stats.maxCatViews) * 100
                return (
                  <div key={i} className="iram-catbar">
                    <div className="iram-catbar__row">
                      <span
                        className="iram-catbar__dot"
                        style={{ background: c.color }}
                      />
                      <span className="iram-catbar__name">{c.name}</span>
                      <span className="iram-catbar__val">{formatNum(c.views)}</span>
                    </div>
                    <div className="iram-catbar__track">
                      <div
                        className="iram-catbar__fill"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${c.color}cc, ${c.color})`,
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* VELOCITY + ACTIONS + ACTIVITY */}
      <div className="iram-dash__row iram-dash__row--3">
        <div className="iram-panel iram-panel--span-2">
          <div className="iram-panel__head">
            <div>
              <h3 className="iram-panel__title">وتيرة النشر</h3>
              <p className="iram-panel__subtitle">عدد المقالات المنشورة يومياً — 30 يوم</p>
            </div>
          </div>
          <VelocityBars data={stats.velocity} />
        </div>

        <div className="iram-panel">
          <div className="iram-panel__head">
            <div>
              <h3 className="iram-panel__title">مهام تحتاج انتباهك</h3>
              <p className="iram-panel__subtitle">{stats.actions.length} عنصر</p>
            </div>
          </div>
          {stats.actions.length === 0 ? (
            <div className="iram-empty iram-empty--success">
              ✓ كل شيء على ما يرام — لا توجد مهام عالقة
            </div>
          ) : (
            <ul className="iram-actions">
              {stats.actions.map((a, i) => (
                <li key={i} className={`iram-actions__item iram-actions__item--${a.tone}`}>
                  <a href={a.href}>
                    <span className="iram-actions__icon"><ActionIcon icon={a.icon} /></span>
                    <span className="iram-actions__text">{a.label}</span>
                    <span className="iram-actions__arrow"><I.Arrow /></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ACTIVITY FEED */}
      <div className="iram-panel">
        <div className="iram-panel__head">
          <div>
            <h3 className="iram-panel__title">النشاط الأخير</h3>
            <p className="iram-panel__subtitle">آخر تعديلات على المقالات</p>
          </div>
          <a href="/admin/collections/articles?sort=-updatedAt" className="iram-panel__link">عرض الكل</a>
        </div>
        <ul className="iram-activity">
          {stats.recent.length === 0 ? (
            <div className="iram-empty">لا يوجد نشاط بعد</div>
          ) : (
            stats.recent.map((a) => (
              <li key={a.id} className="iram-activity__item">
                <ActivityIcon status={a.status} />
                <a href={`/admin/collections/articles/${a.id}`} className="iram-activity__title">
                  {a.title}
                </a>
                <span className="iram-activity__status">
                  {a.status === 'published' ? 'منشور' : a.status === 'draft' ? 'مسودة' : 'مؤرشف'}
                </span>
                <span className="iram-activity__time">{timeAgo(a.updatedAt)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  )
}

export default AnalyticsWidget
