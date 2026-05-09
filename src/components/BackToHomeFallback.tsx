'use client'

import { useEffect } from 'react'

/**
 * When a visitor lands on an inner page (article, category, etc.) from
 * outside the site — Google, WhatsApp, Facebook, etc. — the browser's
 * back button takes them OFF the site, which loses the visit.
 *
 * On first mount, if the referrer is external (or empty), insert "/"
 * as the previous entry in browser history. Subsequent internal
 * navigation works normally (this hook only runs once on initial mount).
 *
 * No effect on visitors who navigated in from another page on the site —
 * we leave their natural history alone.
 */
export function BackToHomeFallback() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const path = window.location.pathname
    if (path === '/' || path.startsWith('/admin') || path.startsWith('/m')) return

    let referrerHost = ''
    try {
      referrerHost = document.referrer ? new URL(document.referrer).host : ''
    } catch {
      referrerHost = ''
    }
    const isExternal = !referrerHost || referrerHost !== window.location.host
    if (!isExternal) return

    // Insert homepage as the prior history entry. Two-step:
    //   1) replaceState — current entry becomes "/"
    //   2) pushState — add the actual article URL on top
    // Browser back now pops to "/" instead of leaving the site.
    const currentUrl = window.location.pathname + window.location.search + window.location.hash
    try {
      window.history.replaceState(null, '', '/')
      window.history.pushState(null, '', currentUrl)
    } catch {
      // history manipulation can fail under restrictive sandboxing; ignore
    }
  }, [])

  return null
}
