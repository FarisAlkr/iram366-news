import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Pool } from 'pg'

import { ArticleStatus } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'
import { relativeTime } from '@/lib/date'
import type { Media } from '@/types/payload'
import { resolveRef, pickMediaUrl } from '@/types/payload'
import { getMobileUser } from './auth'

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
  'in-review': 'قيد المراجعة',
  published: 'منشور',
  archived: 'مؤرشف',
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'm-status m-status--draft',
  'in-review': 'm-status m-status--inReview',
  published: 'm-status m-status--published',
  archived: 'm-status m-status--archived',
}

const fmt = (n: number) => n.toLocaleString('en-US')

export default async function MobileDashboardPage() {
  const user = await getMobileUser()
  if (!user) redirect('/m/login')

  const payload = await getPayloadClient()

  const [published, inReview, breaking, recent, totalViews] = await Promise.all([
    payload.count({
      collection: 'articles',
      where: { status: { equals: ArticleStatus.Published } },
    }),
    payload.count({
      collection: 'articles',
      where: { status: { equals: ArticleStatus.InReview } },
    }),
    payload.count({
      collection: 'articles',
      where: {
        and: [{ status: { equals: ArticleStatus.Published } }, { isBreaking: { equals: true } }],
      },
    }),
    payload.find({
      collection: 'articles',
      limit: 8,
      sort: '-updatedAt',
      depth: 1,
    }),
    fetchTotalPublishedViews(),
  ])

  return (
    <>
      <header className="m-topbar">
        <div className="m-topbar__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/splash-logo.jpeg" alt="" aria-hidden className="m-topbar__logo" />
          <span className="m-topbar__name">إرم 366</span>
        </div>
        <span className="m-topbar__user">
          مرحباً، {(user.name as string) || (user.email as string)}
        </span>
      </header>

      <main className="m-main">
        <div className="m-stats">
          <div className="m-stat m-stat--accent">
            <span className="m-stat__icon" aria-hidden>
              📰
            </span>
            <span className="m-stat__label">المنشور</span>
            <span className="m-stat__value">{fmt(published.totalDocs)}</span>
          </div>
          <div className="m-stat">
            <span className="m-stat__icon" aria-hidden>
              👁️
            </span>
            <span className="m-stat__label">إجمالي المشاهدات</span>
            <span className="m-stat__value">{fmt(totalViews)}</span>
          </div>
          <div className="m-stat">
            <span className="m-stat__icon" aria-hidden>
              ⏳
            </span>
            <span className="m-stat__label">قيد المراجعة</span>
            <span className="m-stat__value">{fmt(inReview.totalDocs)}</span>
          </div>
          <div className="m-stat">
            <span className="m-stat__icon" aria-hidden>
              🚨
            </span>
            <span className="m-stat__label">عاجل</span>
            <span className="m-stat__value">{fmt(breaking.totalDocs)}</span>
          </div>
        </div>

        <Link href="/m/new" className="m-quick-action" aria-label="نشر مقال جديد">
          <span aria-hidden>✍️</span>
          <span>نشر مقال جديد</span>
        </Link>

        <h2 className="m-section-heading">آخر المقالات</h2>
        <div className="m-list">
          {recent.docs.length === 0 && (
            <div className="m-list-empty">لا توجد مقالات بعد. اضغط ✍️ لنشر أول مقال.</div>
          )}
          {recent.docs.map((a) => {
            const image = resolveRef<Media>(
              (a as { featuredImage?: unknown }).featuredImage as never,
            )
            const thumb = image ? pickMediaUrl(image, 'thumbnail') : null
            return (
              <Link key={a.id} href={`/admin/collections/articles/${a.id}`} className="m-list-item">
                <div className="m-list-item__thumb" aria-hidden>
                  {thumb ? (
                    <Image src={thumb} alt="" width={56} height={56} className="m-list-item__img" />
                  ) : (
                    <span className="m-list-item__thumb-fallback">📰</span>
                  )}
                </div>
                <div className="m-list-item__body">
                  <h3 className="m-list-item__title">{a.title as string}</h3>
                  <div className="m-list-item__meta">
                    <span
                      className={STATUS_CLASS[a.status as string] ?? 'm-status m-status--draft'}
                    >
                      {STATUS_LABEL[a.status as string] ?? (a.status as string)}
                    </span>
                    {a.updatedAt && (
                      <time className="m-list-item__time">
                        {relativeTime(a.updatedAt as string)}
                      </time>
                    )}
                  </div>
                </div>
                <span className="m-list-item__chevron" aria-hidden>
                  ‹
                </span>
              </Link>
            )
          })}
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
        className={`m-bottomnav__item ${active === 'home' ? 'm-bottomnav__item--active' : ''}`}
      >
        <span className="m-bottomnav__icon" aria-hidden>
          🏠
        </span>
        <span>الرئيسية</span>
      </Link>
      <Link href="/m/new" className="m-bottomnav__item">
        <span className="m-bottomnav__plus" aria-hidden>
          +
        </span>
      </Link>
      <a href="/m/logout" className="m-bottomnav__item">
        <span className="m-bottomnav__icon" aria-hidden>
          🚪
        </span>
        <span>خروج</span>
      </a>
    </nav>
  )
}
