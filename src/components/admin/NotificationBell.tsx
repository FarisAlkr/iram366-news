'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'

interface Notification {
  id: number | string
  type: string
  title: string
  message?: string
  link?: string
  readAt?: string | null
  createdAt: string
}

const POLL_MS = 60_000 // 60s — gentle on the server
const PAGE_SIZE = 12

/**
 * Fixed-position bell at the top-right of the admin shell. Polls the
 * /api/notifications endpoint for the current user. Click → dropdown
 * with recent items. Click an item → marks it read and navigates.
 */
export const NotificationBell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
      <Bell />
    </>
  )
}

const Bell: React.FC = () => {
  const { user } = useAuth()
  const [items, setItems] = React.useState<Notification[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const unread = items.filter((n) => !n.readAt).length

  const refresh = React.useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/notifications?limit=${PAGE_SIZE}&sort=-createdAt&depth=0&where[recipient][equals]=${user.id}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return
      const json = (await res.json()) as { docs: Notification[] }
      setItems(json.docs || [])
    } catch {
      // ignore — bell is best-effort
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    if (!user?.id) return
    refresh()
    const interval = setInterval(refresh, POLL_MS)
    return () => clearInterval(interval)
  }, [user?.id, refresh])

  // Refresh on window focus too
  React.useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const markRead = async (id: number | string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readAt: new Date().toISOString() }),
      })
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      )
    } catch {
      /* noop */
    }
  }

  const markAllRead = async () => {
    const now = new Date().toISOString()
    const unreadItems = items.filter((n) => !n.readAt)
    await Promise.all(
      unreadItems.map((n) =>
        fetch(`/api/notifications/${n.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readAt: now }),
        }).catch(() => null),
      ),
    )
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })))
  }

  if (!user) return null // not logged in / on the login page

  return (
    <>
      <button
        type="button"
        className="iram-bell"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${unread} إشعار غير مقروء`}
        aria-expanded={open}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="iram-bell__badge" aria-hidden>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="iram-bell__backdrop" onClick={() => setOpen(false)} />
          <div className="iram-bell__panel" dir="rtl" role="dialog" aria-label="الإشعارات">
            <div className="iram-bell__head">
              <h4 className="iram-bell__title">الإشعارات</h4>
              {unread > 0 && (
                <button type="button" className="iram-bell__mark-all" onClick={markAllRead}>
                  تعيين الكل كمقروء
                </button>
              )}
            </div>

            <div className="iram-bell__list">
              {loading && items.length === 0 && <div className="iram-bell__empty">يحمّل...</div>}
              {!loading && items.length === 0 && (
                <div className="iram-bell__empty">
                  لا توجد إشعارات بعد. ستظهر هنا عند نشر مقال، تعليق محرر، أو إعلان من النظام.
                </div>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`iram-bell__row ${n.readAt ? '' : 'iram-bell__row--unread'}`}
                  onClick={async () => {
                    if (!n.readAt) await markRead(n.id)
                    if (n.link) window.location.href = n.link
                    setOpen(false)
                  }}
                >
                  <span className="iram-bell__icon" aria-hidden>
                    {iconFor(n.type)}
                  </span>
                  <span className="iram-bell__body">
                    <span className="iram-bell__row-title">{n.title}</span>
                    {n.message && <span className="iram-bell__row-message">{n.message}</span>}
                    <span className="iram-bell__row-time" dir="ltr">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.readAt && <span className="iram-bell__unread-dot" aria-hidden />}
                </button>
              ))}
            </div>
            <a className="iram-bell__foot" href="/admin/collections/notifications">
              عرض كل الإشعارات →
            </a>
          </div>
        </>
      )}
    </>
  )
}

function iconFor(type: string): string {
  switch (type) {
    case 'article.published':
      return '✅'
    case 'article.in-review':
      return '👀'
    case 'article.rejected':
      return '↩️'
    case 'article.publish-soon':
      return '⏰'
    case 'review.created':
      return '💬'
    case 'system':
      return '📣'
    default:
      return '🔔'
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'الآن'
  const min = Math.floor(sec / 60)
  if (min < 60) return `منذ ${min}د`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `منذ ${hr}س`
  const day = Math.floor(hr / 24)
  if (day < 7) return `منذ ${day}ي`
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', {
    month: 'short',
    day: 'numeric',
  })
}

export default NotificationBell
