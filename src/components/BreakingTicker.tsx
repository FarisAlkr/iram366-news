'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

interface BreakingArticle {
  title: string
  slug: string
  publishedAt?: string | null
}

interface BreakingTickerProps {
  articles: BreakingArticle[]
  /** Auto-advance interval in ms. Default 5000. */
  intervalMs?: number
}

const DEFAULT_INTERVAL_MS = 5000
const ACCENT = '#E6196E'
const ACCENT_HOVER = '#cf0e60'

// Israel-local HH:MM, Latin numerals. Pinned to a single time zone so the
// SSR render and client-hydration render agree byte-for-byte (otherwise
// the browser's tz produces a different string and React warns).
const CLOCK_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Jerusalem',
})

function formatClock(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return CLOCK_FMT.format(d)
}

export function BreakingTicker({
  articles,
  intervalMs = DEFAULT_INTERVAL_MS,
}: BreakingTickerProps) {
  if (articles.length === 0) return null

  return <BreakingTickerInner articles={articles} intervalMs={intervalMs} />
}

function BreakingTickerInner({
  articles,
  intervalMs,
}: {
  articles: BreakingArticle[]
  intervalMs: number
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])

  const goTo = useCallback(
    (next: number) => {
      const n = articles.length
      // Wrap both directions so playback loops cleanly.
      const normalized = ((next % n) + n) % n
      setIndex(normalized)
    },
    [articles.length],
  )

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index])
  const goNext = useCallback(() => goTo(index + 1), [goTo, index])
  const togglePlay = useCallback(() => setPlaying((p) => !p), [])

  // Auto-advance. Re-derives whenever `playing`, the interval, or the
  // article list changes; the cleanup tears down the timer on every
  // re-derive so stale timers can't double-fire.
  useEffect(() => {
    if (!playing) return
    if (articles.length < 2) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % articles.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [playing, intervalMs, articles.length])

  // Smoothly bring the active item into the viewport. `inline: 'center'`
  // works in both writing directions — the browser handles RTL math.
  // `behavior: 'smooth'` is automatically downgraded to 'auto' under
  // `prefers-reduced-motion`, so explicit motion-reduce branching here
  // would be redundant.
  useEffect(() => {
    const node = itemRefs.current[index]
    if (!node) return
    node.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [index])

  return (
    <section
      role="region"
      aria-label="الشريط الإخباري"
      aria-live="polite"
      className="container-news py-6 md:py-8"
    >
      <h2 className="text-end font-display text-xl font-extrabold text-ink md:text-2xl">
        الشريط الإخباري
      </h2>

      <div className="mt-3 flex items-center gap-2 md:gap-3">
        <ControlButton onClick={goPrev} aria-label="المقال السابق">
          <SkipBackIcon />
        </ControlButton>
        <ControlButton
          onClick={togglePlay}
          aria-label={playing ? 'إيقاف التشغيل التلقائي' : 'تشغيل التلقائي'}
          aria-pressed={playing}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </ControlButton>
        <ControlButton onClick={goNext} aria-label="المقال التالي">
          <SkipForwardIcon />
        </ControlButton>
        <span className="ms-2 text-sm font-medium text-[var(--color-ink-muted)]">
          {playing ? 'تشغيل' : 'متوقف'}
        </span>
      </div>

      <div className="mt-5 overflow-hidden">
        <div className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth motion-reduce:scroll-auto">
          {articles.map((article, i) => {
            const isActive = i === index
            const stamp = formatClock(article.publishedAt)
            return (
              <Link
                key={article.slug}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                href={`/articles/${article.slug}`}
                aria-current={isActive ? 'true' : undefined}
                className={`group flex w-64 flex-shrink-0 items-stretch gap-3 rounded transition-opacity duration-200 sm:w-72 md:w-80 ${
                  isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col text-end">
                  {stamp && (
                    <time
                      dateTime={article.publishedAt ?? undefined}
                      className="text-xs font-medium text-[var(--color-ink-muted)]"
                    >
                      {stamp}
                    </time>
                  )}
                  <h3 className="mt-1 line-clamp-3 font-display text-sm font-bold leading-relaxed text-ink transition-colors duration-150 group-hover:text-[#E6196E] md:text-base">
                    {article.title}
                  </h3>
                </div>
                {/* Thin vertical divider to the END side of each item — sits
                    on the left in RTL, separating consecutive cards. */}
                <span
                  aria-hidden
                  className="w-px flex-shrink-0 self-stretch bg-[var(--color-border)]"
                />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ControlButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={
        {
          backgroundColor: ACCENT,
          // Tailwind doesn't have a token for this brand; inline so hover
          // and focus ring track the same source of truth.
          '--tw-ring-color': ACCENT,
        } as React.CSSProperties
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = ACCENT_HOVER
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = ACCENT
      }}
    >
      {children}
    </button>
  )
}

/* -------- icons (inline SVG, 16x16, currentColor) -------- */

function SkipBackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 5h2v14H6V5zm4 7l11 7V5l-11 7z" />
    </svg>
  )
}

function SkipForwardIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M16 5h2v14h-2V5zM3 19l11-7L3 5v14z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}
