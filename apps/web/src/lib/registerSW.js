/**
 * Registers the service worker that makes the app installable.
 *
 * Only in production: in dev it would sit in front of Vite's module graph and
 * serve yesterday's code. Failure is not reported to the user — an install
 * that does not happen costs the home-screen icon, not the app.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
