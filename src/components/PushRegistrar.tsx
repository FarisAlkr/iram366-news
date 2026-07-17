'use client'

import { useEffect } from 'react'

import {
  getNotificationPermission,
  hasActiveSubscription,
  isPushConfigured,
  isPushSupported,
  registerServiceWorker,
  subscribeToPush,
} from '@/lib/push/client'

/**
 * Headless: registers the service worker on load (enabling installability +
 * offline + push), and silently re-establishes the push subscription if the
 * reader already granted permission but the subscription was lost (SW update,
 * key rotation, cleared storage). Renders nothing.
 *
 * Gated on isPushConfigured() so the whole PWA layer stays dormant until the
 * feature flag + VAPID key are set — current site behavior is unchanged.
 */
export function PushRegistrar() {
  useEffect(() => {
    if (!isPushConfigured() || !isPushSupported()) return
    let cancelled = false

    void (async () => {
      const reg = await registerServiceWorker()
      if (!reg || cancelled) return
      // Already opted in but no live subscription → restore it without a
      // prompt (requestPermission resolves instantly when already granted).
      if (getNotificationPermission() === 'granted' && !(await hasActiveSubscription())) {
        await subscribeToPush('all')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
