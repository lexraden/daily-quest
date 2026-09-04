/**
 * End-to-end API tests against a real Postgres.
 *
 * Run with: npm test --workspace apps/api  (see test/README.md for the DB setup)
 *
 * Every case here corresponds to something that was actually broken or
 * exploitable at some point, so the suite is a regression net rather than a
 * coverage exercise. The payloads are the ones the real client sends — testing
 * hand-written bodies instead is what let three app-breaking bugs through.
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { issueAccessToken, issueRefreshToken } from '../src/auth/tokens.js';

const BASE = process.env.TEST_API_URL ?? 'http://localhost:3111';
const prisma = new PrismaClient();

interface Actor {
  id: string;
  email: string;
  token: string;
}

async function makeUser(name: string): Promise<Actor> {
  const user = await prisma.user.upsert({
    where: { googleSub: `sub-${name}` },
    create: { googleSub: `sub-${name}`, email: `${name}@test.local`, fullName: name },
    update: { trialStartedAt: null, isPremium: false },
  });
  await prisma.questData.deleteMany({ where: { userId: user.id } });
  await prisma.aiUsage.deleteMany({ where: { userId: user.id } });
  return { id: user.id, email: user.email, token: issueAccessToken(user).token };
}

function call(
  path: string,
  { token, method = 'GET', body, headers = {} }: {
    token?: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const QUESTS = {
  health: [
    { level: 1, emoji: '🏃', name: 'Run 3km' },
    { level: 3, emoji: '🏋️', name: 'Gym session' },
    { level: 2, emoji: '🚶', name: 'Walk 10k' },
  ],
  mind: [], work: [], money: [], love: [], friends: [],
};

/** Exactly the shape DailyTracker's getStateSnapshot() produces. */
const AUTOSAVE_PAYLOAD = {
  quest_data: QUESTS,
  category_levels: { health: 1 },
  category_total_completed: { health: 2 },
  total_completed: 2,
  streak: 1,
  last_completed_date: '2026-09-02',
  completion_history: { '2026-09-02': ['q1'] },
  streak_freezes: 1,
  journal_entries: [],
  meal_history: [],
  calories_burned: {},
  mood_log: { '2026-09-02': { score: 4, note: 'good day', at: '2026-09-02T09:00:00Z' } },
  last_visit_date: '2026-09-02',
};

let alice: Actor;
let bob: Actor;

before(async () => {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`API not reachable at ${BASE} — see test/README.md`);
  alice = await makeUser('alice');
  bob = await makeUser('bob');
});

after(async () => {
  await prisma.$disconnect();
});

