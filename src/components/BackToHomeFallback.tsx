'use client'

import { useEffect } from 'react'

import { SPLASH_SKIP_ONCE_KEY } from '@/lib/splash'

// Marks the history entry this component injects. Next's patched
// pushState/replaceState copy only Next's own keys onto new entries, so the
// marker stays on that one entry.
const HOME_ENTRY = '__iramHomeEntry'

/**
 * When a visitor lands on an inner page (article, category, etc.) from
 * outside the site — Google, WhatsApp, Facebook, etc. — the browser's
 * back button takes them OFF the site, which loses the visit.
 *
 * On first mount, if the referrer is external (or empty), insert "/"
 * as the previous entry in browser history. Subsequent internal
 * navigation works normally (this hook only runs once on initial mount).
 *
 * The injected entry inherits the landing page's App Router tree (Next
 * copies its internal state on replaceState), so a plain Back restored the
 * ARTICLE under the "/" URL — Back looked like it did nothing. When that
 * entry is reached we therefore load the real homepage.
 *
 * No effect on visitors who navigated in from another page on the site —
 * we leave their natural history alone.
 */
export function BackToHomeFallback() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onPopState = (event: PopStateEvent) => {
      const state = event.state as Record<string, unknown> | null
      if (!state?.[HOME_ENTRY]) return
      try {
        // Same-URL navigation registers as a reload; not a reason to splash.
        sessionStorage.setItem(SPLASH_SKIP_ONCE_KEY, '1')
      } catch {
        // storage disabled — worst case the splash plays once
      }
      window.location.replace('/')
    }
    window.addEventListener('popstate', onPopState)

    const path = window.location.pathname
    if (path !== '/' && !path.startsWith('/admin') && !path.startsWith('/m')) {
      let referrerHost = ''
      try {
        referrerHost = document.referrer ? new URL(document.referrer).host : ''
      } catch {
        referrerHost = ''
      }
      const isExternal = !referrerHost || referrerHost !== window.location.host
      if (isExternal) {
        // Insert homepage as the prior history entry. Two-step:
        //   1) replaceState — current entry becomes "/" (marked)
        //   2) pushState — add the actual page URL on top
        const currentUrl = window.location.pathname + window.location.search + window.location.hash
        try {
          window.history.replaceState({ [HOME_ENTRY]: true }, '', '/')
          window.history.pushState(null, '', currentUrl)
        } catch {
          // history manipulation can fail under restrictive sandboxing; ignore
        }
      }
    }

    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return null
}
