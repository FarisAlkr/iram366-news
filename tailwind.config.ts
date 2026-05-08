import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0a2a2f',
          light: '#133a40',
          dark: '#071e22',
        },
        cream: {
          DEFAULT: '#fafaf9',
          dark: '#f5f5f0',
        },
        accent: {
          red: '#c8a84e',
          'red-dark': '#b0923e',
          gold: '#c8a84e',
          'gold-dark': '#b0923e',
        },
        ink: '#1a1a1a',
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
            'blockquote': {
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
