/**
 * Next.js instrumentation hook — entry point for Sentry's server and edge
 * runtimes. Called once per worker boot. With SENTRY_DSN unset the SDK
 * becomes a no-op, so dev and unfilled production deploys are safe.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // Trace sample rate sized for the free Developer tier (5K errors +
      // 10K perf units/month) that kicks in when the Business trial ends
      // ~2026-05-28. Earlier 10% sampling was fine for the trial but
      // would burn through the monthly quota in 2-3 days at realistic
      // traffic. 1% sampling on the server is enough to surface latency
      // outliers without flirting with the ceiling.
      tracesSampleRate: 0.01,
      // Server runtime: capture errors with stack traces, drop PII.
      sendDefaultPii: false,
      environment: process.env.NODE_ENV,
    })
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.01,
      sendDefaultPii: false,
      environment: process.env.NODE_ENV,
    })
  }
}

export const onRequestError = Sentry.captureRequestError
