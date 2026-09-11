/**
 * The app's light/dark theme, applied where the browser can see it.
 *
 * Components style themselves from a `theme` prop, so nothing ever set the
 * `dark` class Tailwind is configured for. `body` therefore kept the light
 * `--background` in dark mode, and on a phone that showed: the page extends
 * under the status bar in standalone, so a white strip sat above a dark app.
 *
 * Keeping the class, `color-scheme` and the `theme-color` meta in one place
 * means every page gets this, not just the one that happens to own the toggle.
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

  // Replace the element rather than edit it. Chrome appears to sample
  // theme-color once and ignore a later change to the attribute — the status
  // bar kept whatever the theme was when the page loaded, so toggling to light
  // left a dark bar above a light app. Removing the node and inserting a fresh
  // one makes it look again.
  const previous = document.getElementById('theme-color-meta');
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.id = 'theme-color-meta';
  meta.content = color;
  if (previous) previous.remove();
  document.head.appendChild(meta);

  // In standalone the page runs under the status bar, so whatever `body` is
  // painted with shows through there. Matching it to the app's own top colour
  // exactly — rather than leaving it on Tailwind's near-black token — keeps
  // that strip from reading as a separate band.
  document.body.style.backgroundColor = color;

  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not being able to remember the choice is not worth failing over.
  }
}
