import React from 'react'
import type { AdminViewServerProps } from 'payload'

import { UserRole } from '@/domain/enums'
import { fetchSiteAnalytics, rollupLastN, type SiteAnalytics } from '@/lib/cloudflare-analytics'
import {
  getArticleCounts,
  getAuthorLeaderboard,
  getCategoryDistribution,
  getDailyPublishCounts,
  getDataQuality,
  getDowActivity,
  getStatusBreakdown,
  getTagFrequencies,
  getTimeToPublish,
  getTopArticles,
  getViewStats,
  type AuthorStat,
  type CategoryStat,
  type DailyPublishCount,
  type DataQuality,
  type DowActivity,
  type StatusBreakdown,
  type TagFreq,
  type TopArticle,
} from '@/lib/stats/queries'
import './StatsView.scss'

const CF_WINDOW_DAYS = 14

const fmt = (n: number) => n.toLocaleString('en-US')

interface CloudflareEnv {
  hasToken: boolean
  hasAccount: boolean
  hasSiteTag: boolean
}

function readCloudflareEnv(): CloudflareEnv {
  return {
    hasToken: Boolean(process.env.CF_ANALYTICS_API_TOKEN),
    hasAccount: Boolean(process.env.CF_ACCOUNT_ID),
    hasSiteTag: Boolean(process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN),
  }
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * Custom Payload admin view: full-page editorial + audience stats.
 * Renders at /admin/stats. Server component — all DB queries happen
 * here once per render and are cached for 60 seconds.
 */
export default async function StatsView({ initPageResult }: AdminViewServerProps) {
  const user = initPageResult?.req?.user as { role?: string; name?: string; email?: string } | null

  const allowed = user && (user.role === UserRole.Admin || user.role === UserRole.Editor)
  if (!allowed) {
    return (
      <div className="iram-stats" dir="rtl">
        <div className="iram-stats__locked">
          <h1>غير مصرّح</h1>
          <p>صفحة الإحصائيات الاحترافية متاحة للمدير والمحرّر فقط.</p>
        </div>
      </div>
    )
  }

  const cf = readCloudflareEnv()
  const renderedAt = new Date()
  const cfWindowStart = new Date(renderedAt.getTime() - CF_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [counts, top, authors, cats, daily, status, views, ttp, dow, tags, quality, cfAnalytics] =
    await Promise.all([
      getArticleCounts(),
      getTopArticles(10),
      getAuthorLeaderboard(10),
      getCategoryDistribution(),
      getDailyPublishCounts(30),
      getStatusBreakdown(),
      getViewStats(),
      getTimeToPublish(),
      getDowActivity(12),
      getTagFrequencies(30),
      getDataQuality(),
      cf.hasToken && cf.hasAccount && cf.hasSiteTag
        ? fetchSiteAnalytics({
            since: cfWindowStart.toISOString(),
            until: renderedAt.toISOString(),
          })
        : Promise.resolve(null),
    ])

  return (
    <div className="iram-stats" dir="rtl">
      {/* === Header === */}
      <header className="iram-stats__header">
        <div>
          <h1 className="iram-stats__title">الإحصائيات الاحترافية</h1>
          <p className="iram-stats__subtitle">
            لوحة شاملة لأداء المحتوى والجمهور — يُعاد حساب كل شيء كل دقيقة.
          </p>
        </div>
        <RefreshBadge renderedAt={renderedAt} />
      </header>

      {/* === SECTION 1: SNAPSHOT — KPIs with trends === */}
      <Section title="📊 لمحة سريعة" subtitle="الأرقام الأهم مع اتجاه التغيّر مقابل الفترة السابقة">
        <div className="iram-stats__kpis">
          <Kpi emoji="📅" label="منشور اليوم" value={counts.publishedToday} />
          <Kpi
            emoji="🗓️"
            label="هذا الأسبوع"
            value={counts.publishedThisWeek}
            trend={pctChange(counts.publishedThisWeek, counts.publishedLastWeek)}
            trendLabel="مقابل الأسبوع الماضي"
          />
          <Kpi
            emoji="📆"
            label="هذا الشهر"
            value={counts.publishedThisMonth}
            spark={daily.slice(-30).map((d) => d.count)}
          />
          <Kpi emoji="📰" label="إجمالي المنشور" value={counts.publishedTotal} tone="accent" />
          <Kpi emoji="👁️" label="إجمالي المشاهدات" value={counts.totalViews} tone="accent" />
          <Kpi
            emoji="⏳"
            label="قيد المراجعة"
            value={counts.awaitingReview}
            tone={counts.awaitingReview > 5 ? 'warn' : undefined}
          />
          <Kpi emoji="✏️" label="مسودات" value={counts.draftCount} />
          <Kpi emoji="🚨" label="عاجل حالياً" value={counts.breakingCount} />
        </div>
      </Section>

      {/* === SECTION 2: AUDIENCE (Cloudflare placeholder) === */}
      <Section
        title="🌍 الجمهور والزيارات (Cloudflare)"
        subtitle="عدد الزوار الفعليين عبر Cloudflare Analytics"
      >
        {cfAnalytics ? (
          <CloudflareConnectedPanel data={cfAnalytics} />
        ) : cf.hasToken && cf.hasAccount && cf.hasSiteTag ? (
          <CloudflareErrorPanel />
        ) : (
          <CloudflarePending env={cf} />
        )}
      </Section>

      {/* === SECTION 3: PERFORMANCE — top articles + authors === */}
      <Section title="🏆 الأداء" subtitle="أكثر المقالات قراءةً والكتّاب الأعلى تأثيراً">
        <div className="iram-stats__metrics-row">
          <MiniMetric
            emoji="📊"
            label="متوسط المشاهدات"
            value={fmt(views.mean)}
            sub={`الوسيط: ${fmt(views.median)}`}
          />
          <MiniMetric emoji="🔥" label="أعلى مقال مشاهدةً" value={fmt(views.max)} sub="مشاهدات" />
          <MiniMetric
            emoji="⏱️"
            label="متوسط وقت النشر"
            value={ttp.medianHours != null ? `${ttp.medianHours} ساعة` : '—'}
            sub={ttp.avgHours != null ? `المتوسط: ${ttp.avgHours} س` : 'من المسودة إلى النشر'}
          />
        </div>

        <div className="iram-stats__row iram-stats__row--gapped">
          <div className="iram-stats__panel">
            <h3 className="iram-stats__panel-title">أكثر المقالات قراءةً</h3>
            <TopArticlesList items={top} />
          </div>

          <div className="iram-stats__panel">
            <h3 className="iram-stats__panel-title">ترتيب الكتّاب</h3>
            <AuthorsList items={authors} />
          </div>
        </div>
      </Section>

      {/* === SECTION 4: DISTRIBUTION — categories + status + tags === */}
      <Section title="📁 التوزيع" subtitle="كيف يتوزّع المحتوى عبر التصنيفات والحالات والوسوم">
        <div className="iram-stats__row iram-stats__row--gapped">
          <div className="iram-stats__panel iram-stats__panel--narrow">
            <h3 className="iram-stats__panel-title">حالة المقالات</h3>
            <StatusDonut status={status} />
          </div>

          <div className="iram-stats__panel">
            <h3 className="iram-stats__panel-title">التصنيفات</h3>
            <CategoriesBars items={cats} />
          </div>
        </div>

        {tags.length > 0 && (
          <div className="iram-stats__panel" style={{ marginTop: 16 }}>
            <h3 className="iram-stats__panel-title">سحابة الوسوم</h3>
            <TagCloud items={tags} />
          </div>
        )}
      </Section>

      {/* === SECTION 5: ACTIVITY — daily + day-of-week === */}
      <Section title="📈 النشاط" subtitle="إيقاع النشر اليومي والأسبوعي">
        <div className="iram-stats__panel">
          <h3 className="iram-stats__panel-title">إيقاع النشر — آخر ٣٠ يوماً</h3>
          <DailySpark items={daily} />
        </div>

        <div className="iram-stats__panel" style={{ marginTop: 16 }}>
          <h3 className="iram-stats__panel-title">خريطة النشاط الأسبوعي — آخر ١٢ أسبوعاً</h3>
          <DowHeatmap items={dow} />
        </div>
      </Section>

      {/* === SECTION 6: OPERATIONS — quality + health === */}
      <Section title="🛠️ التشغيل" subtitle="جودة البيانات وحالة النظام">
        <div className="iram-stats__row iram-stats__row--gapped">
          <div className="iram-stats__panel">
            <h3 className="iram-stats__panel-title">جودة البيانات</h3>
            <QualityList items={quality} />
          </div>

          <div className="iram-stats__panel">
            <h3 className="iram-stats__panel-title">حالة النظام</h3>
            <HealthGrid />
          </div>
        </div>
      </Section>
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="iram-stats__section">
      <div className="iram-stats__section-head">
        <h2 className="iram-stats__section-title">{title}</h2>
        {subtitle && <p className="iram-stats__section-subtitle">{subtitle}</p>}
      </div>
      <div className="iram-stats__section-body">{children}</div>
    </section>
  )
}

function RefreshBadge({ renderedAt }: { renderedAt: Date }) {
  const time = renderedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="iram-stats__refresh">
      <span className="iram-stats__refresh-dot" aria-hidden />
      <span>محدَّث الساعة {time}</span>
    </div>
  )
}

interface KpiProps {
  emoji: string
  label: string
  value: number
  tone?: 'accent' | 'warn'
  trend?: number | null
  trendLabel?: string
  spark?: number[]
}

function Kpi({ emoji, label, value, tone, trend, trendLabel, spark }: KpiProps) {
  return (
    <div className={`iram-kpi${tone ? ` iram-kpi--${tone}` : ''}`}>
      <div className="iram-kpi__top">
        <span className="iram-kpi__icon" aria-hidden>
          {emoji}
        </span>
        {trend != null && <TrendBadge value={trend} label={trendLabel} />}
      </div>
      <span className="iram-kpi__label">{label}</span>
      <span className="iram-kpi__value">{fmt(value)}</span>
      {spark && spark.length > 0 && <KpiSpark data={spark} />}
    </div>
  )
}

function TrendBadge({ value, label }: { value: number; label?: string }) {
  const tone = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→'
  const display = `${arrow} ${Math.abs(value)}%`
  return (
    <span className={`iram-trend iram-trend--${tone}`} title={label}>
      {display}
    </span>
  )
}

function KpiSpark({ data }: { data: number[] }) {
  if (data.every((d) => d === 0)) {
    return <div className="iram-kpi__spark iram-kpi__spark--empty">—</div>
  }
  const max = Math.max(1, ...data)
  return (
    <div className="iram-kpi__spark" aria-hidden>
      {data.map((d, i) => (
        <span key={i} className="iram-kpi__spark-bar" style={{ height: `${(d / max) * 100}%` }} />
      ))}
    </div>
  )
}

function MiniMetric({
  emoji,
  label,
  value,
  sub,
}: {
  emoji: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="iram-mini">
      <span className="iram-mini__emoji" aria-hidden>
        {emoji}
      </span>
      <div className="iram-mini__body">
        <span className="iram-mini__label">{label}</span>
        <span className="iram-mini__value">{value}</span>
        {sub && <span className="iram-mini__sub">{sub}</span>}
      </div>
    </div>
  )
}

function TopArticlesList({ items }: { items: TopArticle[] }) {
  if (items.length === 0) return <p className="iram-stats__empty">لا توجد مقالات منشورة بعد.</p>
  return (
    <ol className="iram-stats__rank">
      {items.map((a, i) => (
        <li key={a.id} className="iram-stats__rank-item">
          <span className="iram-stats__rank-num">{fmt(i + 1)}</span>
          <a href={`/admin/collections/articles/${a.id}`} className="iram-stats__rank-title">
            {a.title}
          </a>
          <span className="iram-stats__rank-views">
            <span aria-hidden>👁️</span> {fmt(a.views)}
          </span>
        </li>
      ))}
    </ol>
  )
}

function AuthorsList({ items }: { items: AuthorStat[] }) {
  if (items.length === 0) return <p className="iram-stats__empty">لا يوجد كتّاب نشرت لهم مقالات.</p>
  return (
    <ol className="iram-stats__rank">
      {items.map((a, i) => (
        <li key={a.id} className="iram-stats__rank-item">
          <span className="iram-stats__rank-num">{fmt(i + 1)}</span>
          <span className="iram-stats__rank-title">{a.name}</span>
          <span className="iram-stats__rank-double">
            <span>{fmt(a.articles)} مقال</span>
            <span className="iram-stats__rank-sub">{fmt(a.totalViews)} مشاهدة</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function CategoriesBars({ items }: { items: CategoryStat[] }) {
  const max = Math.max(1, ...items.map((c) => c.count))
  if (items.length === 0) return <p className="iram-stats__empty">لا توجد تصنيفات بعد.</p>
  return (
    <div className="iram-stats__bars">
      {items.map((c) => (
        <div key={c.id} className="iram-stats__bar-row">
          <span
            className="iram-stats__bar-label"
            style={c.color ? { borderInlineStart: `4px solid ${c.color}` } : undefined}
          >
            {c.name}
          </span>
          <div className="iram-stats__bar-track">
            <div
              className="iram-stats__bar-fill"
              style={{
                width: `${(c.count / max) * 100}%`,
                background: c.color || '#c8a84e',
              }}
            />
          </div>
          <span className="iram-stats__bar-count">{fmt(c.count)}</span>
        </div>
      ))}
    </div>
  )
}

function StatusDonut({ status }: { status: StatusBreakdown }) {
  const segments = [
    { key: 'published', label: 'منشور', value: status.published, color: '#16a34a' },
    { key: 'draft', label: 'مسودة', value: status.draft, color: '#9ca3af' },
    { key: 'inReview', label: 'قيد المراجعة', value: status.inReview, color: '#f59e0b' },
    { key: 'archived', label: 'مؤرشف', value: status.archived, color: '#6b7280' },
  ]
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <p className="iram-stats__empty">لا توجد بيانات.</p>

  // Build SVG arcs
  const RADIUS = 60
  const STROKE = 18
  const CIRC = 2 * Math.PI * RADIUS
  let cumulative = 0
  const parts = segments.map((seg) => {
    const len = (seg.value / total) * CIRC
    const offset = cumulative
    cumulative += len
    return { ...seg, len, offset }
  })

  return (
    <div className="iram-donut">
      <svg viewBox="0 0 160 160" className="iram-donut__svg" aria-hidden>
        <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#f0eee6" strokeWidth={STROKE} />
        {parts.map((p) => (
          <circle
            key={p.key}
            cx="80"
            cy="80"
            r={RADIUS}
            fill="none"
            stroke={p.color}
            strokeWidth={STROKE}
            strokeDasharray={`${p.len} ${CIRC - p.len}`}
            strokeDashoffset={-p.offset}
            transform="rotate(-90 80 80)"
          />
        ))}
        <text
          x="80"
          y="76"
          textAnchor="middle"
          fontSize="22"
          fontWeight="800"
          fill="#0a2a2f"
          fontFamily="var(--font-kufi), sans-serif"
        >
          {fmt(total)}
        </text>
        <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#6b7280">
          المجموع
        </text>
      </svg>
      <ul className="iram-donut__legend">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <li key={s.key}>
              <span className="iram-donut__swatch" style={{ background: s.color }} />
              <span className="iram-donut__label">{s.label}</span>
              <span className="iram-donut__count">{fmt(s.value)}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

function DailySpark({ items }: { items: DailyPublishCount[] }) {
  const max = Math.max(1, ...items.map((d) => d.count))
  return (
    <div className="iram-stats__spark">
      <div className="iram-stats__spark-track">
        {items.map((d) => (
          <div key={d.day} className="iram-stats__spark-col" title={`${d.day}: ${d.count} مقال`}>
            <div
              className="iram-stats__spark-bar"
              style={{ height: `${(d.count / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="iram-stats__spark-meta">
        <span>{items[0]?.day}</span>
        <span>{items[items.length - 1]?.day}</span>
      </div>
    </div>
  )
}

function DowHeatmap({ items }: { items: DowActivity[] }) {
  // Build a grid: rows = days of week (Sun=0 → Sat=6), cols = weeks chronologically
  const weeks = Array.from(new Set(items.map((i) => i.week))).sort()
  if (weeks.length === 0) {
    return <p className="iram-stats__empty">لا توجد بيانات نشاط بعد.</p>
  }
  const max = Math.max(1, ...items.map((i) => i.count))
  const lookup = new Map<string, number>()
  for (const it of items) lookup.set(`${it.week}:${it.dow}`, it.count)

  const dowLabels = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const dowOrder = [0, 1, 2, 3, 4, 5, 6]

  return (
    <div className="iram-heatmap" dir="ltr">
      {dowOrder.map((dow) => (
        <div key={dow} className="iram-heatmap__row">
          <span className="iram-heatmap__row-label">{dowLabels[dow]}</span>
          <div className="iram-heatmap__cells">
            {weeks.map((wk) => {
              const v = lookup.get(`${wk}:${dow}`) ?? 0
              const intensity = v === 0 ? 0 : Math.max(0.15, v / max)
              return (
                <span
                  key={wk}
                  className="iram-heatmap__cell"
                  style={{
                    background: v === 0 ? '#f0eee6' : `rgba(200, 168, 78, ${intensity.toFixed(2)})`,
                  }}
                  title={`${wk} — ${dowLabels[dow]}: ${v} مقال`}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function TagCloud({ items }: { items: TagFreq[] }) {
  const max = Math.max(1, ...items.map((t) => t.count))
  return (
    <div className="iram-tag-cloud">
      {items.map((t) => {
        const weight = t.count / max
        const fontSize = 11 + weight * 12 // 11 → 23 px
        const opacity = 0.55 + weight * 0.45
        return (
          <a
            key={t.tag}
            href={`/admin/collections/articles?where[tags.tag][equals]=${encodeURIComponent(t.tag)}`}
            className="iram-tag-cloud__item"
            style={{ fontSize: `${fontSize}px`, opacity }}
            title={`${t.count} مقال`}
          >
            {t.tag}
            <span className="iram-tag-cloud__count">{t.count}</span>
          </a>
        )
      })}
    </div>
  )
}

function QualityList({ items }: { items: DataQuality }) {
  if (items.totalPublished === 0) {
    return <p className="iram-stats__empty">لا توجد مقالات منشورة لتقييم جودتها.</p>
  }
  const rows = [
    {
      label: 'بدون صورة رئيسية',
      value: items.noImage,
      fix: 'أضف صورة لكل مقال — مهم للـ SEO وللمشاركات.',
    },
    {
      label: 'بدون تصنيف',
      value: items.noCategory,
      fix: 'صنّف كل مقال — يساعد في العرض والتصفّح.',
    },
    {
      label: 'بدون وسوم',
      value: items.noTags,
      fix: 'أضف وسوماً تصف المحتوى — تحسّن البحث والاكتشاف.',
    },
    { label: 'بدون مقتطف', value: items.noExcerpt, fix: 'اكتب مقتطفاً (٢-٣ أسطر) لكل مقال.' },
  ]
  return (
    <ul className="iram-quality">
      {rows.map((r) => {
        const pct =
          items.totalPublished > 0 ? Math.round((r.value / items.totalPublished) * 100) : 0
        const tone = r.value === 0 ? 'good' : pct < 10 ? 'warn' : 'bad'
        return (
          <li key={r.label} className={`iram-quality__row iram-quality__row--${tone}`}>
            <div className="iram-quality__head">
              <span className="iram-quality__label">{r.label}</span>
              <span className="iram-quality__count">
                {fmt(r.value)} / {fmt(items.totalPublished)} ({pct}%)
              </span>
            </div>
            {r.value > 0 && <span className="iram-quality__fix">{r.fix}</span>}
          </li>
        )
      })}
    </ul>
  )
}

function HealthGrid() {
  return (
    <div className="iram-stats__health">
      <HealthRow label="حالة الموقع" value="✅ يعمل بشكل طبيعي" />
      <HealthRow label="آخر تحديث" value={new Date().toLocaleString('en-GB')} />
      <HealthRow label="بيئة التشغيل" value={process.env.NODE_ENV ?? '—'} />
      <HealthRow label="إصدار Node" value={process.versions?.node ?? '—'} />
    </div>
  )
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="iram-stats__health-row">
      <span className="iram-stats__health-label">{label}</span>
      <span className="iram-stats__health-value">{value}</span>
    </div>
  )
}

// ---------- Cloudflare audience section (B) ----------

function CloudflareConnectedPanel({ data }: { data: SiteAnalytics }) {
  // Pageviews "today" = the most recent bucket in the time series IF that
  // bucket's date matches today's UTC date. The Cloudflare RUM dataset
  // groups by UTC date — using the local-time today would shift one day
  // off for editors in IL (UTC+2/+3). When CF hasn't received any
  // pageloads yet today the bucket simply won't exist and we surface 0.
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayEntry = data.timeSeries.find((point) => point.date.startsWith(todayKey))
  const todayPageviews = todayEntry?.views ?? 0
  const todayVisitors = todayEntry?.visitors ?? 0
  const week = rollupLastN(data.timeSeries, 7)

  const hasAnyData = data.pageviews > 0 || data.timeSeries.length > 0

  if (!hasAnyData) {
    return (
      <div className="iram-stats__cf iram-stats__cf--connected">
        <p>
          🟢 ربط Cloudflare Analytics مفعّل والإعدادات صحيحة، لكن لا توجد بيانات زوّار حتى الآن خلال
          آخر {CF_WINDOW_DAYS} يوماً. بعد أن يبدأ القرّاء بزيارة الموقع، ستظهر هنا الأرقام تلقائياً.
        </p>
      </div>
    )
  }

  return (
    <div className="iram-stats__cf iram-stats__cf--connected">
      <div className="iram-stats__cf-kpis">
        <CfKpi emoji="👁️" label="مشاهدات اليوم" value={todayPageviews} />
        <CfKpi emoji="🧑‍💻" label="زوّار اليوم" value={todayVisitors} />
        <CfKpi emoji="📅" label="مشاهدات الأسبوع" value={week.views} />
        <CfKpi emoji="🌐" label="زوّار الأسبوع" value={week.visitors} />
      </div>

      <div className="iram-stats__cf-grid">
        <CfTopList
          title={`أكثر الصفحات زيارة (${CF_WINDOW_DAYS} يوماً)`}
          items={data.topPaths.map((p) => ({ label: p.path, value: p.views }))}
          emptyLabel="لا توجد بيانات صفحات بعد."
        />
        <CfTopList
          title={`أبرز المصادر (${CF_WINDOW_DAYS} يوماً)`}
          items={data.topReferrers.map((r) => ({ label: r.referrer, value: r.views }))}
          emptyLabel="لا توجد إحالات بعد — معظم الزيارات مباشرة."
        />
      </div>

      <CfTrendChart
        title={`اتجاه الزيارات اليومي (آخر ${CF_WINDOW_DAYS} يوماً)`}
        series={data.timeSeries}
      />

      <p className="iram-stats__cf-note">
        البيانات من Cloudflare Web Analytics، تُحدَّث كل خمس دقائق (تخزين مؤقت في الخادم).
      </p>
    </div>
  )
}

function CfKpi({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <div className="iram-cf-kpi">
      <span className="iram-cf-kpi__icon" aria-hidden>
        {emoji}
      </span>
      <span className="iram-cf-kpi__label">{label}</span>
      <span className="iram-cf-kpi__value">{fmt(value)}</span>
    </div>
  )
}

function CfTopList({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: Array<{ label: string; value: number }>
  emptyLabel: string
}) {
  if (items.length === 0) {
    return (
      <div className="iram-cf-toplist">
        <h4>{title}</h4>
        <p className="iram-stats__empty">{emptyLabel}</p>
      </div>
    )
  }
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="iram-cf-toplist">
      <h4>{title}</h4>
      <ol>
        {items.map((entry, idx) => (
          <li key={`${entry.label}-${idx}`}>
            <span className="iram-cf-toplist__label" title={entry.label}>
              {entry.label}
            </span>
            <div className="iram-cf-toplist__track" aria-hidden>
              <div
                className="iram-cf-toplist__fill"
                style={{ width: `${(entry.value / max) * 100}%` }}
              />
            </div>
            <span className="iram-cf-toplist__count">{fmt(entry.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function CfTrendChart({ title, series }: { title: string; series: SiteAnalytics['timeSeries'] }) {
  if (series.length === 0) {
    return (
      <div className="iram-cf-trend">
        <h4>{title}</h4>
        <p className="iram-stats__empty">لا توجد بيانات يومية بعد.</p>
      </div>
    )
  }
  const max = Math.max(1, ...series.map((p) => p.views))
  return (
    <div className="iram-cf-trend">
      <h4>{title}</h4>
      <div className="iram-cf-trend__bars" aria-hidden>
        {series.map((point) => (
          <div
            key={point.date}
            className="iram-cf-trend__col"
            title={`${point.date} · ${fmt(point.views)}`}
          >
            <span
              className="iram-cf-trend__bar"
              style={{ height: `${(point.views / max) * 100}%` }}
            />
            <span className="iram-cf-trend__date">{point.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CloudflareErrorPanel() {
  return (
    <div className="iram-stats__cf">
      <p>
        ⚠️ ربط Cloudflare Analytics مفعّل لكن تعذّر جلب البيانات حالياً. قد يكون السبب انقطاعاً
        مؤقتاً لدى Cloudflare، أو أنّ Token المُدخَل لا يحمل صلاحية &quot;Account Analytics:
        Read&quot;. راجِع{' '}
        <a
          href="https://dash.cloudflare.com/profile/api-tokens"
          target="_blank"
          rel="noopener noreferrer"
        >
          إعدادات الـ Tokens
        </a>{' '}
        وأعِد تحميل الصفحة بعد دقيقة.
      </p>
    </div>
  )
}

function CloudflarePending({ env }: { env: CloudflareEnv }) {
  return (
    <div className="iram-stats__cf">
      <p>
        🔌 ربط Cloudflare Analytics غير مفعّل بعد. عند تفعيله ستظهر هنا أرقام الزوار الفعليين (اليوم
        / هذا الأسبوع / هذا الشهر / الإجمالي) وأكثر المقالات زيارة عبر Cloudflare.
      </p>
      <details className="iram-stats__cf-howto">
        <summary>خطوات التفعيل</summary>
        <ol>
          <li>
            من{' '}
            <a
              href="https://dash.cloudflare.com/profile/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cloudflare → Profile → API Tokens
            </a>
            ، أنشئ Token جديد بصلاحية <code>Account Analytics: Read</code>.
          </li>
          <li>
            على VPS، أضِف هذه المتغيّرات إلى <code>/opt/iram366/.env</code>:
            <pre>{`CF_ANALYTICS_API_TOKEN=...
CF_ACCOUNT_ID=...
# (موجود سلفاً)
NEXT_PUBLIC_CF_ANALYTICS_TOKEN=...`}</pre>
          </li>
          <li>
            أعد التشغيل: <code>docker compose up -d</code> ثم أعد تحميل هذه الصفحة.
          </li>
        </ol>
      </details>
      <ul className="iram-stats__cf-checklist">
        <li className={env.hasToken ? 'ok' : 'pending'}>
          {env.hasToken ? '✓' : '○'} CF_ANALYTICS_API_TOKEN
        </li>
        <li className={env.hasAccount ? 'ok' : 'pending'}>
          {env.hasAccount ? '✓' : '○'} CF_ACCOUNT_ID
        </li>
        <li className={env.hasSiteTag ? 'ok' : 'pending'}>
          {env.hasSiteTag ? '✓' : '○'} NEXT_PUBLIC_CF_ANALYTICS_TOKEN
        </li>
      </ul>
    </div>
  )
}
