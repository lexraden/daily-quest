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
    const res = await call('/api/quest-data', {
      token: alice.token, method: 'PATCH', body: { streak: 7 },
    });
    const row = await res.json();
    assert.equal(row.streak, 7);
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
