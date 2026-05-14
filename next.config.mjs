import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'

const r2Public = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : null

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output produces a self-contained server in .next/standalone for
  // a slim Docker runtime image. See the multi-stage Dockerfile.
  output: 'standalone',

  // Don't ship sourcemaps in production by default; turn on when you need
  // them by setting NEXT_PUBLIC_ENABLE_SOURCEMAPS=1.
  productionBrowserSourceMaps: process.env.NEXT_PUBLIC_ENABLE_SOURCEMAPS === '1',

  poweredByHeader: false,
  reactStrictMode: true,

  experimental: {
    serverActions: {
      // Phone photos can be 10-20 MB raw; some editors paste DSLR images
      // even larger. 30 MB ceiling lets normal use through while still
      // capping accidental uploads of multi-hundred-MB files.
      bodySizeLimit: '30mb',
    },
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      // Custom CDN domain for R2 (e.g. media.iram366news.com).
      // Hardcoded because R2_PUBLIC_URL is not exposed as a Docker build
      // arg — at build time the dynamic block below sees `undefined`.
      { protocol: 'https', hostname: '**.iram366news.com' },
      ...(r2Public
        ? [
            {
              protocol: r2Public.protocol.replace(':', ''),
              hostname: r2Public.hostname,
            },
          ]
        : []),
    ],
  },
}

// Wrap order matters: Payload's withPayload sets up the @payload-config
// alias and pulls in its webpack plugin; Sentry's withSentryConfig wraps
// the result to upload source maps and inject error tracking. Both are
// no-ops when their env vars are unset, so local dev stays unchanged.
export default withSentryConfig(withPayload(nextConfig), {
  // Auth token + org/project come from env at CI time. With them unset
  // the wrapper still emits the runtime SDK; only source-map upload is
  // skipped. See docs/sentry-setup.md for the full provisioning steps.
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Hide source maps from end users while keeping symbolicated traces in
  // Sentry. Without this the .map files end up shipped in the public
  // bundle (which we already disabled via productionBrowserSourceMaps).
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
