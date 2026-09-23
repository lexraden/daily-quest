/* global __BUILD_ID__ */

/**
 * Whether this tab is running the build the server is currently serving, and
 * how to get onto it if not.
 *
 * An installed PWA is the case that needs this. The service worker takes over
 * eagerly and navigations go to the network first, so a browser tab picks up a
 * deploy on its next reload — but a phone keeps the app resumed for days
 * without ever reloading, and the browser re-checks sw.js on its own schedule,
 * not ours. So there has to be a way to ask.
 *
 * The comparison is against /api/health rather than against anything the
 * service worker knows, because the API and this bundle are built and deployed
 * together: one commit, one release. If those two strings differ, this tab is
 * behind, and no amount of asking the cache would have revealed it.
 */

const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'local';

/** The commit this bundle was built from, or 'local' outside a deploy. */
export const currentBuild = () => BUILD_ID;

/** Short enough to show, long enough to be unambiguous. */
export const shortBuild = (id) => (id && id !== 'local' ? id.slice(0, 7) : id || 'local');

/**
 * Asks the server what it is serving.
 *
 * `cache: 'no-store'` because the whole point is to bypass anything that might
 * answer with what we already believe. /api/ is never touched by the service
 * worker, so this reaches the network or fails.
 *
 * Returns one of:
 *   'current' — this tab is up to date
 *   'update'  — the server has a different build
 *   'unknown' — offline, or a build with no id to compare (dev, local)
 */
export async function checkForUpdate() {
  if (BUILD_ID === 'local') return { status: 'unknown', commit: null };

  let serverCommit = null;
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return { status: 'unknown', commit: null };
    serverCommit = (await res.json())?.commit ?? null;
  } catch {
    return { status: 'unknown', commit: null };
  }

  // A server that cannot name its own build cannot tell us we are behind.
  if (!serverCommit || serverCommit === 'local') return { status: 'unknown', commit: null };

  return {
    status: serverCommit === BUILD_ID ? 'current' : 'update',
    commit: serverCommit,
  };
}

/**
 * Gets onto the new build, and does not come back.
 *
 * Three things have to happen and the order matters: the worker is told to
 * re-fetch itself, anything it is holding is dropped, and only then does the
 * page reload. Reloading first would just re-run the same cached shell and the
 * button would look broken.
 *
 * Every step is best-effort. A browser with no service worker, one that refuses
 * to open the cache, a registration that has gone away — none of that should
 * stop the reload, which on its own fixes the common case.
 */
export async function applyUpdate() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();

    // Re-fetch sw.js now rather than whenever the browser would have.
    await registration?.update?.().catch(() => {});

    // Our worker calls skipWaiting() on install, so a waiting one is unusual —
    // but if the browser held it back, this is what releases it.
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'skip-waiting' });
    }

    // The shell and the old hashed assets. Content hashes mean the new build
    // asks for different filenames anyway; this is about the cached index.html,
    // which keeps its name and points at the assets that no longer exist.
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Fall through to the reload regardless.
  }

  window.location.reload();
}
