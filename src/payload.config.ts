import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { ar } from '@payloadcms/translations/languages/ar'
import { en } from '@payloadcms/translations/languages/en'
import sharp from 'sharp'

import { Users } from './payload/collections/Users.ts'
import { Articles } from './payload/collections/Articles.ts'
import { Categories } from './payload/collections/Categories.ts'
import { Media } from './payload/collections/Media.ts'
import { Pages } from './payload/collections/Pages.ts'
import { Series } from './payload/collections/Series.ts'
import { Locations } from './payload/collections/Locations.ts'
import { Subscribers } from './payload/collections/Subscribers.ts'
import { Notifications } from './payload/collections/Notifications.ts'
import { ArticleReviews } from './payload/collections/ArticleReviews.ts'
import { Ads } from './payload/collections/Ads.ts'
import { PageViews } from './payload/collections/PageViews.ts'
import { AuditLog } from './payload/collections/AuditLog.ts'
import { SiteSettings } from './payload/globals/SiteSettings.ts'
import { WeatherTowns } from './payload/globals/WeatherTowns.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const previewSecret = process.env.PAYLOAD_PREVIEW_SECRET || 'change-me-preview-secret'

// Email adapter is intentionally not wired yet. While SMTP env is unset,
// Payload logs password-reset / notification emails to the server console —
// safe behavior for the current dev stage. When real SMTP is added, swap
// this for a synchronously-importable adapter so we keep the config free of
// top-level await (which the Payload CLI's CJS loader cannot evaluate).

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      title: 'إرم 366 — لوحة التحكم',
      description: 'إدارة محتوى موقع إرم 366 الإخبارية',
      icons: [{ rel: 'icon', url: '/logo.jpeg' }],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: '/components/admin/Logo#Logo',
        Icon: '/components/admin/Icon#Icon',
      },
      beforeDashboard: ['/components/admin/AnalyticsWidget#AnalyticsWidget'],
      providers: [
        '/components/admin/KeyboardProvider#KeyboardProvider',
        '/components/admin/OnboardingTour#OnboardingTour',
        '/components/admin/NotificationBell#NotificationBell',
        // Floating one-click light/dark theme toggle in the corner.
        // Registered as a provider so it mounts on every admin page;
        // it portals the actual button to document.body so it floats
        // independent of the layout's stacking context.
        '/components/admin/ThemeToggle#ThemeToggle',
      ],
      // Custom admin route at /admin/stats — full-page editorial + audience
      // stats. See src/components/admin/StatsView.tsx.
      views: {
        stats: {
          Component: '/components/admin/StatsView#default',
          path: '/stats',
        },
      },
    },
    livePreview: {
      url: ({ data, collectionConfig }) => {
        // Only show the preview iframe once the article has been saved
        // (= has a slug). Returning an empty URL on a brand-new article
        // avoids an admin ↔ iframe postMessage feedback loop that crashed
        // the create page with an infinite render.
        if (collectionConfig?.slug === 'articles' && data?.slug) {
          return `${siteUrl}/preview/articles/${data.slug}?secret=${previewSecret}`
        }
        return ''
      },
      collections: ['articles'],
      breakpoints: [
        { label: 'هاتف', name: 'mobile', width: 375, height: 667 },
        { label: 'جهاز لوحي', name: 'tablet', width: 768, height: 1024 },
        { label: 'سطح المكتب', name: 'desktop', width: 1440, height: 900 },
      ],
    },
  },
  collections: [
    Users,
    Articles,
    Categories,
    Media,
    Pages,
    Series,
    Locations,
    Subscribers,
    Notifications,
    ArticleReviews,
    Ads,
    PageViews,
    AuditLog,
  ],
  globals: [SiteSettings, WeatherTowns],
  editor: lexicalEditor(),
  i18n: {
    fallbackLanguage: 'ar',
    supportedLanguages: { ar, en },
  },
  secret: process.env.PAYLOAD_SECRET || 'default-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // push only in dev; prod uses the migration pipeline (see
    // src/payload/migrations/). Leaving push on in production was the root
    // cause of the 2026-05-11 outage — a `signatureUi` group field was added
    // to SiteSettings and shipped, but push didn't run in the production
    // runtime image, so the schema diverged from the code and every page
    // querying the global returned 500. The deploy workflow now runs
    // `payload migrate` from a dedicated migrator container instead.
    push: process.env.NODE_ENV !== 'production',
    migrationDir: path.resolve(dirname, 'payload/migrations'),
    // Production pool tuning: pg defaults to max=10, no timeouts. Under
    // sustained load — or when one slow query holds a connection — that
    // exhausts in seconds and the entire app blocks. Explicit values:
    //   max: 30                    — headroom for concurrent requests
    //   idleTimeoutMillis: 30s     — release idle conns so the pool self-heals
    //   connectionTimeoutMillis    — fail fast when the pool is saturated
    //   statement_timeout: 30s     — kill runaway queries instead of letting
    //                                them tie up a connection forever
    pool: {
      connectionString: process.env.DATABASE_URL || '',
      max: 30,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    },
  }),
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
        },
      },
      bucket: process.env.R2_BUCKET || '',
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        endpoint: process.env.R2_ACCOUNT_ID
          ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
          : undefined,
        region: 'auto',
      },
    }),
  ],
  sharp,
})
