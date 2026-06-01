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
 * Site header — one sticky bar that holds two rows:
 *   Row 0 — WeatherDateBar (live town + clock at the very top)
 *   Row 1 — Combined chrome: hamburger menu (RTL start), brand wordmark
 *           centered, theme + search buttons (RTL end). The dedicated
 *           category-strip row was removed; the hamburger is now the
 *           sole entry point for section navigation, opening a dropdown
 *           that lists every category.
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

        {/* Brand row — three flex regions distributed with justify-between:
            menu button at the RTL start, brand wordmark Link in the middle,
            theme + search buttons at the RTL end. The wordmark used to wrap
            the whole row in one <Link>; that's no longer possible now that
            the row contains real buttons (hamburger, theme, search), so the
            Link is scoped to just the name+logo cluster.
            DOM order inside the Link is Arabic → logo → English; RTL flex
            lays them out as: ┌ Arabic ┬ logo ┬ English ┐ (Arabic at the
            RTL start). The English name is hidden below `sm` so the row
            breathes alongside the action buttons on phones. */}
        <div className="container-news">
          <div className="flex items-center justify-between gap-2 py-2 md:py-3">
            <CategoryMenu categories={categories} />

            <Link
              href="/"
              aria-label={`${siteName} — الصفحة الرئيسية`}
              className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80 sm:gap-3 md:gap-4"
            >
              <span className="iram-bar-brand__arabic min-w-0 whitespace-nowrap font-display text-sm font-extrabold tracking-tight text-white sm:text-lg md:text-2xl">
                {siteName}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- needs CSS mask, Next/Image strips style */}
              <img
                src="/splash-logo.jpeg"
                alt=""
                aria-hidden
                className="iram-bar-brand__icon h-8 w-auto flex-shrink-0 sm:h-12 md:h-16"
              />
              <span
                dir="ltr"
                className="iram-bar-brand__english hidden min-w-0 whitespace-nowrap font-display font-extrabold tracking-tight text-white sm:inline-block sm:text-lg md:text-2xl"
              >
                Iram 366 News
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
