import Link from 'next/link'

import type { Category, Media } from '@/types/payload'
import { getWeatherTowns } from '@/lib/queries'
import { AdSlot } from './AdSlot'
import { BreakingTicker } from './BreakingTicker'
import { CategoriesNav } from './CategoriesNav'
import { WeatherDateBar } from './WeatherDateBar'

interface HeaderProps {
  siteName: string
  /** Kept for compatibility with existing callers; no longer rendered. */
  siteDescription?: string | null
  categories: Pick<Category, 'name' | 'slug'>[]
  /** Kept for compatibility with existing callers; no longer rendered. */
  logo?: Media | string | number | null
  breakingArticles?: Array<{ title: string; slug: string; publishedAt?: string | null }>
}

/**
 * Site header — one sticky bar that holds three rows:
 *   Row 0 — WeatherDateBar (live town + clock at the very top)
 *   Row 1 — Three-part RTL brand wordmark (Arabic + logo + English)
 *   Row 2 — CategoriesNav (full strip; collapses to a hamburger button +
 *           dropdown once the reader has scrolled past 120px)
 *
 * Everything in this <header> stays pinned on scroll so the brand and the
 * weather/time strip remain visible while reading. The breaking ticker is
 * a sibling below the sticky and scrolls away with the page content.
 */
export async function Header({ siteName, categories, breakingArticles = [] }: HeaderProps) {
  const towns = await getWeatherTowns()

  return (
    <>
      {/* Header banner ad — very top of every page, above the sticky bar.
          Hides itself when there's no active ad for this placement. */}
      <div className="container-news">
        <AdSlot placement="header-banner" />
      </div>

      <header className="sticky top-0 z-50 bg-navy text-white shadow-[var(--shadow-nav)]">
        <WeatherDateBar towns={towns} />
        {/* DOM order is Arabic → logo → English; flex on an RTL page lays
            them out right-to-left so the visual result is:
              ┌────────────────────────┬───────┬──────────────────┐
              │ Arabic (start of RTL)  │ logo  │ English (end)    │
              └────────────────────────┴───────┴──────────────────┘
            Whole row is one <Link> so any part navigates home. */}
        <Link
          href="/"
          aria-label={`${siteName} — الصفحة الرئيسية`}
          className="flex items-center justify-center gap-3 border-b border-white/5 py-2 transition-opacity hover:opacity-80 sm:gap-4 md:py-3"
        >
          <span className="iram-bar-brand__arabic min-w-0 whitespace-nowrap font-display text-base font-extrabold tracking-tight text-white sm:text-xl md:text-2xl">
            {siteName}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- needs CSS mask, Next/Image strips style */}
          <img
            src="/splash-logo.jpeg"
            alt=""
            aria-hidden
            className="iram-bar-brand__icon h-10 w-auto flex-shrink-0 sm:h-14 md:h-16"
          />
          <span
            dir="ltr"
            className="iram-bar-brand__english min-w-0 whitespace-nowrap font-display text-base font-extrabold tracking-tight text-white sm:text-xl md:text-2xl"
          >
            Iram 366 News
          </span>
        </Link>
        <CategoriesNav categories={categories} />
      </header>

      {/* Breaking ticker — a redesigned, multi-row block (heading + playback
          controls + horizontal item track), so it lives in the regular page
          flow directly under the sticky bar instead of inside it. Renders
          only when at least one breaking article exists. */}
      {breakingArticles.length > 0 && <BreakingTicker articles={breakingArticles} />}
    </>
  )
}
