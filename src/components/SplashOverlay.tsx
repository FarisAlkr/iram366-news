'use client'

import { useEffect, useLayoutEffect, useState, type AnimationEvent } from 'react'

const TAGLINE = 'منصة إخبارية مستقلة برؤية مختلفة — نواكب الأحداث لحظة بلحظة من رهط والنقب'

// Last-resort unmount in case `animationend` never fires (e.g. animations
// suppressed by the browser). The CSS exit finishes at ~4.4s.
const FALLBACK_UNMOUNT_MS = 6000

/**
 * The visual splash. Server-rendered so it covers the page from the first
 * paint; its whole timeline (intro, hold, fade-out) is CSS, so it also goes
 * away if JS never loads. This component only removes the finished overlay
 * from the DOM. Whether it shows at all is decided by the gate script in
 * SplashScreen.tsx.
 */
export function SplashOverlay({ siteName }: { siteName: string }) {
  const [mounted, setMounted] = useState(true)

  // Layout effect: if React ever client-renders this tree (e.g. after a
  // hydration error) the overlay is unmounted before the browser paints it.
  useLayoutEffect(() => {
    const skipped =
      (window as Window & { __iramSplashSkip?: boolean }).__iramSplashSkip === true ||
      document.documentElement.getAttribute('data-splash') === 'skip'
    if (skipped) setMounted(false)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(false), FALLBACK_UNMOUNT_MS)
    return () => window.clearTimeout(t)
  }, [])

  const onAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.animationName === 'splash-exit') setMounted(false)
  }

  if (!mounted) return null

  return (
    <div
      className="iram-splash"
      role="status"
      aria-live="polite"
      aria-label={siteName}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="iram-splash__inner">
        <div className="iram-splash__halo" aria-hidden />
        <picture className="iram-splash__picture">
          <source srcSet="/brand/splash-logo.webp" type="image/webp" />
          <img
            src="/brand/splash-logo.jpg"
            alt=""
            aria-hidden
            width={800}
            height={800}
            decoding="async"
            className="iram-splash__logo"
          />
        </picture>
        <div className="iram-splash__name">{siteName}</div>
        <div className="iram-splash__tagline">{TAGLINE}</div>
        <div className="iram-splash__bar" aria-hidden>
          <div className="iram-splash__bar-fill" />
        </div>
      </div>
    </div>
  )
}
