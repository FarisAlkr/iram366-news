import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ArticleStatus } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'
import { relativeTime } from '@/lib/date'
import { getMobileUser } from './auth'
import { Pool } from 'pg'

let totalViewsPool: Pool | null = null
function getViewsPool(): Pool {
  if (!totalViewsPool) {
    totalViewsPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  }
  return totalViewsPool
}

async function fetchTotalPublishedViews(): Promise<number> {
  try {
    const res = await getViewsPool().query<{ sum: string | null }>(
      `SELECT COALESCE(SUM(views), 0)::text AS sum
       FROM articles
       WHERE status = 'published' AND deleted_at IS NULL`,
    )
    return Number(res.rows[0]?.sum ?? 0) || 0
  } catch {
    return 0
  }
}

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة',
  inReview: 'قيد المراجعة',
  published: 'منشور',
  archived: 'مؤرشف',
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'm-status m-status--draft',
  inReview: 'm-status m-status--inReview',
  published: 'm-status m-status--published',
  archived: 'm-status m-status--archived',
}

export default async function MobileDashboardPage() {
  const user = await getMobileUser()
  if (!user) redirect('/m/login')

  const payload = await getPayloadClient()

  const [published, inReview, breaking, recent, totalViews] = await Promise.all([
    payload.count({ collection: 'articles', where: { status: { equals: 'published' } } }),
    payload.count({ collection: 'articles', where: { status: { equals: 'inReview' } } }),
    payload.count({
      collection: 'articles',
      where: {
        and: [
          { status: { equals: 'published' } },
          { isBreaking: { equals: true } },
        ],
      },
    }),
    payload.find({
      collection: 'articles',
      limit: 8,
      sort: '-updatedAt',
      depth: 0,
    }),
    fetchTotalPublishedViews(),
  ])

  return (
    <>
      <header className="m-topbar">
        <div className="m-topbar__brand">
          <img src="/splash-logo.jpeg" alt="" aria-hidden className="m-topbar__logo" />
          <span className="m-topbar__name">إرم 366</span>
        </div>
        <span className="m-topbar__user">{user.name || user.email}</span>
      </header>

      <main className="m-main">
        <div className="m-stats">
          <div className="m-stat">
            <span className="m-stat__icon" aria-hidden>📰</span>
            <span className="m-stat__label">منشور</span>
            <span className="m-stat__value">{published.totalDocs.toLocaleString('ar-EG')}</span>
          </div>
          <div className="m-stat">
            <span className="m-stat__icon" aria-hidden>👁️</span>
            <span className="m-stat__label">إجمالي المشاهدات</span>
            <span className="m-stat__value">{totalViews.toLocaleString('ar-EG')}</span>
          </div>
          <div className="m-stat">
            <span className="m-stat__icon" aria-hidden>⏳</span>
            <span className="m-stat__label">قيد المراجعة</span>
            <span className="m-stat__value">{inReview.totalDocs.toLocaleString('ar-EG')}</span>
          </div>
          <div className="m-stat">
            <span className="m-stat__icon" aria-hidden>🚨</span>
            <span className="m-stat__label">عاجل</span>
            <span className="m-stat__value">{breaking.totalDocs.toLocaleString('ar-EG')}</span>
          </div>
        </div>

        <h2 className="m-section-heading">آخر المقالات</h2>
        <div className="m-list">
          {recent.docs.length === 0 && (
            <div className="m-list-item">
              <span className="m-list-item__title" style={{ color: '#6b7280' }}>لا توجد مقالات بعد</span>
            </div>
          )}
          {recent.docs.map((a) => (
            <Link key={a.id} href={`/admin/collections/articles/${a.id}`} className="m-list-item">
              <span className="m-list-item__title">{a.title}</span>
              <span className="m-list-item__meta">
                <span className={STATUS_CLASS[a.status as string] ?? 'm-status m-status--draft'}>
                  {STATUS_LABEL[a.status as string] ?? a.status}
                </span>
                {a.updatedAt && <time className="m-list-item__time">{relativeTime(a.updatedAt as string)}</time>}
              </span>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav active="home" />
    </>
  )
}

function BottomNav({ active }: { active: 'home' | 'new' }) {
  return (
    <nav className="m-bottomnav" aria-label="تنقل سفلي">
      <Link
        href="/m"
        className={`m-bottomnav__item${active === 'home' ? ' m-bottomnav__item--active' : ''}`}
      >
        <span className="m-bottomnav__icon" aria-hidden>🏠</span>
        <span>الرئيسية</span>
      </Link>
      <Link href="/m/new" className="m-bottomnav__item">
        <span className="m-bottomnav__plus" aria-hidden>+</span>
      </Link>
      <a href="/m/logout" className="m-bottomnav__item">
        <span className="m-bottomnav__icon" aria-hidden>🚪</span>
        <span>خروج</span>
      </a>
    </nav>
  )
}
