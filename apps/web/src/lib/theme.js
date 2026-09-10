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
  applyTheme(next);
  listeners.forEach((fn) => fn(next));
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

  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', color);

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
