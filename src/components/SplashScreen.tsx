'use client'

import { useEffect, useState } from 'react'

const TOTAL_MS = 4200
const FADE_OUT_AT_MS = 3300
const TAGLINE = 'منصة إخبارية مستقلة برؤية مختلفة — نواكب الأحداث لحظة بلحظة من رهط والنقب'

interface SplashScreenProps {
  siteName: string
}

export function SplashScreen({ siteName }: SplashScreenProps) {
  // `null` = SSR / pre-mount, decide after hydration
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden')

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPhase('in')
    const t1 = window.setTimeout(() => setPhase('out'), FADE_OUT_AT_MS)
    const t2 = window.setTimeout(() => setPhase('hidden'), TOTAL_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      className={`iram-splash ${phase === 'out' ? 'iram-splash--out' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={siteName}
    >
      <div className="iram-splash__inner">
        <div className="iram-splash__halo" aria-hidden />
        <img
          src="/splash-logo.jpeg"
          alt=""
          aria-hidden
          className="iram-splash__logo"
        />
        <div className="iram-splash__name">{siteName}</div>
        <div className="iram-splash__tagline">{TAGLINE}</div>
        <div className="iram-splash__bar" aria-hidden>
          <div className="iram-splash__bar-fill" />
        </div>
      </div>
    </div>
  )
}
