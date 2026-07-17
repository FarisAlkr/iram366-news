'use client'

import { useEffect, useState } from 'react'

import {
  getNotificationPermission,
  hasActiveSubscription,
  isPushConfigured,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push/client'

type ToggleState = 'loading' | 'unavailable' | 'denied' | 'off' | 'on'

/**
 * Persistent notification control for the footer. Unlike the one-time opt-in
 * prompt, this is always available: it reflects the live subscription state
 * and lets a reader turn notifications on or off at any time.
 *
 * Renders nothing on the server and while resolving browser state (so no
 * hydration mismatch), and stays hidden when push isn't wired/supported — so
 * the footer is unchanged on the live site until the feature is enabled.
 *
 * Sits on the dark navy footer, so it uses fixed white/gold colors rather than
 * the theme-aware tokens.
 */
export function NotificationToggle() {
  const [state, setState] = useState<ToggleState>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isPushConfigured() || !isPushSupported()) {
        if (!cancelled) setState('unavailable')
        return
      }
      if (getNotificationPermission() === 'denied') {
        if (!cancelled) setState('denied')
        return
      }
      const subscribed = await hasActiveSubscription()
      if (!cancelled) setState(subscribed ? 'on' : 'off')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading' || state === 'unavailable') return null

  if (state === 'denied') {
    return (
      <p className="mt-4 text-xs text-white/40">الإشعارات محظورة — فعّلها من إعدادات المتصفح.</p>
    )
  }

  const isOn = state === 'on'

  const toggle = async () => {
    setBusy(true)
    if (isOn) {
      if (await unsubscribeFromPush()) setState('off')
    } else {
      const res = await subscribeToPush('all')
      setState(res.ok ? 'on' : getNotificationPermission() === 'denied' ? 'denied' : 'off')
    }
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isOn}
      className={`mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-60 ${
        isOn
          ? 'border-accent-gold text-accent-gold hover:bg-accent-gold hover:text-navy'
          : 'border-white/10 bg-white/5 text-white/80 hover:border-accent-gold hover:bg-accent-gold hover:text-navy'
      }`}
    >
      <span aria-hidden>{isOn ? '🔕' : '🔔'}</span>
      <span>{busy ? '…' : isOn ? 'إيقاف إشعارات الأخبار' : 'تفعيل إشعارات الأخبار'}</span>
    </button>
  )
}
