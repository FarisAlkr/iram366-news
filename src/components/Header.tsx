import Link from 'next/link'

import type { Category, Media } from '@/types/payload'
import { getWeatherTowns } from '@/lib/queries'
import { AdSlot } from './AdSlot'
import { BreakingTicker } from './BreakingTicker'
import { SearchToggle } from './SearchToggle'
import { WeatherDateBar } from './WeatherDateBar'

interface HeaderProps {
  siteName: string
  /** Kept for compatibility with existing callers; no longer rendered. */
  siteDescription?: string | null
  categories: Pick<Category, 'name' | 'slug'>[]
  /** Kept for compatibility with existing callers; no longer rendered. */
  logo?: Media | string | number | null
  breakingArticles?: Array<{ title: string; slug: string }>
}

/**
 * Site header — single sticky bar:
 *   Row 0 — weather + live date/time, with the site name (and a tiny logo
 *           icon next to it) centered between weather and the clock.
 *   Row 1 — categories nav + search button
 *   Row 2 — breaking-news ticker (only when there are breaking items)
 *
 * The previous big brand banner (logo + name + tagline below the sticky)
 * was removed; the site name now lives inside the weather bar so the
 * top of the page is much tighter.
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

      {/* Top, NON-sticky band — scrolls away on read.
          Stack order top→bottom:
            1. WeatherDateBar (live town + clock — informational, takes the
               very top)
            2. Three-part RTL wordmark (Arabic + logo + English) — brand
               identity directly below the weather strip
          Then the STICKY band (categories nav + breaking ticker) follows
          as a sibling below. The wordmark used to sit above WeatherDateBar
          but the editor preferred weather/clock at the very top so the
          logo lands right above the navigation it brands. */}
      <div className="bg-navy text-white">
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
      </div>

      {/* STICKY band — categories + breaking ticker. Stays visible on scroll. */}
      <header className="sticky top-0 z-50 bg-navy text-white shadow-[var(--shadow-nav)]">
        {/* Categories on the right (RTL start), search on the left */}
        <div className="container-news">
          <div className="flex items-center gap-2 py-1.5 md:py-2">
            <nav
              className="scrollbar-hide -mx-2 flex flex-1 items-center gap-1 overflow-x-auto px-2 md:justify-center md:gap-2"
              aria-label="التنقل الرئيسي"
            >
              <CategoryLink href="/" label="الرئيسية" />
              {categories.map((cat) => (
                <CategoryLink key={cat.slug} href={`/category/${cat.slug}`} label={cat.name} />
              ))}
            </nav>
            <div className="flex-shrink-0">
              <SearchToggle />
            </div>
          </div>
        </div>

        {/* Breaking ticker (only when there are breaking items) */}
        {breakingArticles.length > 0 && <BreakingTicker articles={breakingArticles} />}
      </header>
    </>
  )
}

function CategoryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-display text-sm font-medium transition-colors duration-150 hover:bg-white/10 md:px-4 md:text-base"
    >
      {label}
    </Link>
  )
}
