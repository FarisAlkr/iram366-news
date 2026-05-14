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
      // Sample 10% of traces in prod to stay well under the 5K/month free
      // tier. Local dev defaults to off entirely (no DSN).
      tracesSampleRate: 0.1,
      // Server runtime: capture errors with stack traces, drop PII.
      sendDefaultPii: false,
      environment: process.env.NODE_ENV,
    })
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      environment: process.env.NODE_ENV,
    })
  }
}

export const onRequestError = Sentry.captureRequestError
