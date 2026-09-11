/**
 * The app's light/dark theme, applied where the browser can see it.
 *
 * Components style themselves from a `theme` prop, so nothing ever set the
 * `dark` class Tailwind is configured for. `body` therefore kept the light
 * `--background` in dark mode, and on a phone that showed: the page extends
 * under the status bar in standalone, so a white strip sat above a dark app.
 *
 * Keeping the class, `color-scheme` and the body colour in one place means
 * every page gets this, not just the one that happens to own the toggle.
 *
 * The system status bar is NOT one of these. An installed Android app paints
 * it from the manifest's theme_color, frozen at install, so it cannot follow
 * the toggle; the page's theme-color meta only still decides whether the clock
 * and battery are drawn light or dark. The two have to name the same colour or
 * the icons disappear into the bar, so both are pinned to the dark shade in
 * index.html and manifest.json, and nothing here touches them.
 */
const KEY = 'dailyQuestsTheme';

export const THEME_COLORS = { light: '#f9fafb', dark: '#0f1419' };

let current = null;
const listeners = new Set();

/**
 * Long enough to read as a fade, short enough not to feel laggy when the
 * toggle is tapped twice. Kept in step with the duration in index.css.
 */
const TRANSITION_MS = 260;
let transitionTimer = null;

/**
 * Fade the colours instead of snapping them.
 *
 * The class is only on during the change: leaving a blanket colour transition
 * on every element would also slow down hovers, presses and anything else that
 * repaints, so it goes on, the theme changes, and it comes off again.
 */
function withTransition(change) {
  const root = document.documentElement;
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    change();
    return;
  }

  root.classList.add('theme-transition');
  change();
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => root.classList.remove('theme-transition'), TRANSITION_MS);
}

/** The theme in force right now, without touching storage again. */
export function getTheme() {
  if (current === null) current = readTheme();
  return current;
}

/**
 * Change the theme everywhere.
 *
 * Pages used to read storage once on mount. Tabs stay mounted after the first
 * visit, so History and Profile were stuck with whatever the theme was when
 * they were first opened — toggling on the tracker never reached them.
 */
export function setTheme(next) {
  current = next;
  withTransition(() => {
    applyTheme(next);
    listeners.forEach((fn) => fn(next));
  });
}

export function subscribeTheme(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function readTheme() {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light'; // private mode, storage disabled
  }
}

export function applyTheme(theme) {
  const dark = theme === 'dark';
  const root = document.documentElement;

  root.classList.toggle('dark', dark);
  // Tells the browser to draw form controls, scrollbars and the area behind
  // the page in the matching shade.
  root.style.colorScheme = dark ? 'dark' : 'light';

  const color = THEME_COLORS[dark ? 'dark' : 'light'];

  // The theme-color meta is deliberately left alone — see STATUS_BAR_COLOR.
  // Painting `body` explicitly still matters: Tailwind's --background token is
  // a slightly different near-black, and the gap showed as a seam under the
  // bar.
  document.body.style.backgroundColor = color;

  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not being able to remember the choice is not worth failing over.
  }
}
