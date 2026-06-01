/**
 * Inline script that runs BEFORE React hydrates so the page never paints
 * in the wrong theme.
 *
 * Selection order (first match wins):
 *   1. `localStorage["iram366:theme"]` if it's `"dark"` or `"light"`
 *   2. `matchMedia('(prefers-color-scheme: dark)').matches` → dark
 *   3. light (default)
 *
 * The script is wrapped in a try/catch because some browsers (Safari
 * private mode historically, plus certain WebViews) throw on localStorage
 * access — we'd rather fall through to system preference than break the
 * whole page. The same string keys are used by ThemeProvider so the two
 * stay in lockstep.
 */

const THEME_INIT = `(function() {
  try {
    var stored = localStorage.getItem('iram366:theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
}
