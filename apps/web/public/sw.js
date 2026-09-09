/**
 * Service worker — the minimum that makes DailyQ installable, and nothing that
 * can strand someone on a stale build.
 *
 * The rules, in order of how much damage each could do:
 *
 *  - /api/ is never touched. Auth, quest data and signed image URLs are
 *    per-user and change constantly; a cached one would be wrong at best and
 *    another user's at worst.
 *  - Navigations go to the network first and fall back to the cached shell only
 *    when the network fails. Serving a cached index.html ahead of the network
 *    is how a deploy strands people: the old shell asks for asset hashes that
 *    no longer exist, and the app comes up blank with no way to refresh past it.
 *  - /assets/ is cache-first, which is safe precisely because Vite puts a
 *    content hash in each filename — a changed file is a different URL.
 *
 * Bump CACHE to retire everything the previous version stored.
 */
const CACHE = 'dailyq-v1';
const SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => {}) // an offline install must not fail the worker
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Only same-origin GETs are ours to think about. */
function isCacheable(request, url) {
  return (
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/api/')
  );
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!isCacheable(event.request, url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(SHELL, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request).then((response) => {
          // `basic` excludes opaque cross-origin responses, which cannot be
          // inspected and would poison the cache with unknown failures.
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        }),
    ),
  );
});
