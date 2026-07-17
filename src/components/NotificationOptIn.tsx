'use client'

import { useEffect, useState } from 'react'

import { isPushConfigured, isPushSupported, subscribeToPush } from '@/lib/push/client'

const DISMISS_KEY = 'iram366-push-dismissed'

/**
 * A dismissible bottom prompt inviting the reader to turn on notifications.
 * Only appears when the feature is wired, the browser supports it, permission
 * hasn't been decided yet, and the reader hasn't dismissed it before.
 *
 * Renders nothing on the server and on first client paint (visibility depends
 * on browser-only state), so there's no hydration mismatch — it fades in from
 * an effect. Positioned bottom-center to stay clear of the social-hub and
 * chatbot FABs in the corners.
 *
 * The card is fixed dark navy in both themes, so it uses fixed white text
 * rather than the theme-aware `cream` token (which flips dark in dark mode).
 */
export function NotificationOptIn() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isPushConfigured() || !isPushSupported()) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const enable = async () => {
    setBusy(true)
    // Outcome (granted / denied / error) doesn't change the UI path — either
    // way we stop nagging after one explicit interaction.
    await subscribeToPush('all')
    setBusy(false)
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="pointer-events-none fixed bottom-4 end-0 start-0 z-[60] flex justify-center px-4">
      <div
        role="dialog"
        aria-label="تفعيل الإشعارات"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-navy px-4 py-3 text-white shadow-2xl"
      >
        <span aria-hidden className="text-2xl">
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">تابع آخر الأخبار أولاً بأول</p>
          <p className="text-xs text-white/70">فعّل الإشعارات لتصلك الأخبار العاجلة فور نشرها.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-2 py-1 text-xs text-white/70 transition hover:text-white"
          >
            لاحقاً
          </button>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="rounded-lg bg-accent-gold px-3 py-1.5 text-xs font-bold text-navy transition hover:bg-accent-gold-dark disabled:opacity-60"
          >
            {busy ? '…' : 'تفعيل'}
          </button>
        </div>
      </div>
    </div>
  )
}
