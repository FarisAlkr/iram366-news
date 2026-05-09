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
          On phones: a small brand row + the weather/date bar.
          On tablet+: just the weather/date bar (which itself centers the
          site name and logo on tablet+). */}
      <div className="bg-navy text-white">
        <Link
          href="/"
          aria-label={`${siteName} — الصفحة الرئيسية`}
          className="sm:hidden flex items-center justify-center gap-2 py-1.5 border-b border-white/5 hover:opacity-80 transition-opacity"
        >
          <img
            src="/splash-logo.jpeg"
            alt=""
            aria-hidden
            className="iram-bar-brand__icon h-8 w-auto flex-shrink-0"
          />
          <span className="font-display font-extrabold tracking-tight text-sm text-white whitespace-nowrap">
            {siteName}
          </span>
        </Link>
        <WeatherDateBar towns={towns} siteName={siteName} />
      </div>

      {/* STICKY band — categories + breaking ticker. Stays visible on scroll. */}
      <header className="bg-navy text-white shadow-[var(--shadow-nav)] sticky top-0 z-50">
        {/* Categories on the right (RTL start), search on the left */}
        <div className="container-news">
          <div className="flex items-center gap-2 py-1.5 md:py-2">
            <nav
              className="flex-1 flex md:justify-center items-center gap-1 md:gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2"
              aria-label="التنقل الرئيسي"
            >
              <CategoryLink href="/" label="الرئيسية" />
              {categories.map((cat) => (
                <CategoryLink
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  label={cat.name}
                />
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
      className="px-3 md:px-4 py-1.5 text-sm md:text-base font-display font-medium rounded-full whitespace-nowrap flex-shrink-0 hover:bg-white/10 transition-colors duration-150"
    >
      {label}
    </Link>
  )
}
