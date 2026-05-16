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

  // Suppress noise from the UserWay accessibility widget. UserWay's
  // bundle (cdn.userway.org/widgetapp/...) is third-party JS we can't
  // patch; two failure modes are already in the Sentry inbox:
  //   • SyntaxError "Invalid regular expression: invalid group
  //     specifier name" on iOS Safari < 16.4 (lookbehind / named-group
  //     regex not supported in older WebKit).
  //   • TypeError "Load failed" when their api.userway.org polling
  //     hits a flaky mobile network.
  // Both leave the rest of the page working. Without filtering, every
  // mobile reader with intermittent signal can produce dozens of
  // events — at 100% error capture these would dominate the inbox and
  // bury real issues.
  ignoreErrors: [/Invalid regular expression: invalid group specifier name/],
  denyUrls: [/cdn\.userway\.org/, /widgetapp\//],
  beforeSend(event, hint) {
    // 1) Drop any event whose stack trace touches the UserWay bundle.
    //    denyUrls above usually catches this, but it varies between
    //    Sentry browser SDK versions whether it matches any frame or
    //    just the originating one. Explicit scan is deterministic.
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? []
    const userwayInStack = frames.some((f) => {
      const file = f.filename ?? f.abs_path ?? ''
      return /userway|widgetapp/i.test(file)
    })
    if (userwayInStack) return null

    // 2) Drop "Load failed" / "Failed to fetch" rejections whose
    //    recent fetch breadcrumbs hit UserWay's API. Catches the case
    //    where the rejection bubbles up through our own chunk so the
    //    top frame isn't in the UserWay bundle, but the failed network
    //    call unmistakably was.
    const err = hint?.originalException
    const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
    if (msg === 'Load failed' || msg === 'Failed to fetch') {
      const fromUserwayApi = (event.breadcrumbs ?? []).some((b) => {
        const url =
          b.data && typeof (b.data as { url?: unknown }).url === 'string'
            ? (b.data as { url: string }).url
            : ''
        return /userway\.org/.test(url)
      })
      if (fromUserwayApi) return null
    }

    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
