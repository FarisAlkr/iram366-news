import { SPLASH_SKIP_ONCE_KEY } from '@/lib/splash'

import { SplashOverlay } from './SplashOverlay'

/**
 * Decides, before the overlay is parsed (so before it can paint), whether
 * this document load should show the splash at all:
 *
 *   • reload                            → show (reader refreshed the page)
 *   • navigate from another site / none → show (landing: Google, WhatsApp,
 *                                          typed URL, bookmark)
 *   • navigate from this site           → skip (a full-page hop between our
 *                                          own pages, incl. the admin's live
 *                                          preview frame)
 *   • back_forward / prerender          → skip
 *   • a load flagged with SPLASH_SKIP_ONCE_KEY (e.g. BackToHomeFallback's
 *     same-URL hop, which Chromium reports as a reload) → skip
 *
 * Client-side navigations never re-run this at all — the frontend layout,
 * and the overlay with it, stays mounted across <Link> transitions.
 * Skipping sets `data-splash="skip"` on <html> so CSS hides the overlay
 * before first paint, plus a window flag for SplashOverlay — if hydration
 * ever fails, React re-renders <html> and drops attributes it didn't render,
 * but the flag survives. (Removing the node here would break hydration.)
 */
const SPLASH_GATE = `(function () {
  try {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var type = nav ? nav.type : (performance.navigation && performance.navigation.type === 1 ? 'reload' : 'navigate');
    var show = type === 'reload';
    if (type === 'navigate') {
      var internal = false;
      try { internal = !!document.referrer && new URL(document.referrer).host === location.host; } catch (e) {}
      show = !internal;
    }
    try {
      if (sessionStorage.getItem('${SPLASH_SKIP_ONCE_KEY}')) {
        sessionStorage.removeItem('${SPLASH_SKIP_ONCE_KEY}');
        show = false;
      }
    } catch (e) {}
    if (!show) {
      window.__iramSplashSkip = true;
      document.documentElement.setAttribute('data-splash', 'skip');
    }
  } catch (e) {}
})();`

export function SplashScreen({ siteName }: { siteName: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_GATE }} />
      <SplashOverlay siteName={siteName} />
    </>
  )
}
