'use client'

import React from 'react'

const STORAGE_KEY = 'iram366:reader-font-scale:v1'
const MIN_SCALE = 0.85
const MAX_SCALE = 1.5
const STEP = 0.1
const DEFAULT_SCALE = 1

const clampScale = (n: number) =>
  Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(n * 100) / 100))

/**
 * Reader zoom — small −/+ pill that scales the article body's font size up
 * or down. Reads/writes a CSS custom property `--reader-font-scale` on
 * <html>; `.prose` rules in globals.css multiply their `font-size` by this
 * value, so headings, paragraphs, lists, and blockquotes all scale
 * proportionally. The preference persists in localStorage.
 *
 * Five steps total: 85%, 95%, 100%, 110%, 120%, 130%, 140%, 150% (10% each).
 * `Reset` returns to 100% — useful after experimenting.
 */
export const ZoomControls: React.FC = () => {
  const [scale, setScale] = React.useState(DEFAULT_SCALE)

  // Load saved preference on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? parseFloat(raw) : DEFAULT_SCALE
    const next = Number.isFinite(parsed) ? clampScale(parsed) : DEFAULT_SCALE
    setScale(next)
    document.documentElement.style.setProperty('--reader-font-scale', String(next))
  }, [])

  const apply = (next: number) => {
    const clamped = clampScale(next)
    setScale(clamped)
    document.documentElement.style.setProperty('--reader-font-scale', String(clamped))
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(clamped))
    }
  }

  const dec = () => apply(scale - STEP)
  const inc = () => apply(scale + STEP)
  const reset = () => apply(DEFAULT_SCALE)

  const atMin = scale <= MIN_SCALE + 0.001
  const atMax = scale >= MAX_SCALE - 0.001
  const isDefault = Math.abs(scale - DEFAULT_SCALE) < 0.001

  return (
    <div
      className="zoom-controls"
      role="group"
      aria-label="حجم النص"
      dir="rtl"
    >
      <span className="zoom-controls__label">حجم النص</span>

      <button
        type="button"
        className="zoom-controls__btn"
        onClick={dec}
        disabled={atMin}
        aria-label="تصغير حجم النص"
      >
        <span className="zoom-controls__icon">−</span>
        <span className="zoom-controls__btn-letter">ا</span>
      </button>

      <button
        type="button"
        className="zoom-controls__value"
        onClick={reset}
        disabled={isDefault}
        aria-label={`الحجم الحالي ${Math.round(scale * 100)}٪. اضغط لإعادة الضبط`}
        title={isDefault ? 'الحجم الافتراضي' : 'إعادة للحجم الافتراضي'}
      >
        {Math.round(scale * 100)}%
      </button>

      <button
        type="button"
        className="zoom-controls__btn"
        onClick={inc}
        disabled={atMax}
        aria-label="تكبير حجم النص"
      >
        <span className="zoom-controls__btn-letter zoom-controls__btn-letter--big">ا</span>
        <span className="zoom-controls__icon">+</span>
      </button>
    </div>
  )
}

export default ZoomControls
