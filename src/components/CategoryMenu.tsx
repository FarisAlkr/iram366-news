'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { Category } from '@/types/payload'

interface Props {
  categories: Pick<Category, 'name' | 'slug'>[]
}

/**
 * Hamburger menu that opens a dropdown listing the site's sections. Used
 * to be conditional on scroll position (with a horizontal strip as the
 * top-of-page state), but the strip was removed; the hamburger is now the
 * sole entry point for category navigation and lives in the brand row.
 *
 * The dropdown is `absolute inset-x-0 top-full` — its containing block is
 * the sticky <header> (sticky positioning establishes one), so the panel
 * opens flush below the entire sticky band, never overlapping content
 * inside it.
 */
export function CategoryMenu({ categories }: Props) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Outside click + Escape close the panel. Listeners are only attached
  // while the panel is open so the closed state has no runtime overhead.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (dropdownRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="primary-nav-menu"
        aria-label={open ? 'إغلاق قائمة الأقسام' : 'فتح قائمة الأقسام'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <HamburgerIcon open={open} />
      </button>

      <div
        ref={dropdownRef}
        id="primary-nav-menu"
        role="menu"
        aria-hidden={!open}
        className={`absolute inset-x-0 top-full border-t border-white/10 bg-navy text-white shadow-[var(--shadow-nav)] transition-all duration-200 motion-reduce:transition-none ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        <nav
          className="container-news grid grid-cols-2 gap-1 py-3 sm:grid-cols-3 md:grid-cols-4"
          aria-label="الأقسام"
        >
          <DropdownLink href="/" label="الرئيسية" onSelect={() => setOpen(false)} />
          {categories.map((cat) => (
            <DropdownLink
              key={cat.slug}
              href={`/category/${cat.slug}`}
              label={cat.name}
              onSelect={() => setOpen(false)}
            />
          ))}
        </nav>
      </div>
    </>
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
  // keeps the bars vertically aligned during the rotate; no layout jumps.
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