describe('authentication', () => {
  test('rejects an unauthenticated request', async () => {
    assert.equal((await call('/api/quest-data')).status, 401);
  });

  // The SPA reads the Google client id from here instead of a VITE_ build
  // variable, so this endpoint has to answer without a token — if it ever
  // starts requiring auth, sign-in breaks for everyone with no way back in.
  test('serves the sign-in config without a token', async () => {
    const response = await call('/api/auth/config');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.google_client_id, process.env.GOOGLE_CLIENT_ID);
  });

  test('the sign-in config leaks no other configuration', async () => {
    const body = await (await call('/api/auth/config')).json();
    assert.deepEqual(Object.keys(body), ['google_client_id']);
  });

  test('rejects an alg:none forged token', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      sub: alice.id, email: alice.email, exp: 9_999_999_999,
    })}.`;
    assert.equal((await call('/api/quest-data', { token: forged })).status, 401);
  });

  test('rejects a token signed with the wrong key', async () => {
    const parts = alice.token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    assert.equal((await call('/api/quest-data', { token: tampered })).status, 401);
  });

  test('refresh tokens rotate and reject replay', async () => {
    const raw = await issueRefreshToken(alice.id);
    const first = await call('/api/auth/refresh', {
      method: 'POST', headers: { Cookie: `dq_refresh=${raw}` },
    });
    assert.equal(first.status, 200);

    const replay = await call('/api/auth/refresh', {
      method: 'POST', headers: { Cookie: `dq_refresh=${raw}` },
    });
    assert.equal(replay.status, 401, 'a used refresh token must not work twice');
  });
});

describe('quest data', () => {
  test('204 before onboarding, not 404', async () => {
    assert.equal((await call('/api/quest-data', { token: alice.token })).status, 204);
  });

  // The server has no idea what timezone the caller is in. It used to seed
  // last_visit_date from its own UTC clock, which disagreed with the local key
  // DailyTracker compares it against — east of Greenwich that made the app
  // think a new day had started on the very first load after onboarding.
  test('onboarding keeps the local day the client sends', async () => {
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'POST',
      body: { quest_data: QUESTS, last_visit_date: '2031-07-09' },
    });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).last_visit_date, '2031-07-09');
    await prisma.questData.deleteMany({ where: { userId: alice.id } });
  });

  test('rejects a malformed day', async () => {
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'POST',
      body: { quest_data: QUESTS, last_visit_date: '09/07/2031' },
    });
    assert.equal(res.status, 400);
  });

  test('create sorts quests by level', async () => {
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'POST',
      body: { quest_data: QUESTS, onboarding_answers: { health: 'run more' } },
    });
    assert.equal(res.status, 201);
    const row = await res.json();
    assert.deepEqual(row.quest_data.health.map((q: { level: number }) => q.level), [1, 2, 3]);
  });

  // Regression: this payload used to 400, breaking every autosave in the app.
  test('accepts the real autosave payload', async () => {
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'PATCH', body: AUTOSAVE_PAYLOAD,
    });
    assert.equal(res.status, 200, await res.text());
  });

  test('a partial patch leaves untouched columns alone', async () => {
    // `streak` used to be the field probed here; it is server-owned now, so the
    // check moved to one the client still writes.
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'PATCH', body: { calories_burned: { '2031-01-01': 250 } },
    });
    const row = await res.json();
    assert.deepEqual(row.calories_burned, { '2031-01-01': 250 });
    assert.equal(row.quest_data.health.length, 3, 'quests must survive a partial save');
    assert.deepEqual(row.onboarding_answers, { health: 'run more' });
  });

  test('rejects client-supplied identity and entitlement fields', async () => {
    for (const body of [
      { created_by: 'alice@test.local' },
      { is_premium: true },
      { trial_started_at: '2020-01-01T00:00:00Z' },
      { userId: 'someone-else' },
    ]) {
      const res = await call('/api/quest-data', { token: alice.token, method: 'PATCH', body });
      assert.equal(res.status, 400, `${JSON.stringify(body)} must be rejected`);
    }
  });

  test('persists mood check-ins', async () => {
    const moods = {
      '2026-09-01': { score: 2, at: '2026-09-01T09:00:00Z' },
      '2026-09-02': { score: 5, note: 'great', at: '2026-09-02T09:00:00Z' },
    };
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'PATCH', body: { mood_log: moods },
    });
    assert.equal(res.status, 200);
    const row = await res.json();
    assert.deepEqual(row.mood_log, moods);

    // A later partial save must not wipe the mood history.
    const after = await (await call('/api/quest-data', {
      token: alice.token, method: 'PATCH', body: { streak: 9 },
    })).json();
    assert.deepEqual(after.mood_log, moods);
  });

  test('validates date shape', async () => {
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'PATCH', body: { last_completed_date: 'yesterday' },
    });
    assert.equal(res.status, 400);
  });

  test('one user cannot see another user\'s row', async () => {
    assert.equal((await call('/api/quest-data', { token: bob.token })).status, 204);
  });
});

describe('progress is derived, not trusted', () => {
  async function onboard(actor: Actor) {
    await prisma.questData.deleteMany({ where: { userId: actor.id } });
    const res = await call('/api/quest-data', {
      token: actor.token, method: 'POST', body: { quest_data: QUESTS },
    });
    assert.equal(res.status, 201);
  }

  const complete = (actor: Actor, body: Record<string, unknown>) =>
    call('/api/quest-data/completions', { token: actor.token, method: 'POST', body });

  test('XP and category level follow the completion, not the client', async () => {
    await onboard(alice);
    const res = await complete(alice, {
      day: '2031-03-01', category: 'health', quest_name: 'Run 3km', level: 3,
    });
    assert.equal(res.status, 201);
    const row = await res.json();
    assert.equal(row.total_completed, 3);
    assert.equal(row.category_total_completed.health, 3);
    assert.equal(row.category_levels.health, 1);
  });

  // The bug this replaces: two tabs each read the same total, each add their
  // own XP, and the second save overwrites the first — one completion is gone.
  test('concurrent completions do not lose an increment', async () => {
    await onboard(alice);
    const results = await Promise.all([
      complete(alice, { day: '2031-03-02', category: 'health', quest_name: 'A', level: 1 }),
      complete(alice, { day: '2031-03-02', category: 'mind', quest_name: 'B', level: 2 }),
      complete(alice, { day: '2031-03-02', category: 'work', quest_name: 'C', level: 3 }),
    ]);
    for (const r of results) assert.equal(r.status, 201);

    const row = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.equal(row.total_completed, 6, 'every completion must be counted');
    assert.equal(row.completion_history['2031-03-02'].length, 3);
  });

  test('completing the same quest twice counts once', async () => {
    await onboard(alice);
    const body = { day: '2031-03-03', category: 'health', quest_name: 'Run', level: 2 };
    await Promise.all([complete(alice, body), complete(alice, body)]);
    const row = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.equal(row.total_completed, 2);
  });

  test('unchecking removes the XP again', async () => {
    await onboard(alice);
    await complete(alice, { day: '2031-03-04', category: 'health', quest_name: 'Run', level: 3 });
    const res = await call('/api/quest-data/completions', {
      token: alice.token, method: 'DELETE',
      body: { day: '2031-03-04', category: 'health', level: 3 },
    });
    assert.equal(res.status, 200);
    const row = await res.json();
    assert.equal(row.total_completed, 0);
    assert.equal(row.completion_history['2031-03-04'], undefined);
  });

  test('a PATCH cannot inflate the totals', async () => {
    await onboard(alice);
    await complete(alice, { day: '2031-03-05', category: 'health', quest_name: 'Run', level: 1 });
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'PATCH',
      body: { total_completed: 9999, streak: 500, streak_freezes: 99 },
    });
    assert.equal(res.status, 200);
    const row = await res.json();
    assert.equal(row.total_completed, 1, 'derived from history, not the request');
    assert.equal(row.streak, 0);
    assert.equal(row.streak_freezes, 1);
  });

  test('the streak counts a day once, however many calls arrive', async () => {
    await onboard(alice);
    const hit = () =>
      call('/api/quest-data/streak', {
        token: alice.token, method: 'POST', body: { day: '2031-03-06' },
      });
    const [a, b, c] = await Promise.all([hit(), hit(), hit()]);
    for (const r of [a, b, c]) assert.equal(r.status, 200);

    const row = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.equal(row.streak, 1, 'three calls for one day must add one');
    assert.equal(row.last_completed_date, '2031-03-06');

    const next = await (await call('/api/quest-data/streak', {
      token: alice.token, method: 'POST', body: { day: '2031-03-07' },
    })).json();
    assert.equal(next.streak, 2);
    assert.equal(next.counted, true);
  });

  test('the last freeze cannot be spent twice', async () => {
    await onboard(alice);
    const spend = () =>
      call('/api/quest-data/streak/freeze', {
        token: alice.token, method: 'POST', body: { action: 'use' },
      });
    await Promise.all([spend(), spend(), spend()]);
    const row = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.equal(row.streak_freezes, 0, 'never negative');
  });

  test('one user cannot record a completion on another\'s row', async () => {
    await onboard(alice);
    await onboard(bob);
    await complete(bob, { day: '2031-03-08', category: 'health', quest_name: 'X', level: 3 });
    const mine = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.equal(mine.total_completed, 0);
  });
});

describe('entitlement', () => {
  test('resetting onboarding does not grant a fresh trial', async () => {
    const resetter = await makeUser('resetter');
    // The trial clock starts on the first AI call, which is what onboarding does.
    await call('/api/ai/meal/text', {
      token: resetter.token, method: 'POST', body: { text: 'a burger' },
    });
    await call('/api/quest-data', {
      token: resetter.token, method: 'POST', body: { quest_data: QUESTS },
    });

    const before = await (await call('/api/quest-data', { token: resetter.token })).json();
    assert.ok(before.trial_started_at, 'the trial clock should be running');

    await call('/api/quest-data', { token: resetter.token, method: 'DELETE' });
    await call('/api/quest-data', {
      token: resetter.token, method: 'POST', body: { quest_data: QUESTS },
    });

    const after = await (await call('/api/quest-data', { token: resetter.token })).json();
    assert.equal(after.trial_started_at, before.trial_started_at);
  });

  test('an expired trial is blocked, premium is not', async () => {
    const lapsed = await makeUser('lapsed');
    await prisma.user.update({
      where: { id: lapsed.id },
      data: { trialStartedAt: new Date(Date.now() - 10 * 864e5), isPremium: false },
    });
    const blocked = await call('/api/ai/meal/text', {
      token: lapsed.token, method: 'POST', body: { text: 'a burger' },
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, 'premium_required');

    await prisma.user.update({ where: { id: lapsed.id }, data: { isPremium: true } });
    const allowed = await call('/api/ai/meal/text', {
      token: lapsed.token, method: 'POST', body: { text: 'a burger' },
    });
    assert.notEqual(allowed.status, 403, 'premium must pass the gate');
  });

  // Regression: never onboarding used to mean an unexpiring trial.
  test('a user who never onboards still starts a trial on first AI use', async () => {
    const drifter = await makeUser('drifter');
    assert.equal(
      (await prisma.user.findUnique({ where: { id: drifter.id } }))?.trialStartedAt,
      null,
    );
    await call('/api/ai/meal/text', {
      token: drifter.token, method: 'POST', body: { text: 'a burger' },
    });
    const after = await prisma.user.findUnique({ where: { id: drifter.id } });
    assert.ok(after?.trialStartedAt, 'the trial clock must start at first AI use');
  });

  // Regression: a failed OpenAI call used to burn the caller's monthly quota.
  test('a failed AI call does not consume quota', async () => {
    const spender = await makeUser('spender');
    await call('/api/ai/meal/text', {
      token: spender.token, method: 'POST', body: { text: 'a burger' },
    });
    const usage = await prisma.aiUsage.findFirst({ where: { userId: spender.id } });
    assert.equal(usage?.calls ?? 0, 0, 'quota is charged only on success');
  });
});

describe('files', () => {
  // A 1x1 transparent PNG.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  async function upload(actor: Actor, bytes: Buffer, filename = 'photo.png') {
    const form = new FormData();
    form.append('file', new Blob([bytes]), filename);
    return fetch(`${BASE}/api/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${actor.token}` },
      body: form,
    });
  }

  test('uploads an image and serves it via the signed URL with no auth header', async () => {
    const res = await upload(alice, PNG);
    assert.equal(res.status, 201);
    const { url, file_url, id } = await res.json();
    assert.equal(url, file_url, 'file_url mirrors url for the Base44-shaped callers');

    // This is the <img> path: no Authorization header at all.
    const fetched = await fetch(`${BASE}${url}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get('content-type'), 'image/png');
    assert.ok(id);
  });

  test('a tampered signature is refused', async () => {
    const { id } = await (await upload(alice, PNG)).json();
    const res = await fetch(`${BASE}/api/files/${id}?sig=${'a'.repeat(32)}`);
    assert.equal(res.status, 404);
  });

  test('no signature and no token is refused', async () => {
    const { id } = await (await upload(alice, PNG)).json();
    assert.equal((await fetch(`${BASE}/api/files/${id}`)).status, 401);
  });

  test('one user cannot read or delete another user\'s file', async () => {
    const { id } = await (await upload(alice, PNG)).json();
    assert.equal((await call(`/api/files/${id}`, { token: bob.token })).status, 404);
    assert.equal(
      (await call(`/api/files/${id}`, { token: bob.token, method: 'DELETE' })).status,
      404,
    );
  });

  test('rejects a non-image mislabelled as one', async () => {
    const res = await upload(alice, Buffer.from('<?php system($_GET[0]); ?>'), 'shell.png');
    assert.equal(res.status, 400);
  });
});

