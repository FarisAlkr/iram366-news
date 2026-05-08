import { withPayload } from '@payloadcms/next/withPayload'

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

export default withPayload(nextConfig)
