import { FlatCompat } from '@eslint/eslintrc'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'src/payload-types.ts',
      'src/payload/migrations/**',
      'coverage/**',
      'public/**',
      '.next/types/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'prettier'),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/no-unescaped-entities': 'off',
      'react/jsx-key': 'error',
      '@next/next/no-img-element': 'warn',
    },
  },
  {
    files: ['src/components/admin/**/*.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
      // Payload admin pages aren't Next.js pages — they're Payload's own
      // routing under /admin/. <a> is correct here; next/link would attempt
      // to client-route through Next's router and break the admin UI.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/seed.ts', 'src/lib/logger.ts', '**/*.config.{ts,js,mjs}'],
    rules: {
      'no-console': 'off',
    },
  },
]

export default config
