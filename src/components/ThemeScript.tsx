/**
 * Inline script that runs BEFORE React hydrates so the page never paints
 * in the wrong theme.
 *
 * Selection order (first match wins):
 *   1. `localStorage["iram366:theme"] === "light"` → light (the only way
 *      to land in light mode is an explicit, persisted user choice)
 *   2. dark (brand default for every other case — fresh visitors, system
 *      preference, missing localStorage, broken matchMedia, all land here)
 *
 * Wrapped in try/catch because some browsers (Safari private mode
 * historically, sandboxed WebViews) throw on localStorage access — we'd
 * rather fall through to the dark default than break the whole page.
 * The same string keys are used by useTheme so the two stay in lockstep.
 */

const THEME_INIT = `(function() {
  try {
    var stored = localStorage.getItem('iram366:theme');
    var theme = stored === 'light' ? 'light' : 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
}
