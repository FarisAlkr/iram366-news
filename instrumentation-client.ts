/**
 * Client-side Sentry init. Loaded automatically by @sentry/nextjs on the
 * browser. NEXT_PUBLIC_SENTRY_DSN must be set at BUILD time (Next.js inlines
 * NEXT_PUBLIC_* into the client bundle); otherwise the SDK is a no-op.
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Lower than the server sample — the browser SDK adds bytes and the free
  // tier's 5K-event budget is shared. 5% catches frequent breakage without
  // blowing the quota the first weekend of real traffic.
  tracesSampleRate: 0.05,
  // Session replay only on errors, free-tier-friendly. Set to 0/0 if you
  // want to turn it off entirely later.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: false,
  environment: process.env.NODE_ENV,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
