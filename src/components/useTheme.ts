'use client'

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'iram366:theme'

/**
 * Read the current theme from the DOM. ThemeScript sets the `.dark` class
 * before hydration, so this is the source of truth on first render and
 * stays in sync with localStorage thereafter.
 */
function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  const html = document.documentElement
  if (theme === 'dark') html.classList.add('dark')
  else html.classList.remove('dark')
  // `color-scheme` informs the UA's default form controls / scrollbars
  // so they match the page palette (dark scrollbar in dark mode, etc.)
  html.style.colorScheme = theme
}

/**
 * Tiny theme hook. No context, no provider — the theme state is the DOM
 * class itself, so any component can read or flip it and stay consistent.
 *
 * `toggle` writes localStorage so the choice persists; `theme` re-renders
 * the calling component when the value changes via a `storage` event
 * (other tabs) or a same-tab `themechange` CustomEvent dispatched below.
 */
export function useTheme(): {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
} {
  const [theme, setThemeState] = useState<Theme>('light')

  // Initial sync from the DOM. Lives in an effect so the first server-
  // rendered markup matches the default ('light') and hydration doesn't
  // mismatch — ThemeScript has already painted the actual theme, so the
  // visible page is correct from frame 0 regardless of this state.
  useEffect(() => {
    setThemeState(readTheme())
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(readTheme())
    }
    const onLocal = () => setThemeState(readTheme())
    window.addEventListener('storage', onStorage)
    window.addEventListener('iram366:themechange', onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('iram366:themechange', onLocal)
    }
  }, [])

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // private-mode / sandboxed iframes — best effort, the DOM class is
      // still updated for the current session.
    }
    setThemeState(next)
    window.dispatchEvent(new CustomEvent('iram366:themechange'))
  }, [])

  const toggle = useCallback(() => {
    setTheme(readTheme() === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  return { theme, toggle, setTheme }
}