describe('profile', () => {
  test('accepts an uploaded avatar URL but not an external one', async () => {
    const form = new FormData();
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    form.append('file', new Blob([PNG]), 'a.png');
    const uploaded = await fetch(`${BASE}/api/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: form,
    });
    const { file_url } = await uploaded.json();

    // Regression: this used to 400, so avatars could never be changed.
    const ok = await call('/api/auth/me', {
      token: alice.token, method: 'PATCH', body: { avatar_url: file_url },
    });
    const updated = await ok.json();
    assert.equal(ok.status, 200, JSON.stringify(updated));
    assert.equal(updated.avatar_url, file_url);

    for (const bad of ['https://evil.example/x.png', 'javascript:alert(1)', '/etc/passwd']) {
      const res = await call('/api/auth/me', {
        token: alice.token, method: 'PATCH', body: { avatar_url: bad },
      });
      assert.equal(res.status, 400, `${bad} must be rejected`);
    }
  });

  test('deleting an account removes everything it owns', async () => {
    const doomed = await makeUser('doomed');
    await call('/api/quest-data', {
      token: doomed.token, method: 'POST', body: { quest_data: QUESTS },
    });
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )]), 'a.png');
    await fetch(`${BASE}/api/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${doomed.token}` },
      body: form,
    });

    assert.equal((await call('/api/auth/me', { token: doomed.token, method: 'DELETE' })).status, 200);

    assert.equal(await prisma.user.count({ where: { id: doomed.id } }), 0);
    assert.equal(await prisma.questData.count({ where: { userId: doomed.id } }), 0);
    assert.equal(await prisma.file.count({ where: { userId: doomed.id } }), 0);
    assert.equal(await prisma.refreshToken.count({ where: { userId: doomed.id } }), 0);
  });
});

describe('routing', () => {
  test('an unmatched /api path is a JSON 404, not the SPA shell', async () => {
    const res = await fetch(`${BASE}/api/does-not-exist`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') ?? '', /json/);
  });

  test('sets baseline security headers', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });
});
