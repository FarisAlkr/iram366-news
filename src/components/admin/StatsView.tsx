import React from 'react'
import type { AdminViewServerProps } from 'payload'

import { UserRole } from '@/domain/enums'
import {
  getArticleCounts,
  getAuthorLeaderboard,
  getCategoryDistribution,
  getDailyPublishCounts,
  getTopArticles,
  type ArticleCounts,
  type AuthorStat,
  type CategoryStat,
  type DailyPublishCount,
  type TopArticle,
} from '@/lib/stats/queries'
import './StatsView.scss'

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

/**
 * Custom Payload admin view: full-page editorial + audience stats.
 * Renders at /admin/stats. Server component — all DB queries happen
 * here once per render and are cached for 60 seconds.
 */
export default async function StatsView({ initPageResult }: AdminViewServerProps) {
  const user = initPageResult?.req?.user as { role?: string; name?: string; email?: string } | null

  // Restrict to admin + editor — authors don't need cross-team stats
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

  const [counts, top, authors, cats, daily] = await Promise.all([
    getArticleCounts(),
    getTopArticles(10),
    getAuthorLeaderboard(10),
    getCategoryDistribution(),
    getDailyPublishCounts(30),
  ])

  const cf = readCloudflareEnv()

  return (
    <div className="iram-stats" dir="rtl">
      <header className="iram-stats__header">
        <div>
          <h1 className="iram-stats__title">الإحصائيات الاحترافية</h1>
          <p className="iram-stats__subtitle">
            ملخّص شامل لأداء المحتوى والجمهور — يُحدَّث تلقائياً كل دقيقة.
          </p>
        </div>
        <span className="iram-stats__hint">⌛ مُحدَّث منذ أقل من دقيقة</span>
      </header>

      {/* === SECTION B: AUDIENCE — placeholder until CF token is set === */}
      <Section title="الجمهور والزيارات (Cloudflare)">
        {cf.hasToken && cf.hasAccount && cf.hasSiteTag ? (
          <CloudflareReadyPanel />
        ) : (
          <CloudflarePending env={cf} />
        )}
      </Section>

      {/* === SECTION A: EDITORIAL === */}
      <Section title="المحتوى التحريري">
        <EditorialKpis counts={counts} />
      </Section>

      <div className="iram-stats__row">
        <Section title="أكثر المقالات قراءةً" compact>
          <TopArticlesList items={top} />
        </Section>

        <Section title="ترتيب الكتّاب" compact>
          <AuthorsList items={authors} />
        </Section>
      </div>

      <Section title="توزيع التصنيفات">
        <CategoriesBars items={cats} />
      </Section>

      <Section title="إيقاع النشر — آخر ٣٠ يوماً">
        <DailySpark items={daily} />
      </Section>

      {/* === SECTION C: HEALTH === */}
      <Section title="حالة النظام">
        <HealthGrid />
      </Section>
    </div>
  )
}

// ---------- Sub-components ----------

function Section({
  title,
  compact,
  children,
}: {
  title: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`iram-stats__section${compact ? ' iram-stats__section--compact' : ''}`}>
      <h2 className="iram-stats__section-title">{title}</h2>
      <div className="iram-stats__section-body">{children}</div>
    </section>
  )
}

function EditorialKpis({ counts }: { counts: ArticleCounts }) {
  const cards: Array<{ label: string; value: number; emoji: string; tone?: string }> = [
    { label: 'منشور اليوم', value: counts.publishedToday, emoji: '📅' },
    { label: 'هذا الأسبوع', value: counts.publishedThisWeek, emoji: '🗓️' },
    { label: 'هذا الشهر', value: counts.publishedThisMonth, emoji: '📆' },
    { label: 'إجمالي المنشور', value: counts.publishedTotal, emoji: '📰', tone: 'accent' },
    { label: 'إجمالي المشاهدات', value: counts.totalViews, emoji: '👁️', tone: 'accent' },
    { label: 'قيد المراجعة', value: counts.awaitingReview, emoji: '⏳' },
    { label: 'مسودات', value: counts.draftCount, emoji: '✏️' },
    { label: 'عاجل', value: counts.breakingCount, emoji: '🚨' },
  ]
  return (
    <div className="iram-stats__kpis">
      {cards.map((c) => (
        <div key={c.label} className={`iram-kpi${c.tone === 'accent' ? ' iram-kpi--accent' : ''}`}>
          <span className="iram-kpi__icon" aria-hidden>{c.emoji}</span>
          <span className="iram-kpi__label">{c.label}</span>
          <span className="iram-kpi__value">{fmt(c.value)}</span>
        </div>
      ))}
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
  if (items.length === 0) {
    return <p className="iram-stats__empty">لا توجد تصنيفات بعد.</p>
  }
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
                background: c.color || 'var(--iram-gold-500, #c8a84e)',
              }}
            />
          </div>
          <span className="iram-stats__bar-count">{fmt(c.count)}</span>
        </div>
      ))}
    </div>
  )
}

function DailySpark({ items }: { items: DailyPublishCount[] }) {
  const max = Math.max(1, ...items.map((d) => d.count))
  return (
    <div className="iram-stats__spark">
      <div className="iram-stats__spark-track">
        {items.map((d) => (
          <div
            key={d.day}
            className="iram-stats__spark-col"
            title={`${d.day}: ${d.count}`}
          >
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

function HealthGrid() {
  return (
    <div className="iram-stats__health">
      <HealthRow label="حالة الموقع" value="✅ يعمل بشكل طبيعي" />
      <HealthRow label="آخر تحديث" value={new Date().toLocaleString('en-GB')} />
      <HealthRow label="بيئة التشغيل" value={process.env.NODE_ENV ?? '—'} />
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

function CloudflareReadyPanel() {
  return (
    <div className="iram-stats__cf iram-stats__cf--connected">
      <p>
        🟢 ربط Cloudflare Analytics مفعّل. سيُعرض هنا قريباً: عدد الزوار اليوم،
        هذا الأسبوع، هذا الشهر، أكثر المقالات زيارة من Cloudflare، وتوزيع الدول
        والأجهزة.
      </p>
      <p className="iram-stats__cf-note">
        تطبيق الاستعلامات الفعلية يحتاج خطوة برمجية أخيرة — أبلغ المطوّر بأنّ
        المتغيّرات البيئية أصبحت متوفّرة.
      </p>
    </div>
  )
}

function CloudflarePending({ env }: { env: CloudflareEnv }) {
  return (
    <div className="iram-stats__cf">
      <p>
        🔌 ربط Cloudflare Analytics غير مفعّل بعد. عند تفعيله ستظهر هنا أرقام
        الزوار الفعليين (اليوم / هذا الأسبوع / هذا الشهر / الإجمالي) وأكثر
        المقالات زيارة عبر Cloudflare.
      </p>
      <details className="iram-stats__cf-howto">
        <summary>خطوات التفعيل</summary>
        <ol>
          <li>
            من <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer">Cloudflare → Profile → API Tokens</a>،
            أنشئ Token جديد بصلاحية <code>Account Analytics: Read</code>.
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
