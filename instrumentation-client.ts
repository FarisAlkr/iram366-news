/**
 * Client-side Sentry init. Loaded automatically by @sentry/nextjs on the
 * browser. NEXT_PUBLIC_SENTRY_DSN must be set at BUILD time (Next.js inlines
 * NEXT_PUBLIC_* into the client bundle); otherwise the SDK is a no-op.
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sized for the free Developer tier post-trial (~2026-05-28). 0.5%
  // client sampling matches the 1% server rate scaled down for the
  // higher request volume browsers generate (every interaction +
  // navigation, not just request handlers). Errors are still captured
  // at 100% — only perf traces are sampled. Bump back to 5% if quota
  // headroom shows up after a few weeks of real traffic.
  tracesSampleRate: 0.005,
  // Session replay only on errors, free-tier-friendly. Set to 0/0 if you
  // want to turn it off entirely later.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: false,
  environment: process.env.NODE_ENV,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
