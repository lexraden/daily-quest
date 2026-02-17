import { base44 } from '@/api/base44Client';

// Simple in-memory cache shared across pages
const cache = {
  user: null,
  userData: null,
  userDataId: null,
  lastFetch: 0,
  fetching: null, // promise for deduplication
};

const CACHE_TTL = 30000; // 30 seconds

export async function getCachedUser() {
  if (cache.user) return cache.user;
  const user = await base44.auth.me();
  cache.user = user;
  return user;
}

export async function getCachedUserData(email) {
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
    const list = await base44.entities.UserQuestData.filter({ created_by: email });
    if (list.length > 0) {
      cache.userData = list[0];
      cache.userDataId = list[0].id;
    } else {
      cache.userData = null;
      cache.userDataId = null;
    }
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
  cache.userData = null;
  cache.userDataId = null;
  cache.lastFetch = 0;
}

export function setCachedUser(user) {
  cache.user = user;
}