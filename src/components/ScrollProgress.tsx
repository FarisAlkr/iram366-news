'use client'

import React from 'react'

interface Checkpoint {
  id: string
  text: string
  position: number // 0–1, where in the article it sits
  level: number // 1=h1, 2=h2, 3=h3
}

interface ScrollProgressProps {
  /**
   * CSS selector for the content container. If omitted, falls back to:
   *   1. .prose          (article body — most relevant headings)
   *   2. main            (any page — section-level headings)
   *
   * Either way, headings nested inside article cards / links are filtered
   * out — those are link previews, not navigable sections.
   */
  contentSelector?: string
}

/**
 * Vertical reading progress indicator on the right edge of the viewport.
 * Works on every public page:
 *
 *   - Article pages  → checkpoints from H2/H3 inside the article body
 *   - Homepage       → checkpoints from section headings ("آخر الأخبار",
 *                       per-category "محلي", "سياسة", ...)
 *   - Category page  → checkpoints from the section headings
 *   - Search page    → no checkpoints (results are flat) — bar still fills
 *
 * Hides itself if the page isn't tall enough to scroll, or below 1024px width
 * (responsive — saves real estate on phones).
 */
export const ScrollProgress: React.FC<ScrollProgressProps> = ({ contentSelector }) => {
  const [progress, setProgress] = React.useState(0)
  const [checkpoints, setCheckpoints] = React.useState<Checkpoint[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [shouldShow, setShouldShow] = React.useState(false)

  // Discover checkpoints on every navigation. We listen to the URL changing
  // (Next.js client navigations) by re-running the discovery when the
  // pathname changes via a poll on document.body's child mutations.
  React.useEffect(() => {
    const findContainer = (): HTMLElement | null => {
      if (contentSelector) return document.querySelector<HTMLElement>(contentSelector)
      return (
        document.querySelector<HTMLElement>('.prose') ??
        document.querySelector<HTMLElement>('main')
      )
    }

    const discover = () => {
      const container = findContainer()
      if (!container) {
        setCheckpoints([])
        return
      }

      // Collect H2/H3 inside the container, but skip those nested inside
      // article cards or links — those are previews, not navigable sections.
      const all = Array.from(
        container.querySelectorAll<HTMLHeadingElement>('h2, h3'),
      ).filter((h) => !h.closest('article, a, .article-card'))

      if (all.length === 0) {
        setCheckpoints([])
        return
      }

      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight <= 0) {
        setCheckpoints([])
        return
      }

      const list: Checkpoint[] = all.map((h, i) => {
        if (!h.id) h.id = `section-${i}`
        const top = h.getBoundingClientRect().top + window.scrollY
        const pct = Math.max(0, Math.min(1, (top - window.innerHeight * 0.2) / docHeight))
        return {
          id: h.id,
          text: h.textContent?.trim().slice(0, 60) ?? '',
          position: pct,
          level: h.tagName === 'H2' ? 2 : 3,
        }
      })

      setCheckpoints(list)
    }

    // Discover initially, then re-run on resize, layout shifts, and on a
    // delayed tick to catch lazy-rendered content.
    discover()
    const t1 = setTimeout(discover, 400)
    const t2 = setTimeout(discover, 1500)
    window.addEventListener('resize', discover)
    return () => {
      window.removeEventListener('resize', discover)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [contentSelector])

  // Track scroll position, active heading, and visibility threshold
  React.useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight <= 0) {
        setProgress(0)
        setShouldShow(false)
        return
      }
      // Only show when the page is meaningfully scrollable (≥1.4× viewport)
      setShouldShow(document.documentElement.scrollHeight > window.innerHeight * 1.4)

      const pct = Math.max(0, Math.min(1, window.scrollY / docHeight))
      setProgress(pct)

      // Find the heading closest above the scroll line (1/3 from top).
      const triggerLine = window.scrollY + window.innerHeight * 0.33
      let active: string | null = null
      for (const cp of checkpoints) {
        const el = document.getElementById(cp.id)
        if (!el) continue
        const top = el.getBoundingClientRect().top + window.scrollY
        if (top <= triggerLine) active = cp.id
      }
      setActiveId(active)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [checkpoints])

  if (!shouldShow) return null

  const goTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="scroll-progress" aria-hidden>
      <div className="scroll-progress__rail">
        <div
          className="scroll-progress__fill"
          style={{ height: `${progress * 100}%` }}
        />
        {checkpoints.map((cp) => (
          <button
            key={cp.id}
            type="button"
            className={`scroll-progress__dot scroll-progress__dot--l${cp.level} ${
              cp.id === activeId ? 'scroll-progress__dot--active' : ''
            } ${progress >= cp.position ? 'scroll-progress__dot--passed' : ''}`}
            style={{ top: `${cp.position * 100}%` }}
            onClick={() => goTo(cp.id)}
            aria-label={`الانتقال إلى: ${cp.text}`}
          >
            <span className="scroll-progress__label">{cp.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ScrollProgress
