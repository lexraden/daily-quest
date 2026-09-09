import { api } from '@/api/client';

// Simple in-memory cache shared across pages
const cache = {
  user: null,
  userData: null,
  userDataId: null,
  lastFetch: 0,
  fetching: null, // promise for deduplication
};

const CACHE_TTL = 30000; // 30 seconds

// Retry wrapper with exponential backoff for rate-limited (429) requests
async function withRetry(fn, { retries = 3, baseDelay = 500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.response?.status;
      if (status !== 429 || attempt === retries) throw err;
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export async function getCachedUser() {
  if (cache.user) return cache.user;
  const user = await withRetry(() => api.auth.me());
  cache.user = user;
  return user;
}

/**
 * The save currently on its way to the server, if any.
 *
 * A forced read has to wait for it. Otherwise switching to Statistics right
 * after logging a meal reads the row back before the write lands, and then
 * caches that stale answer — the edit appears to undo itself.
 */
let inFlightSave = null;

export function noteInFlightSave(promise) {
  inFlightSave = promise;
  const done = () => { if (inFlightSave === promise) inFlightSave = null; };
  promise.then(done, done);
}

/**
 * The tracker's "send the queued save now" function, if it is mounted.
 *
 * Tabs stay mounted once visited, so switching to Statistics does not unmount
 * the tracker and does not end its 800ms debounce. Without this, a meal logged
 * a moment before switching is still only queued when the other tab reads the
 * row.
 */
let pendingFlush = null;

export function registerPendingFlush(fn) {
  pendingFlush = fn;
  return () => { if (pendingFlush === fn) pendingFlush = null; };
}

export async function settleInFlightSave() {
  // A failed save must not stop the read; the error is reported by whoever
  // issued the save.
  if (pendingFlush) await Promise.resolve(pendingFlush()).catch(() => {});
  if (inFlightSave) await inFlightSave.catch(() => {});
}

/**
 * `force` skips the TTL — for a page that has just become visible and must not
 * show what the row looked like up to 30 seconds ago.
 */
export async function getCachedUserData({ force = false } = {}) {
  if (force) await settleInFlightSave();
  const now = Date.now();

  // Return cached if fresh
  if (!force && cache.userData && cache.lastFetch && (now - cache.lastFetch < CACHE_TTL)) {
    return { data: cache.userData, id: cache.userDataId };
  }

  // Deduplicate concurrent requests. A forced read joins one already running:
  // it was started after the save settled too, so its answer is just as fresh.
  if (cache.fetching) {
    await cache.fetching;
    return { data: cache.userData, id: cache.userDataId };
  }


  cache.fetching = (async () => {
    // null means signed in but not yet onboarded.
    const row = await withRetry(() => api.questData.get());
    cache.userData = row;
    cache.userDataId = row?.id ?? null;
    cache.lastFetch = Date.now();
  })();

  try {
    await cache.fetching;
  } finally {
    // Clear on failure too, so one failed load does not poison every later one.
    cache.fetching = null;
  }
  return { data: cache.userData, id: cache.userDataId };
}

export function updateCachedUserData(id, data) {
  cache.userDataId = id;
  cache.userData = { ...cache.userData, ...data, id };
  cache.lastFetch = Date.now();
}

export function invalidateCache() {
  cache.user = null;
  cache.userData = null;
  cache.userDataId = null;
  cache.lastFetch = 0;
  cache.fetching = null;
}

export function setCachedUser(user) {
  cache.user = user;
}