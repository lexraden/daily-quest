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
 *  - /assets/ is cache-first, and ONLY /assets/, which is safe precisely
 *    because Vite puts a content hash in each filename — a changed file is a
 *    different URL. Everything else keeps its name forever: caching
 *    manifest.json or an icon this way meant a change to it could never reach
 *    a phone that had already loaded it once. Those go to the network first
 *    and fall back to the cache only when offline.
 *
 * Bump CACHE to retire everything the previous version stored.
 */
const CACHE = 'dailyq-v3';
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

  // `basic` excludes opaque cross-origin responses, which cannot be inspected
  // and would poison the cache with unknown failures.
  const keep = (response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
    }
    return response;
  };

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then(keep)),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(keep)
      .catch(() => caches.match(event.request).then((hit) => hit || Response.error())),
  );
});

/**
 * The app asking to be updated now.
 *
 * Our install handler already calls skipWaiting(), so a worker sitting in
 * `waiting` is the exception rather than the rule — but when the browser does
 * hold one back, this is what releases it, and the "check for update" button
 * has nothing else to pull.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting();
});

/**
 * A reminder arriving while the app is closed.
 *
 * The payload is JSON the server encrypted to this browser. A push that cannot
 * be read still has to show something: a notification is mandatory once the
 * event fires, and a browser that gets none may revoke the permission or show
 * its own "site updated in the background" instead.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'DailyQ';

  /**
   * Tell any open copy of the app that the log has grown.
   *
   * The badge in the header is a number fetched from the server, and the app
   * cannot know a reminder arrived unless something says so — a push delivered
   * while the tab is merely in the background would otherwise leave the bell
   * looking empty until the next time the app was resumed.
   */
  const tellTheApp = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windows) => {
      for (const client of windows) client.postMessage({ type: 'notification-arrived' });
    })
    .catch(() => {
      // Nothing open, or messaging refused. The notification is what matters.
    });

  const show = self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    // Android draws the badge in the status bar from its alpha channel alone,
    // so the full-colour app icon came out as a solid white square. This one
    // is a white check on transparency, which is what that mask needs.
    badge: '/badge-96.png',
    // Same tag replaces rather than stacks: a second evening reminder should
    // not sit under the first one in the shade.
    tag: data.tag || 'dailyq-reminder',
    renotify: true,
    data: { url: data.url || '/' },
  });

  // Showing it is the part the browser insists on, so it is the part that must
  // not be held up by the message failing.
  event.waitUntil(Promise.all([show, tellTheApp]));
});

/**
 * Tapping it. Focuses the app if it is already open somewhere rather than
 * opening a second copy — the streak is on the screen the user already has.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin) {
          return client.focus().then((focused) => focused?.navigate?.(target.href));
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
