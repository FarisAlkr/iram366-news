'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { Category } from '@/types/payload'
import { SearchToggle } from './SearchToggle'
import { ThemeToggle } from './ThemeToggle'

interface Props {
  categories: Pick<Category, 'name' | 'slug'>[]
}

// Past this scroll depth the full category strip is replaced by a
// hamburger + label. Sized so the strip stays visible while the weather
// bar + brand wordmark are still on screen; only collapses once the
// sticky header is the only chrome left.
const COLLAPSE_THRESHOLD_PX = 120

export function CategoriesNav({ categories }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Track scroll position via rAF — passive listener, single pending frame.
  useEffect(() => {
    let raf = 0
    const sync = () => {
      raf = 0
      setCollapsed(window.scrollY > COLLAPSE_THRESHOLD_PX)
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(sync)
    }
    sync()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Scrolling back to the top re-expands the nav; auto-close the dropdown
  // so we don't leave a stale open panel attached to a hidden trigger.
  useEffect(() => {
    if (!collapsed) setMenuOpen(false)
  }, [collapsed])

  // Outside click + Escape close the dropdown.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (dropdownRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <>
      <div className="container-news">
        <div className="flex min-h-[44px] items-center gap-2 py-1.5 md:py-2">
          {collapsed ? (
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="primary-nav-menu"
              aria-label={menuOpen ? 'إغلاق قائمة الأقسام' : 'فتح قائمة الأقسام'}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors duration-150 hover:bg-white/10"
            >
              <HamburgerIcon open={menuOpen} />
              <span className="font-display text-sm font-medium md:text-base">الأقسام</span>
            </button>
          ) : (
            <nav
              className="scrollbar-hide -mx-2 flex flex-1 items-center gap-1 overflow-x-auto px-2 md:justify-center md:gap-2"
              aria-label="التنقل الرئيسي"
            >
              <CategoryLink href="/" label="الرئيسية" />
              {categories.map((cat) => (
                <CategoryLink key={cat.slug} href={`/category/${cat.slug}`} label={cat.name} />
              ))}
            </nav>
          )}
          <div className="ms-auto flex flex-shrink-0 items-center gap-1">
            <ThemeToggle />
            <SearchToggle />
          </div>
        </div>
      </div>

      {/* Dropdown panel — anchored to the sticky <header> (its `position: sticky`
          creates the containing block, since no nearer ancestor is positioned).
          `top-full` therefore drops the panel below the entire sticky band,
          including the breaking ticker, instead of overlapping it. Mounted only
          when collapsed so the closed panel can't intercept pointer events
          while the full strip is showing. */}
      {collapsed && (
        <div
          ref={dropdownRef}
          id="primary-nav-menu"
          role="menu"
          aria-hidden={!menuOpen}
          className={`absolute inset-x-0 top-full border-t border-white/10 bg-navy text-white shadow-[var(--shadow-nav)] transition-all duration-200 motion-reduce:transition-none ${
            menuOpen
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-1 opacity-0'
          }`}
        >
          <nav
            className="container-news grid grid-cols-2 gap-1 py-3 sm:grid-cols-3 md:grid-cols-4"
            aria-label="الأقسام"
          >
            <DropdownLink href="/" label="الرئيسية" onSelect={() => setMenuOpen(false)} />
            {categories.map((cat) => (
              <DropdownLink
                key={cat.slug}
                href={`/category/${cat.slug}`}
                label={cat.name}
                onSelect={() => setMenuOpen(false)}
              />
            ))}
          </nav>
        </div>
      )}
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

function DropdownLink({
  href,
  label,
  onSelect,
}: {
  href: string
  label: string
  onSelect: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      role="menuitem"
      className="block rounded px-3 py-2 font-display text-sm font-medium transition-colors duration-150 hover:bg-white/10 md:text-base"
    >
      {label}
    </Link>
  )
}

function HamburgerIcon({ open }: { open: boolean }) {
  // Three-line glyph that morphs into an X when `open`. Absolute positioning
  // keeps the bars vertically aligned during the rotate, no layout jumps.
  return (
    <span aria-hidden className="relative inline-block h-5 w-5">
      <span
        className={`absolute inset-x-0 block h-0.5 bg-current transition-all duration-200 motion-reduce:transition-none ${
          open ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-1'
        }`}
      />
      <span
        className={`absolute inset-x-0 top-1/2 block h-0.5 -translate-y-1/2 bg-current transition-opacity duration-150 motion-reduce:transition-none ${
          open ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <span
        className={`absolute inset-x-0 block h-0.5 bg-current transition-all duration-200 motion-reduce:transition-none ${
          open ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'bottom-1'
        }`}
      />
    </span>
  )
}
