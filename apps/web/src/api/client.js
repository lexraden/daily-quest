/**
 * The DailyQ API client. Replaces the Base44 SDK.
 *
 * The access token lives in memory only — a refresh cookie the browser holds
 * restores the session on reload, so nothing long-lived sits in localStorage
 * where a script injection could read it.
 */

import { todayKey } from '@/lib/dates';

const API_BASE = import.meta.env.VITE_API_URL || '';

let accessToken = null;
let refreshPromise = null;
const listeners = new Set();

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Notified when the session ends for a reason the user did not initiate. */
export function onSessionLost(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function sessionLost() {
  accessToken = null;
  listeners.forEach((fn) => fn());
}

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'ApiError';
    // `status` is read by the 429 backoff in UserDataCache — keep the name.
    this.status = status;
    this.code = code;
  }
}

async function parseError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON error bodies (a proxy timeout page, say) fall through.
  }
  return new ApiError(
    response.status,
    payload?.error || `Request failed (${response.status})`,
    payload?.code,
  );
}

/**
 * Refresh is deduplicated: several requests failing with 401 at once share one
 * refresh call rather than racing, which would invalidate each other's tokens
 * because the server rotates on every use.
 */
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw await parseError(response);
      const data = await response.json();
      accessToken = data.access_token;
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request(path, { method = 'GET', body, isForm = false, retry = true } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  // One refresh-and-retry. If the refresh itself fails the session is gone.
  if (response.status === 401 && retry) {
    try {
      await refreshAccessToken();
    } catch {
      sessionLost();
      throw new ApiError(401, 'Your session expired, sign in again', 'unauthorized');
    }
    return request(path, { method, body, isForm, retry: false });
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return null;

  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : response;
}

export const api = {
  auth: {
    /** Exchange a Google ID token for a session. */
    async signInWithGoogle(idToken) {
      const data = await request('/api/auth/google', {
        method: 'POST',
        body: { id_token: idToken },
        retry: false,
      });
      accessToken = data.access_token;
      return data.user;
    },

    /** Restore a session from the refresh cookie. Returns null when signed out. */
    async restore() {
      try {
        await refreshAccessToken();
        return await request('/api/auth/me');
      } catch {
        accessToken = null;
        return null;
      }
    },

    me: () => request('/api/auth/me'),
    updateMe: (patch) => request('/api/auth/me', { method: 'PATCH', body: patch }),

    async logout() {
      try {
        await request('/api/auth/logout', { method: 'POST', retry: false });
      } finally {
        accessToken = null;
      }
    },

    deleteAccount: async () => {
      const result = await request('/api/auth/me', { method: 'DELETE' });
      accessToken = null;
      return result;
    },
  },

  questData: {
    /** null means signed in but not yet onboarded. */
    get: () => request('/api/quest-data'),
    // The caller's local day travels with the row: the server cannot know the
    // timezone, and DailyTracker compares this against a locally computed key.
    create: (payload) =>
      request('/api/quest-data', {
        method: 'POST',
        body: { last_visit_date: todayKey(), ...payload },
      }),
    update: (patch) => request('/api/quest-data', { method: 'PATCH', body: patch }),
    reset: () => request('/api/quest-data', { method: 'DELETE' }),

    /**
     * Progress is applied by the server, which derives XP and category levels
     * from the history it keeps. These all return the authoritative row.
     */
    completions: {
      add: (day, quest) =>
        request('/api/quest-data/completions', {
          method: 'POST',
          body: {
            day,
            category: quest.category,
            quest_name: quest.name,
            level: quest.level,
            ...(quest.emoji ? { emoji: quest.emoji } : {}),
          },
        }),
      remove: (day, category, level) =>
        request('/api/quest-data/completions', {
          method: 'DELETE',
          body: { day, category, level },
        }),
    },

    /** Counts `day` towards the streak; counting the same day twice is a no-op. */
    countStreakDay: (day) =>
      request('/api/quest-data/streak', { method: 'POST', body: { day } }),

    /** action: 'use' spends a freeze, 'lose' resets the streak. */
    streakFreeze: (action) =>
      request('/api/quest-data/streak/freeze', { method: 'POST', body: { action } }),
  },

  ai: {
    generateQuests: (answers, lang) =>
      request('/api/ai/quests/generate', { method: 'POST', body: { answers, lang } }),
    voiceIntent: (text, questData, lang) =>
      request('/api/ai/quests/voice', {
        method: 'POST',
        body: { text, quest_data: questData, lang },
      }),
    cleanupTranscript: (question, text, lang) =>
      request('/api/ai/text/cleanup', { method: 'POST', body: { question, text, lang } }),
    mealFromText: (text, lang) =>
      request('/api/ai/meal/text', { method: 'POST', body: { text, lang } }),
    correctMeal: (meal, correction, lang) =>
      request('/api/ai/meal/correct', {
        method: 'POST',
        body: {
          meal_name: meal.meal_name,
          calories: meal.calories,
          protein: meal.protein,
          fat: meal.fat,
          carbs: meal.carbs,
          correction,
          lang,
        },
      }),
    mealFromPhoto: (fileIds, lang) =>
      request('/api/ai/meal/photo', { method: 'POST', body: { file_ids: fileIds, lang } }),
  },

  files: {
    upload(file) {
      const form = new FormData();
      form.append('file', file);
      return request('/api/files', { method: 'POST', body: form, isForm: true });
    },
    remove: (id) => request(`/api/files/${id}`, { method: 'DELETE' }),
  },
};
