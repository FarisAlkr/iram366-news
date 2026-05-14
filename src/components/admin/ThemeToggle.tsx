'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@payloadcms/ui'

/**
 * One-click light/dark theme toggle for the Payload admin.
 *
 * Renders as a small fixed-position icon button at the top edge of the
 * viewport, persistently visible on every admin page (dashboard, list
 * views, doc edits). Uses Payload's own `useTheme()` hook so the choice
 * persists to the user's stored preferences — flipping here is the same
 * as flipping from the account menu, except one click instead of three.
 *
 * Why a portal: Payload's admin doesn't have a global "top bar slot" we
 * can render into directly. The cleanest way to put a button at the top
 * of every admin page is to mount it via `components.providers` (which
 * wraps the entire admin tree) and portal the actual UI to document.body
 * so it floats above the sidebar / main content regardless of layout.
 *
 * Positioning: physical left/top corner (not RTL-logical) so the toggle
 * sits AWAY from the right-side sidebar in this RTL admin — gives it
 * its own un-collided real estate.
 */
export const ThemeToggle: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark'

  const onToggle = () => {
    setTheme(next)
  }

  return (
    <>
      {children}
      {mounted &&
        createPortal(
          <button
            type="button"
            className={`iram-theme-toggle iram-theme-toggle--${theme}`}
            onClick={onToggle}
            aria-label={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            title={theme === 'dark' ? 'الوضع النهاري (Light)' : 'الوضع الليلي (Dark)'}
          >
            {/* Sun icon — shown in dark mode (= "switch to light") */}
            <svg
              className="iram-theme-toggle__icon iram-theme-toggle__icon--sun"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>

            {/* Moon icon — shown in light mode (= "switch to dark") */}
            <svg
              className="iram-theme-toggle__icon iram-theme-toggle__icon--moon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>,
          document.body,
        )}
    </>
  )
}

export default ThemeToggle
