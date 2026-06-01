import Link from 'next/link'

import type { Category, Media } from '@/types/payload'
import { getWeatherTowns } from '@/lib/queries'
import { AdSlot } from './AdSlot'
import { BreakingTicker } from './BreakingTicker'
import { CategoryMenu } from './CategoryMenu'
import { SearchToggle } from './SearchToggle'
import { ThemeToggle } from './ThemeToggle'
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
 * Site header — split into two pieces:
 *
 *   • WeatherDateBar (live town + clock) sits in NORMAL FLOW at the very
 *     top of the page. It scrolls away naturally as the reader moves
 *     down, freeing ~64px of viewport. A previous version animated it
 *     inside the sticky <header>, but shrinking a sticky element's box
 *     while pinned causes scroll-anchoring jumps ("the page takes me
 *     up") and reflows the row below on every animation frame ("upper
 *     bars lag"). Returning the bar to flow eliminates both.
 *
 *   • Sticky <header> below contains the single combined chrome row:
 *     hamburger menu (RTL start), brand wordmark Link (centered),
 *     theme + search buttons (RTL end). The hamburger opens a dropdown
 *     listing every section — sole entry point for category navigation.
 *
 * The breaking ticker stays as a sibling below the sticky and scrolls
 * away with the page content.
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

      {/* Non-sticky weather/date strip — scrolls away naturally so the
          sticky bar below stays a constant height (no reflow jank). */}
      <WeatherDateBar towns={towns} />

      <header className="sticky top-0 z-50 bg-navy text-white shadow-[var(--shadow-nav)]">
        {/* Brand row — three flex regions distributed with justify-between:
            menu button at the RTL start, brand wordmark Link in the middle,
            theme + search buttons at the RTL end. The wordmark is the
            Arabic site name; the English transliteration and the logo
            image were both removed at client request, so the Arabic
            typography is the entire brand. The aria-label still uses
            `siteName` so the accessible name reflects whatever the CMS
            records as the formal site name. */}
        <div className="container-news">
          <div className="flex items-center justify-between gap-2 py-3 md:py-4">
            <CategoryMenu categories={categories} />

            <Link
              href="/"
              aria-label={`${siteName} — الصفحة الرئيسية`}
              className="flex min-w-0 items-center transition-opacity hover:opacity-80"
            >
              <span className="min-w-0 whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-white sm:text-xl md:text-2xl">
                إرم الإخبارية 366
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <ThemeToggle />
              <SearchToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Breaking ticker — a redesigned, multi-row block (heading + playback
          controls + horizontal item track), so it lives in the regular page
          flow directly under the sticky bar instead of inside it. Renders
          only when at least one breaking article exists. */}
      {breakingArticles.length > 0 && <BreakingTicker articles={breakingArticles} />}
    </>
  )
}
