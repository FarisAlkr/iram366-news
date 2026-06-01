import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  // Class-based dark mode: presence of `.dark` on <html> activates `dark:*`
  // variants and the override block in globals.css. Theme is selected by the
  // ThemeProvider (system preference + persisted user choice) and applied
  // pre-hydration by ThemeScript to avoid a flash of the wrong theme.
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colors — fixed in both themes; the header bar stays dark navy
        // and the gold accent reads correctly on every surface.
        navy: {
          DEFAULT: '#0a2a2f',
          light: '#133a40',
          dark: '#071e22',
        },
        accent: {
          red: '#c8a84e',
          'red-dark': '#b0923e',
          gold: '#c8a84e',
          'gold-dark': '#b0923e',
        },
        // Theme-aware semantic tokens: each maps to a CSS variable whose
        // value is set in :root (light) and overridden under .dark in
        // globals.css. Components using bg-cream / text-ink / bg-surface
        // automatically respect the active theme without per-class dark:
        // variants.
        cream: {
          DEFAULT: 'var(--color-bg)',
          dark: 'var(--color-cream-dark)',
        },
        // Triplet form so `bg-ink/5`, `text-ink/60`, etc. work — Tailwind
        // substitutes the alpha into the placeholder when an opacity
        // modifier is present, and leaves the channel-space syntax intact
        // otherwise. Direct `var(--color-ink)` references in CSS still
        // resolve to the hex value via the matching variable.
        ink: 'rgb(var(--color-ink-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-2)',
        },
      },
      fontFamily: {
        display: ['var(--font-kufi)', 'sans-serif'],
        body: ['var(--font-ibm)', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            direction: 'rtl',
            maxWidth: '720px',
            lineHeight: '1.9',
            fontSize: '1.125rem',
            blockquote: {
              borderLeftWidth: '0',
              borderRightWidth: '4px',
              borderRightColor: 'var(--tw-prose-quote-borders)',
              paddingRight: '1em',
              paddingLeft: '0',
            },
          },
        },
      },
    },
  },
  plugins: [typography],
}

export default config
