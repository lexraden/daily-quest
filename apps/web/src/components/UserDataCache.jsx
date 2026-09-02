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

export async function getCachedUserData() {
  const now = Date.now();
  
  // Return cached if fresh
  if (cache.userData && cache.lastFetch && (now - cache.lastFetch < CACHE_TTL)) {
    return { data: cache.userData, id: cache.userDataId };
  }

  // Deduplicate concurrent requests
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

  await cache.fetching;
  cache.fetching = null;
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