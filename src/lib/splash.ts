/**
 * sessionStorage key read (and cleared) by the splash gate script in
 * components/SplashScreen.tsx: set it right before a programmatic page load
 * that should not show the splash. Needed because Chromium reports a
 * navigation to the URL you are already on as a "reload", which the gate
 * otherwise treats as a deliberate refresh.
 */
export const SPLASH_SKIP_ONCE_KEY = 'iram366:splash-skip-once'
