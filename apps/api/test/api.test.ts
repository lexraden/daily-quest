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
import { isDue, minutesSince } from '../src/jobs/window.js';
import { validProposal } from '../src/lib/coachProposal.js';
import {
  configurePush,
  notifyUser,
  setSender,
  pushEnabled,
  publicKey,
  pushProblem,
} from '../src/lib/push.js';
import { reminderCopy, situationFor, firstName } from '../src/jobs/copy.js';
import { record as recordNotification, MAX_PER_USER } from '../src/lib/notifications.js';
import {
  configureTelegram,
  notifyUser as notifyTelegram,
  sendToUser as sendTelegramTo,
  setSender as setTelegramSender,
} from '../src/lib/telegram.js';
import { isStreakMilestone, copyFor } from '../src/lib/notificationCopy.js';
import webpush from 'web-push';
import { isGuestSubject } from '../src/lib/guest.js';

/** One pair for the whole suite; the pair only has to be internally consistent. */
const VAPID = webpush.generateVAPIDKeys();
import {
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../src/auth/tokens.js';

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
    // Every field entitlement is read from, back to nothing. The suite runs
    // against a database that survives it, so anything left here is state the
    // next run inherits — a paid month left behind made the gate tests pass for
    // the wrong reason and then fail on the run after.
    update: { trialStartedAt: null, isPremium: false, premiumUntil: null },
  });
  await prisma.questData.deleteMany({ where: { userId: user.id } });
  await prisma.aiUsage.deleteMany({ where: { userId: user.id } });
  // Charge ids in the payment tests are fixed strings, so the rows from the
  // last run would make every one of them look like a redelivery.
  await prisma.payment.deleteMany({ where: { userId: user.id } });
  // Endpoints are unique across users, so one left behind by a previous run
  // rejects the next run's create rather than being replaced by it.
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
  // A chat linked by the last run would make "not connected yet" the wrong
  // answer for a fresh actor, and the channel-status tests read exactly that.
  await prisma.telegramLink.deleteMany({ where: { userId: user.id } });
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
    assert.deepEqual(Object.keys(body).sort(), ['google_client_id', 'guest_login']);
  });

  // Guest login is a deliberate hole in the identity proof, so the flag being
  // off has to mean off. The suite runs without GUEST_LOGIN_ENABLED set.
  test('guest sign-in is closed unless the server enables it', async () => {
    const res = await call('/api/auth/guest', { method: 'POST' });
    const body = await (await call('/api/auth/config')).json();
    if (body.guest_login) {
      // 429 is a pass too: the endpoint is rate limited to five an hour, and a
      // browser run against the same server earlier in the day spends those.
      if (res.status === 429) return;
      assert.equal(res.status, 201, 'enabled: must issue a session');
      const session = await res.json();
      assert.ok(session.access_token);
      assert.equal(session.user.full_name, 'Guest');

      // A second guest must be a different account, not a shared one.
      const other = await (await call('/api/auth/guest', { method: 'POST' })).json();
      assert.notEqual(other.user.id, session.user.id);

      const mine = await call('/api/quest-data', { token: session.access_token });
      assert.equal(mine.status, 204, 'a fresh guest owns nothing yet');
    } else {
      assert.equal(res.status, 404, 'disabled: must not issue a session');
    }
  });

  /**
   * The app has no other way to tell. A guest session restores from its cookie
   * like any other, so without this flag "continue as guest" silently became
   * the account someone kept opening, with nothing saying that signing out ends
   * it for good.
   *
   * Driven off the `guest:` subject namespace rather than the @guest.invalid
   * email, so there is one definition of guest and /auth/guest owns it.
   */
  test('the session says whether it is a guest one', async () => {
    const real = await call('/api/auth/me', { token: alice.token });
    assert.equal((await real.json()).is_guest, false);

    const guest = await prisma.user.upsert({
      where: { googleSub: 'guest:wire-test' },
      create: {
        googleSub: 'guest:wire-test',
        email: 'guest-wire-test@guest.invalid',
        fullName: 'Guest',
      },
      update: {},
    });
    const token = issueAccessToken(guest).token;

    const res = await call('/api/auth/me', { token });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).is_guest, true);
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

  // The sequential case above passed even when the validity check happened in
  // JavaScript and the update targeted the row by id. Fired together, both
  // callers read a live row and both minted a successor, so one token became
  // two live sessions.
  // Called against the function, not over HTTP: fetch reuses one connection per
  // origin, so four POSTs fired with Promise.all still arrive one after another
  // and never overlap in the database, which is where this race lives.
  test('one refresh token cannot mint two sessions at once', async () => {
    const raw = await issueRefreshToken(alice.id);
    const results = await Promise.allSettled([
      rotateRefreshToken(raw),
      rotateRefreshToken(raw),
      rotateRefreshToken(raw),
      rotateRefreshToken(raw),
    ]);
    const won = results.filter((r) => r.status === 'fulfilled');
    assert.equal(won.length, 1, 'exactly one caller may rotate the token');
  });

  // Logging out has to stick even if a refresh is in flight beside it.
  // Same reason: driven against the functions so the two genuinely overlap.
  test('a logout is not undone by a refresh racing it', async () => {
    const raw = await issueRefreshToken(alice.id);
    const [, rotated] = await Promise.allSettled([
      revokeRefreshToken(raw),
      rotateRefreshToken(raw),
    ]);

    // Whoever won, the token must be dead afterwards and mint nothing more.
    await assert.rejects(() => rotateRefreshToken(raw), 'the revoked token must stay dead');
    if (rotated.status === 'fulfilled') {
      // The refresh got there first; its successor is a legitimate live session,
      // but the token it consumed is still gone.
      assert.ok(rotated.value.refreshToken);
    }
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

describe('re-onboarding', () => {
  const day = '2031-07-10';

  async function onboard(actor: Actor, on = day) {
    const res = await call('/api/quest-data', {
      token: actor.token,
      method: 'POST',
      body: { quest_data: QUESTS, last_visit_date: on },
    });
    assert.equal(res.status, 201);
    return res.json();
  }

  test("resetting quests clears today's ticks but keeps earlier days", async () => {
    await prisma.questData.deleteMany({ where: { userId: alice.id } });
    await onboard(alice);

    // One completion yesterday, one today.
    for (const [on, level] of [['2031-07-09', 2], [day, 3]] as [string, number][]) {
      const res = await call('/api/quest-data/completions', {
        token: alice.token,
        method: 'POST',
        body: { day: on, category: 'health', quest_name: 'x', level },
      });
      assert.equal(res.status, 201);
    }

    const before = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.equal(before.total_completed, 5);
    assert.equal(before.completion_history[day].length, 1);

    const after = await onboard(alice);

    assert.deepEqual(
      after.completion_history[day],
      undefined,
      "today's ticks belong to the quests that were just replaced",
    );
    assert.equal(
      after.completion_history['2031-07-09'].length,
      1,
      'the dialog promises earlier history survives',
    );
    assert.equal(after.total_completed, 2, "XP follows the ticks it was earned by");
  });

  test('re-onboarding does not restart a spent trial or drop premium', async () => {
    await prisma.questData.deleteMany({ where: { userId: alice.id } });
    await onboard(alice);

    const started = new Date('2031-01-01T00:00:00Z');
    await prisma.user.update({
      where: { id: alice.id },
      data: { trialStartedAt: started, isPremium: true },
    });

    const after = await onboard(alice);
    assert.equal(after.is_premium, true);
    assert.equal(after.trial_started_at, started.toISOString());
  });

  test('a first onboarding still starts from nothing', async () => {
    await prisma.questData.deleteMany({ where: { userId: alice.id } });
    const row = await onboard(alice);
    assert.equal(row.total_completed, 0);
    assert.deepEqual(row.completion_history, {});
    assert.equal(row.streak, 0);
  });
});

describe('levels and avatars', () => {
  async function onboard(actor: Actor) {
    await prisma.questData.deleteMany({ where: { userId: actor.id } });
    const res = await call('/api/quest-data', {
      token: actor.token, method: 'POST', body: { quest_data: QUESTS },
    });
    assert.equal(res.status, 201);
  }

  /**
   * Earns XP the way the app does — one completion at a time through the
   * endpoint that derives the totals. Writing completionHistory straight into
   * the row leaves total_completed at zero, because nothing recomputes it.
   *
   * Each completion goes on its own day: the same category and level twice in
   * one day is deliberately idempotent and would not count.
   */
  async function earnXp(actor: Actor, xp: number) {
    for (let i = 0; i < Math.ceil(xp / 3); i += 1) {
      const day = `2031-05-${String(i + 1).padStart(2, '0')}`;
      const res = await call('/api/quest-data/completions', {
        token: actor.token,
        method: 'POST',
        body: { day, category: 'health', quest_name: `q${i}`, level: 3 },
      });
      assert.equal(res.status, 201);
    }
  }

  test('the level comes from the server, and is celebrated exactly once', async () => {
    await onboard(bob);
    const fresh = await (await call('/api/quest-data', { token: bob.token })).json();
    assert.equal(fresh.overall_level, 1);
    assert.equal(fresh.celebrate_level, null, 'a brand new account has nothing to celebrate');

    await earnXp(bob, 30); // past the level 3 threshold of 25
    const earned = await (await call('/api/quest-data', { token: bob.token })).json();
    assert.equal(earned.overall_level, 3);
    assert.equal(earned.celebrate_level, 3);

    // Reading again must still offer it: the modal may never have been shown.
    const again = await (await call('/api/quest-data', { token: bob.token })).json();
    assert.equal(again.celebrate_level, 3);

    const acked = await (await call('/api/quest-data/level-celebrated', {
      token: bob.token, method: 'POST', body: { level: 3 },
    })).json();
    assert.equal(acked.celebrate_level, null);

    const afterAck = await (await call('/api/quest-data', { token: bob.token })).json();
    assert.equal(afterAck.celebrate_level, null, 'a shown level never comes back');
  });

  test('acknowledging an older level cannot replay a newer one', async () => {
    await onboard(bob);
    await earnXp(bob, 30);
    await call('/api/quest-data/level-celebrated', {
      token: bob.token, method: 'POST', body: { level: 3 },
    });
    // A late request from a second tab that was still showing level 2.
    await call('/api/quest-data/level-celebrated', {
      token: bob.token, method: 'POST', body: { level: 2 },
    });
    const row = await (await call('/api/quest-data', { token: bob.token })).json();
    assert.equal(row.celebrate_level, null);
  });

  test('an avatar above your level is refused', async () => {
    await onboard(bob);
    await earnXp(bob, 30); // level 3

    const tooHigh = await call('/api/auth/me', {
      token: bob.token, method: 'PATCH', body: { avatar_choice: 'level-9' },
    });
    assert.equal(tooHigh.status, 403);

    const allowed = await call('/api/auth/me', {
      token: bob.token, method: 'PATCH', body: { avatar_choice: 'level-3' },
    });
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).avatar_choice, 'level-3');
  });

  test('a made-up avatar name is rejected before it reaches the database', async () => {
    const res = await call('/api/auth/me', {
      token: bob.token, method: 'PATCH', body: { avatar_choice: '../../admin' },
    });
    assert.equal(res.status, 400);
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

  /**
   * Granting Pro must reach people who are already signed in.
   *
   * It does because the access token carries only a subject and an email, and
   * the gate reads is_premium from the database on every call. Putting the flag
   * in the token would be faster and would silently mean a grant did nothing
   * until the user signed out — which is the moment nobody would connect to the
   * change. Hence one token, issued once, used on both sides of the grant.
   */
  test('granting Pro reaches a session that is already open', async () => {
    const early = await makeUser('early-adopter');
    await prisma.user.update({
      where: { id: early.id },
      data: { trialStartedAt: new Date(Date.now() - 10 * 864e5), isPremium: false },
    });

    const token = early.token; // issued now, and never reissued below

    const before = await call('/api/ai/meal/text', {
      token, method: 'POST', body: { text: 'a burger' },
    });
    assert.equal((await before.json()).code, 'premium_required');

    // What the grant script does, as the script does it.
    const { count } = await prisma.user.updateMany({
      where: { id: { in: [early.id] }, isPremium: false },
      data: { isPremium: true },
    });
    assert.equal(count, 1);

    const after = await call('/api/ai/meal/text', {
      token, method: 'POST', body: { text: 'a burger' },
    });
    assert.notEqual(after.status, 403, 'the open session has access without signing in again');
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

describe('what the coach is allowed to offer', () => {
  const quests = {
    health: [{ level: 1, name: 'Walk 15 minutes', emoji: '🚶' }],
    mind: [{ level: 1, name: 'Read 10 pages', emoji: '📚' }],
  };

  test('a replacement identical to the quest already there is dropped', () => {
    // This is what the model actually returned when asked to log a meal: a
    // card offering to replace "Walk 15 minutes" with "Walk 15 minutes".
    for (const name of ['Walk 15 minutes', '  Walk 15 minutes  ', 'walk 15 MINUTES']) {
      assert.equal(
        validProposal({ kind: 'quest_edit', category: 'health', level: 1, name, emoji: '🚶' }, quests),
        null,
        name,
      );
    }
  });

  // The model kept prefixing the name with the emoji it had already put in the
  // emoji field, which drew it twice and slipped past the check above.
  test('an emoji inside the name is stripped, not treated as a difference', () => {
    assert.equal(
      validProposal(
        { kind: 'quest_edit', category: 'health', level: 1, name: '🚶 Walk 15 minutes', emoji: '🚶' },
        quests,
      ),
      null,
      'the same quest with its emoji glued on is still the same quest',
    );

    const real = validProposal(
      { kind: 'quest_edit', category: 'health', level: 1, name: '🏃 Run 3km', emoji: '🏃' },
      quests,
    );
    assert.equal(real?.kind === 'quest_edit' && real.name, 'Run 3km');
  });

  test('adding a quest the user already has is dropped', () => {
    assert.equal(
      validProposal({ kind: 'quest_add', category: 'health', level: 1, name: 'Walk 15 minutes' }, quests),
      null,
    );
    assert.deepEqual(
      validProposal(
        { kind: 'quest_add', category: 'health', level: 2, name: 'Sleep by 23:00', emoji: '😴' },
        quests,
      ),
      { kind: 'quest_add', category: 'health', level: 2, name: 'Sleep by 23:00', emoji: '😴' },
    );
  });

  test('deleting or ticking a quest that is not there is dropped', () => {
    assert.equal(validProposal({ kind: 'quest_delete', category: 'health', level: 3 }, quests), null);
    assert.equal(validProposal({ kind: 'complete', category: 'health', level: 3 }, quests), null);

    const del = validProposal({ kind: 'quest_delete', category: 'health', level: 1 }, quests);
    assert.equal(
      del?.kind === 'quest_delete' && del.name,
      'Walk 15 minutes',
      'the card names what would disappear',
    );
  });

  test('a journal note needs text and a real category', () => {
    assert.equal(validProposal({ kind: 'journal', category: 'health', text: '  ' }, quests), null);
    assert.equal(validProposal({ kind: 'journal', category: 'crypto', text: 'hi' }, quests), null);
    assert.deepEqual(
      validProposal({ kind: 'journal', category: 'mind', text: 'Read on the train' }, quests),
      { kind: 'journal', category: 'mind', text: 'Read on the train' },
    );
  });

  test('an unknown category, kind or shape is dropped', () => {
    for (const bad of [
      { kind: 'quest_edit', category: 'crypto', level: 1, name: 'HODL', emoji: '🪙' },
      { kind: 'quest_edit', category: 'health', level: 0, name: 'x', emoji: '🚶' },
      { kind: 'nonsense', category: 'health', level: 1 },
      null,
      'a string',
    ]) {
      assert.equal(validProposal(bad, quests), null, JSON.stringify(bad));
    }
  });

  test('the old "quest" kind still renders for proposals already stored', () => {
    const p = validProposal(
      { kind: 'quest', category: 'health', level: 1, name: 'Walk 30 minutes', emoji: '🚶' },
      quests,
    );
    assert.equal(p?.kind, 'quest_edit');
  });

  test('a meal needs a name and calories to be worth a button', () => {
    assert.equal(validProposal({ kind: 'meal', meal_name: '', calories: 500 }, quests), null);
    assert.equal(
      validProposal({ kind: 'meal', meal_name: 'Shawarma', calories: 0 }, quests),
      null,
      'a zero-calorie meal adds nothing to the day',
    );

    assert.deepEqual(
      validProposal(
        { kind: 'meal', meal_name: 'Shawarma', calories: 620.4, protein: 28, fat: 30, carbs: 55 },
        quests,
      ),
      { kind: 'meal', meal_name: 'Shawarma', calories: 620, protein: 28, fat: 30, carbs: 55 },
    );
  });

  test('absurd or missing macros are clamped rather than trusted', () => {
    const p = validProposal(
      { kind: 'meal', meal_name: 'x', calories: 400, protein: -5, fat: 999999, carbs: null },
      quests,
    );
    assert.equal(p?.kind === 'meal' && p.protein, 0);
    assert.equal(p?.kind === 'meal' && p.fat, 10000);
    assert.equal(p?.kind === 'meal' && p.carbs, 0);
  });
});

describe('meals are changed one at a time', () => {
  async function onboard(actor: Actor) {
    await prisma.questData.deleteMany({ where: { userId: actor.id } });
    const res = await call('/api/quest-data', {
      token: actor.token, method: 'POST', body: { quest_data: QUESTS },
    });
    assert.equal(res.status, 201);
  }

  const add = (actor: Actor, name: string, calories = 500) =>
    call('/api/quest-data/meals', {
      token: actor.token,
      method: 'POST',
      body: { meal_name: name, calories, date: '2031-08-01' },
    });

  test('an appended meal gets an id and keeps the ones already there', async () => {
    await onboard(alice);
    await add(alice, 'Breakfast');
    const row = await (await add(alice, 'Lunch')).json();

    assert.equal(row.meal_history.length, 2);
    assert.equal(row.meal_history[0].meal_name, 'Lunch', 'newest first');
    assert.ok(row.meal_history[0].id, 'the server names the meal');
    assert.notEqual(row.meal_history[0].id, row.meal_history[1].id);
  });

  // The bug this replaces: the tracker, the profile and the coach each sent
  // meal_history whole, so whichever landed last put the list back to what it
  // held at mount and the other meal was gone.
  test('two devices logging at once keep both meals', async () => {
    await onboard(alice);

    const [a, b] = await Promise.all([add(alice, 'Phone meal'), add(alice, 'Laptop meal')]);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const row = await (await call('/api/quest-data', { token: alice.token })).json();
    const names = row.meal_history.map((m: { meal_name: string }) => m.meal_name).sort();
    assert.deepEqual(names, ['Laptop meal', 'Phone meal']);
  });

  test('editing names the meal, not a position in the array', async () => {
    await onboard(alice);
    const first = await (await add(alice, 'Shawarma', 620)).json();
    const id = first.meal_history[0].id;

    // Something else lands in front of it, moving it down the list.
    await add(alice, 'Coffee', 5);

    const edited = await (await call(`/api/quest-data/meals/${id}`, {
      token: alice.token, method: 'PATCH', body: { calories: 700 },
    })).json();

    const target = edited.meal_history.find((m: { id: string }) => m.id === id);
    assert.equal(target.calories, 700);
    assert.equal(target.meal_name, 'Shawarma', 'an untouched field stays put');
    assert.equal(
      edited.meal_history.find((m: { meal_name: string }) => m.meal_name === 'Coffee').calories,
      5,
      'the other meal is untouched',
    );
  });

  test('deleting twice is not an error', async () => {
    await onboard(alice);
    const row = await (await add(alice, 'Snack')).json();
    const id = row.meal_history[0].id;

    const first = await call(`/api/quest-data/meals/${id}`, { token: alice.token, method: 'DELETE' });
    assert.equal(first.status, 200);
    assert.deepEqual((await first.json()).meal_history, []);

    const again = await call(`/api/quest-data/meals/${id}`, { token: alice.token, method: 'DELETE' });
    assert.equal(again.status, 200, 'a retry after a dropped response must not fail');
  });

  test('editing a meal that is gone says so rather than inventing one', async () => {
    await onboard(alice);
    const res = await call('/api/quest-data/meals/nope', {
      token: alice.token, method: 'PATCH', body: { calories: 1 },
    });
    assert.equal(res.status, 404);
  });

  test("one user cannot touch another user's meals", async () => {
    await onboard(alice);
    await onboard(bob);
    const row = await (await add(alice, 'Private lunch')).json();
    const id = row.meal_history[0].id;

    // Bob has a row of his own, so this is a real lookup that finds nothing.
    const res = await call(`/api/quest-data/meals/${id}`, {
      token: bob.token, method: 'PATCH', body: { calories: 9999 },
    });
    assert.equal(res.status, 404);

    const after = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.equal(after.meal_history[0].calories, 500);
  });

  test('a meal without a name or with absurd numbers is refused', async () => {
    await onboard(alice);
    for (const body of [
      { meal_name: '', calories: 100, date: '2031-08-01' },
      { meal_name: 'x', calories: -5, date: '2031-08-01' },
      { meal_name: 'x', calories: 100, date: 'not-a-day' },
      { meal_name: 'x', calories: 100, date: '2031-08-01', sneaky: true },
    ]) {
      const res = await call('/api/quest-data/meals', {
        token: alice.token, method: 'POST', body,
      });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('the meal routes are closed without a token', async () => {
    for (const [method, path] of [
      ['POST', '/api/quest-data/meals'],
      ['PATCH', '/api/quest-data/meals/x'],
      ['DELETE', '/api/quest-data/meals/x'],
    ]) {
      const res = await call(path, { method });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });
});

describe('quests are edited one slot at a time', () => {
  async function onboard(actor: Actor) {
    await prisma.questData.deleteMany({ where: { userId: actor.id } });
    const res = await call('/api/quest-data', {
      token: actor.token, method: 'POST', body: { quest_data: QUESTS },
    });
    assert.equal(res.status, 201);
  }

  const save = (actor: Actor, category: string, level: number, body: unknown) =>
    call(`/api/quest-data/quests/${category}/${level}`, {
      token: actor.token, method: 'PATCH', body,
    });

  // The bug this replaces: both the tracker's autosave and the coach sent all
  // eighteen quests, so the later write reverted the other device's edit.
  // Both in the same category on purpose: that is the contended case, since
  // the two writes touch the same array inside the same JSON column.
  test('two devices editing different quests keep both edits', async () => {
    await onboard(alice);

    const [a, b] = await Promise.all([
      save(alice, 'health', 1, { name: 'Walk 30 minutes', emoji: '🚶' }),
      save(alice, 'health', 3, { name: 'Swim 1km', emoji: '🏊' }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);

    const row = await (await call('/api/quest-data', { token: alice.token })).json();
    const byLevel = (l: number) =>
      row.quest_data.health.find((q: { level: number }) => q.level === l).name;
    assert.equal(byLevel(1), 'Walk 30 minutes');
    assert.equal(byLevel(3), 'Swim 1km');
    assert.equal(byLevel(2), 'Walk 10k', 'the quest neither write touched is unchanged');
  });

  test('the other levels in the same category are untouched', async () => {
    await onboard(alice);
    const before = await (await call('/api/quest-data', { token: alice.token })).json();
    const untouched = before.quest_data.health
      .filter((q: { level: number }) => q.level !== 2)
      .map((q: { name: string }) => q.name);

    const row = await (await save(alice, 'health', 2, { name: 'Swim', emoji: '🏊' })).json();

    assert.equal(row.quest_data.health.find((q: { level: number }) => q.level === 2).name, 'Swim');
    assert.deepEqual(
      row.quest_data.health.filter((q: { level: number }) => q.level !== 2).map((q: { name: string }) => q.name),
      untouched,
    );
  });

  test('a quest can be added past the third, and the category has a ceiling', async () => {
    await onboard(alice);

    const added = await call('/api/quest-data/quests/health', {
      token: alice.token, method: 'POST', body: { name: 'Sleep by 23:00', emoji: '😴', level: 1 },
    });
    assert.equal(added.status, 201);
    const row = await added.json();
    assert.equal(row.quest_data.health.length, 4, 'a category is not limited to three');
    // Level 1 was taken, so it lands just past the ones that exist.
    assert.equal(
      row.quest_data.health.find((q: { name: string }) => q.name === 'Sleep by 23:00').level,
      4,
    );

    for (const name of ['Stretch', 'Water']) {
      await call('/api/quest-data/quests/health', {
        token: alice.token, method: 'POST', body: { name, emoji: '💧' },
      });
    }
    const tooMany = await call('/api/quest-data/quests/health', {
      token: alice.token, method: 'POST', body: { name: 'One more', emoji: '➕' },
    });
    assert.equal(tooMany.status, 400, 'a category has a ceiling');
  });

  test('deleting a quest leaves the others and is safe to repeat', async () => {
    await onboard(alice);
    const first = await call('/api/quest-data/quests/health/2', {
      token: alice.token, method: 'DELETE',
    });
    assert.equal(first.status, 200);
    assert.deepEqual(
      (await first.json()).quest_data.health.map((q: { level: number }) => q.level),
      [1, 3],
    );

    const again = await call('/api/quest-data/quests/health/2', {
      token: alice.token, method: 'DELETE',
    });
    assert.equal(again.status, 200);
  });

  test('a bad category, level or body is refused; a missing quest is 404', async () => {
    await onboard(alice);
    assert.equal((await save(alice, 'crypto', 1, { name: 'HODL' })).status, 400);
    assert.equal((await save(alice, 'health', 0, { name: 'x' })).status, 400);
    assert.equal((await save(alice, 'health', 1, { name: '  ' })).status, 400);
    assert.equal((await save(alice, 'health', 1, { name: 'x', sneaky: 1 })).status, 400);

    // Levels are no longer capped at three, so 9 is a well-formed slot that
    // simply holds nothing — not found rather than malformed.
    assert.equal((await save(alice, 'health', 9, { name: 'x' })).status, 404);
  });

  test("one user cannot edit another user's quests", async () => {
    await onboard(alice);
    await onboard(bob);
    await save(bob, 'health', 1, { name: "Bob's own quest", emoji: '🏃' });

    const alices = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.notEqual(
      alices.quest_data.health.find((q: { level: number }) => q.level === 1).name,
      "Bob's own quest",
    );
  });

  test('the quest route is closed without a token', async () => {
    const res = await call('/api/quest-data/quests/health/1', {
      method: 'PATCH', body: { name: 'x' },
    });
    assert.equal(res.status, 401);
  });
});

describe('calories burned are set one day at a time', () => {
  async function onboard(actor: Actor) {
    await prisma.questData.deleteMany({ where: { userId: actor.id } });
    const res = await call('/api/quest-data', {
      token: actor.token, method: 'POST', body: { quest_data: QUESTS },
    });
    assert.equal(res.status, 201);
  }

  const set = (actor: Actor, day: string, value: number) =>
    call('/api/quest-data/calories-burned', {
      token: actor.token, method: 'PUT', body: { day, value },
    });

  test('two days written at once both survive', async () => {
    await onboard(alice);
    const [a, b] = await Promise.all([
      set(alice, '2031-10-01', 400),
      set(alice, '2031-10-02', 700),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);

    const row = await (await call('/api/quest-data', { token: alice.token })).json();
    assert.equal(row.calories_burned['2031-10-01'], 400);
    assert.equal(row.calories_burned['2031-10-02'], 700);
  });

  test('setting a day again replaces only that day', async () => {
    await onboard(alice);
    await set(alice, '2031-10-01', 400);
    await set(alice, '2031-10-02', 700);
    const row = await (await set(alice, '2031-10-01', 550)).json();

    assert.equal(row.calories_burned['2031-10-01'], 550);
    assert.equal(row.calories_burned['2031-10-02'], 700);
  });

  test('a bad day or figure is refused', async () => {
    await onboard(alice);
    for (const body of [
      { day: 'today', value: 100 },
      { day: '2031-10-01', value: -1 },
      { day: '2031-10-01', value: 1.5 },
      { day: '2031-10-01', value: 100, sneaky: true },
    ]) {
      const res = await call('/api/quest-data/calories-burned', {
        token: alice.token, method: 'PUT', body,
      });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('the route is closed without a token', async () => {
    const res = await call('/api/quest-data/calories-burned', {
      method: 'PUT', body: { day: '2031-10-01', value: 100 },
    });
    assert.equal(res.status, 401);
  });
});

describe('journal entries are appended, not rewritten', () => {
  const entry = (id: string, text: string) => ({
    id,
    date: '2031-09-01',
    category: 'mind',
    emoji: '📝',
    text,
    rawText: '',
    type: 'journal' as const,
  });

  async function onboard(actor: Actor) {
    await prisma.questData.deleteMany({ where: { userId: actor.id } });
    const res = await call('/api/quest-data', {
      token: actor.token, method: 'POST', body: { quest_data: QUESTS },
    });
    assert.equal(res.status, 201);
  }

  const add = (actor: Actor, body: unknown) =>
    call('/api/quest-data/journal', { token: actor.token, method: 'POST', body });

  test('two entries written at once both survive', async () => {
    await onboard(alice);
    const [a, b] = await Promise.all([
      add(alice, entry('one', 'From the phone')),
      add(alice, entry('two', 'From the laptop')),
    ]);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const row = await (await call('/api/quest-data', { token: alice.token })).json();
    const texts = row.journal_entries.map((e: { text: string }) => e.text).sort();
    assert.deepEqual(texts, ['From the laptop', 'From the phone']);
  });

  test('the same entry sent twice is recorded once', async () => {
    await onboard(alice);
    await add(alice, entry('same', 'Wrote this'));
    const row = await (await add(alice, entry('same', 'Wrote this'))).json();
    assert.equal(row.journal_entries.length, 1, 'a retry is not a second entry');
  });

  test('an entry with no text, a bad type or a stray field is refused', async () => {
    await onboard(alice);
    for (const body of [
      { ...entry('x', '   ') },
      { ...entry('x', 'ok'), type: 'shopping' },
      { ...entry('x', 'ok'), date: 'yesterday' },
      { ...entry('x', 'ok'), sneaky: true },
    ]) {
      assert.equal((await add(alice, body)).status, 400, JSON.stringify(body));
    }
  });

  test('the journal route is closed without a token', async () => {
    const res = await call('/api/quest-data/journal', {
      method: 'POST', body: entry('x', 'hello'),
    });
    assert.equal(res.status, 401);
  });
});

describe('coach chat', () => {
  async function onboard(actor: Actor) {
    await prisma.chatMessage.deleteMany({ where: { userId: actor.id } });
    await prisma.questData.deleteMany({ where: { userId: actor.id } });
    const res = await call('/api/quest-data', {
      token: actor.token, method: 'POST', body: { quest_data: QUESTS },
    });
    assert.equal(res.status, 201);
  }

  test('history starts empty and is scoped to the caller', async () => {
    await onboard(alice);
    await prisma.chatMessage.create({
      data: { userId: bob.id, role: 'user', content: "bob's private question" },
    });

    const res = await call('/api/ai/chat', { token: alice.token });
    assert.equal(res.status, 200);
    const { messages } = await res.json();
    assert.deepEqual(messages, [], "one user's chat is not another's");
  });

  test('history comes back oldest first, with its proposal', async () => {
    await onboard(alice);
    await prisma.chatMessage.create({
      data: { userId: alice.id, role: 'user', content: 'first' },
    });
    await prisma.chatMessage.create({
      data: {
        userId: alice.id,
        role: 'assistant',
        content: 'second',
        proposal: { kind: 'quest', category: 'health', level: 1, name: 'Walk', emoji: '🚶' },
      },
    });

    const { messages } = await (await call('/api/ai/chat', { token: alice.token })).json();
    assert.deepEqual(messages.map((m: { content: string }) => m.content), ['first', 'second']);
    assert.equal(messages[1].proposal.name, 'Walk');
    assert.equal(messages[0].proposal, null);
  });

  test('clearing removes only the caller\'s messages', async () => {
    await onboard(alice);
    await prisma.chatMessage.create({ data: { userId: alice.id, role: 'user', content: 'mine' } });
    await prisma.chatMessage.create({ data: { userId: bob.id, role: 'user', content: 'theirs' } });

    const res = await call('/api/ai/chat', { token: alice.token, method: 'DELETE' });
    assert.equal(res.status, 200);

    assert.equal(await prisma.chatMessage.count({ where: { userId: alice.id } }), 0);
    assert.ok(await prisma.chatMessage.count({ where: { userId: bob.id } }) > 0);
  });

  test('the chat is closed to anyone without a token', async () => {
    for (const method of ['GET', 'POST', 'DELETE']) {
      const res = await call('/api/ai/chat', {
        method,
        ...(method === 'POST' ? { body: { message: 'hello' } } : {}),
      });
      assert.equal(res.status, 401, `${method} /api/ai/chat must require a token`);
    }
  });

  test('an empty or oversized message is refused before any model call', async () => {
    await onboard(alice);
    for (const message of ['', '   ', 'x'.repeat(1001)]) {
      const res = await call('/api/ai/chat', { token: alice.token, method: 'POST', body: { message } });
      assert.equal(res.status, 400);
    }
    // Nothing was written on the way to being rejected.
    assert.equal(await prisma.chatMessage.count({ where: { userId: alice.id } }), 0);
  });

  test('the coach needs quest data before it can say anything', async () => {
    await prisma.questData.deleteMany({ where: { userId: alice.id } });
    const res = await call('/api/ai/chat', {
      token: alice.token, method: 'POST', body: { message: 'hi' },
    });
    assert.equal(res.status, 404);
  });
});

describe('push subscriptions', () => {
  const sub = (endpoint: string) => ({
    endpoint,
    keys: { p256dh: 'BKxQ'.repeat(8), auth: 'c2VjcmV0' },
  });

  const subscribe = (actor: Actor, body: unknown) =>
    call('/api/push/subscribe', { token: actor.token, method: 'POST', body });

  test('the key endpoint says whether push is configured at all', async () => {
    const res = await call('/api/push/key', { token: alice.token });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ['enabled', 'public_key']);
    // Without a VAPID pair the server must say so rather than hand out a key.
    if (!body.enabled) assert.equal(body.public_key, null);
  });

  test('a device subscribes once however many times it asks', async () => {
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    const endpoint = 'https://push.example.com/alice-phone';

    assert.equal((await subscribe(alice, sub(endpoint))).status, 201);
    assert.equal((await subscribe(alice, sub(endpoint))).status, 201);

    const rows = await prisma.pushSubscription.findMany({ where: { userId: alice.id } });
    assert.equal(rows.length, 1, 'resubscribing updates rather than duplicates');
  });

  test('one account can hold several devices', async () => {
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    await subscribe(alice, sub('https://push.example.com/alice-phone'));
    await subscribe(alice, sub('https://push.example.com/alice-laptop'));

    assert.equal(await prisma.pushSubscription.count({ where: { userId: alice.id } }), 2);
  });

  test("one user cannot unsubscribe another user's device", async () => {
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    const endpoint = 'https://push.example.com/alice-private';
    await subscribe(alice, sub(endpoint));

    const res = await call('/api/push/subscribe', {
      token: bob.token, method: 'DELETE', body: { endpoint },
    });
    assert.equal(res.status, 200, 'it answers, it just must not delete anything');
    assert.equal(await prisma.pushSubscription.count({ where: { userId: alice.id } }), 1);

    // Alice can, and it is gone.
    await call('/api/push/subscribe', { token: alice.token, method: 'DELETE', body: { endpoint } });
    assert.equal(await prisma.pushSubscription.count({ where: { userId: alice.id } }), 0);
  });

  test('a device that switches account moves rather than being shared', async () => {
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    await prisma.pushSubscription.deleteMany({ where: { userId: bob.id } });
    const endpoint = 'https://push.example.com/shared-browser';

    await subscribe(alice, sub(endpoint));
    await subscribe(bob, sub(endpoint));

    assert.equal(await prisma.pushSubscription.count({ where: { userId: alice.id } }), 0,
      'the previous owner stops being notified on a browser that is no longer theirs');
    assert.equal(await prisma.pushSubscription.count({ where: { userId: bob.id } }), 1);
  });

  test('a malformed subscription is refused', async () => {
    for (const body of [
      { endpoint: 'not-a-url', keys: { p256dh: 'a', auth: 'b' } },
      { endpoint: 'https://push.example.com/x' },
      { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a' } },
      { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a', auth: 'b' }, sneaky: 1 },
    ]) {
      assert.equal((await subscribe(alice, body)).status, 400, JSON.stringify(body));
    }
  });

  test('the push routes are closed without a token', async () => {
    assert.equal((await call('/api/push/key')).status, 401);
    assert.equal((await call('/api/push/subscribe', {
      method: 'POST', body: sub('https://push.example.com/x'),
    })).status, 401);
  });
});

describe('what a reminder says', () => {
  const ctx = { name: 'Alexander', streak: 6, quest: 'Walk 15 minutes' };

  test('two runs on the same day say the same thing', () => {
    // A retry, or a manual trigger beside the schedule, must not contradict
    // what is already sitting in the notification shade.
    const a = reminderCopy('en', 'reminder_streak', ctx, 'user-1', '2031-05-01');
    const b = reminderCopy('en', 'reminder_streak', ctx, 'user-1', '2031-05-01');
    assert.deepEqual(a, b);
  });

  test('the line changes from one day to the next', () => {
    const days = ['2031-05-01', '2031-05-02', '2031-05-03', '2031-05-04', '2031-05-05'];
    const titles = new Set(
      days.map((day) => reminderCopy('en', 'reminder_streak', ctx, 'user-1', day).title),
    );
    assert.ok(titles.size > 1, `the same line every day is a robot: ${[...titles]}`);
  });

  test('two people do not get the same line on the same evening', () => {
    const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    const titles = new Set(
      users.map((u) => reminderCopy('ru', 'reminder_streak', ctx, u, '2031-05-01').title),
    );
    assert.ok(titles.size > 1);
  });

  test('the name and the streak actually reach the text', () => {
    const seen = { name: false, streak: false };
    for (const day of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const { title, body } = reminderCopy('en', 'reminder_streak', ctx, 'u', day);
      if (`${title} ${body}`.includes('Alexander')) seen.name = true;
      if (/\b6\b|\b7\b/.test(`${title} ${body}`)) seen.streak = true;
    }
    assert.ok(seen.name, 'some lines address the user by name');
    assert.ok(seen.streak, 'some lines name the streak');
  });

  test('with no name and no quest every line still reads', () => {
    const bare = { name: '', streak: 0 };
    for (const lang of ['en', 'ru'] as const) {
      for (const day of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const { title, body } = reminderCopy(lang, 'reminder_cold', bare, 'u', day);
        for (const text of [title, body]) {
          assert.ok(text.length > 0, 'no empty text');
          assert.ok(!text.includes('undefined'), `leaked undefined: ${text}`);
          assert.ok(!/"\s*"|«\s*»/.test(text), `empty quotes left behind: ${text}`);
          assert.ok(!text.startsWith(','), `dangling comma: ${text}`);
        }
      }
    }
  });

  test('a name that is not a name is dropped rather than used', () => {
    assert.equal(firstName('Alexander Egorov'), 'Alexander');
    assert.equal(firstName('  Лекс  '), 'Лекс');
    assert.equal(firstName('user42@example.com'), '', 'an email address is not a greeting');
    assert.equal(firstName('X'), '', 'one letter reads as a typo');
    assert.equal(firstName(null), '');
    assert.equal(firstName('Bartholomewwwwwwwwwwwwwwwww'), '', 'absurdly long is not a name');
  });

  test('the situation follows the streak and what was done', () => {
    assert.equal(situationFor(6, true, true), null, 'nothing is sent once the day is done');
    assert.equal(situationFor(6, false, true), 'streak_warning');
    assert.equal(situationFor(6, false, false), 'reminder_streak', 'warning off, still a reminder');
    assert.equal(situationFor(0, false, true), 'reminder_cold', 'no streak to warn about');
  });

  test('both languages carry every situation', () => {
    for (const lang of ['en', 'ru'] as const) {
      for (const situation of ['streak_warning', 'reminder_streak', 'reminder_cold'] as const) {
        const { title, body } = reminderCopy(lang, situation, ctx, 'u', 'd');
        assert.ok(title && body, `${lang}/${situation} is missing text`);
        // Android truncates a long title to nothing useful.
        assert.ok(title.length <= 60, `${lang}/${situation} title too long: ${title}`);
      }
    }
  });
});

describe('sending a push', () => {
  const keys = { p256dh: 'fake-public-key', auth: 'fake-auth-secret' };

  /** Records what was sent, and answers however the case needs. */
  function recordingSender(answer: (endpoint: string) => Promise<unknown>) {
    const sent: { endpoint: string; payload: string }[] = [];
    setSender(async (subscription, payload) => {
      sent.push({ endpoint: subscription.endpoint, payload });
      return answer(subscription.endpoint);
    });
    return sent;
  }

  const refused = (statusCode: number) => Promise.reject(Object.assign(new Error('nope'), { statusCode }));

  before(() => {
    configurePush({ publicKey: VAPID.publicKey, privateKey: VAPID.privateKey, subject: 'mailto:t@t.local' });
  });

  after(() => setSender(null));

  test('every device a user has is sent to', async () => {
    const sent = recordingSender(() => Promise.resolve({ statusCode: 201 }));
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    for (const name of ['phone', 'laptop']) {
      await prisma.pushSubscription.create({
        data: { userId: alice.id, endpoint: `https://push.example.com/${name}`, ...keys },
      });
    }

    const delivered = await notifyUser(alice.id, { title: 'Streak', body: '6 days' });

    assert.equal(delivered, 2);
    assert.deepEqual(sent.map((s) => s.endpoint).sort(), [
      'https://push.example.com/laptop',
      'https://push.example.com/phone',
    ]);
    assert.deepEqual(JSON.parse(sent[0].payload), { title: 'Streak', body: '6 days' });
  });

  // A subscription dies when the app is uninstalled or site data cleared, and
  // the push service says so forever. Retrying it nightly is pointless.
  test('a subscription the service reports as gone is deleted', async () => {
    recordingSender(() => refused(410));
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    await prisma.pushSubscription.create({
      data: { userId: alice.id, endpoint: 'https://push.example.com/dead', ...keys },
    });

    assert.equal(await notifyUser(alice.id, { title: 'x', body: 'y' }), 0);
    assert.equal(await prisma.pushSubscription.count({ where: { userId: alice.id } }), 0);
  });

  test('a service merely having a bad day keeps its subscriptions', async () => {
    recordingSender(() => refused(500));
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    await prisma.pushSubscription.create({
      data: { userId: alice.id, endpoint: 'https://push.example.com/flaky', ...keys },
    });

    assert.equal(await notifyUser(alice.id, { title: 'x', body: 'y' }), 0);
    assert.equal(
      await prisma.pushSubscription.count({ where: { userId: alice.id } }),
      1,
      'an outage must not unsubscribe everyone',
    );
  });

  test('one dead device does not stop the others', async () => {
    recordingSender((endpoint) => (endpoint.endsWith('dead') ? refused(404) : Promise.resolve({})));
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    for (const name of ['dead', 'alive']) {
      await prisma.pushSubscription.create({
        data: { userId: alice.id, endpoint: `https://push.example.com/${name}`, ...keys },
      });
    }

    assert.equal(await notifyUser(alice.id, { title: 'x', body: 'y' }), 1);
    const left = await prisma.pushSubscription.findMany({ where: { userId: alice.id } });
    assert.deepEqual(left.map((r) => r.endpoint), ['https://push.example.com/alive']);
  });

  test('with no keys configured nothing is sent and nothing throws', async () => {
    configurePush(null);
    const sent = recordingSender(() => Promise.resolve({}));
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
    await prisma.pushSubscription.create({
      data: { userId: alice.id, endpoint: 'https://push.example.com/x', ...keys },
    });

    assert.equal(await notifyUser(alice.id, { title: 'x', body: 'y' }), 0);
    assert.equal(sent.length, 0, 'it does not even try');

    configurePush({ publicKey: VAPID.publicKey, privateKey: VAPID.privateKey, subject: 'mailto:t@t.local' });
    await prisma.pushSubscription.deleteMany({ where: { userId: alice.id } });
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

describe('reminders', () => {
  // The old window was minutesApart(...) <= 30, i.e. 61 minutes wide, against a
  // 30-minute cron: a 09:00 reminder matched 08:30, 09:00 and 09:30, so every
  // user who had not completed a quest got three identical emails a day.
  test('a reminder is due exactly once per 30-minute cron day', async () => {
    const reminder = 9 * 60;
    const due: number[] = [];
    for (let m = 0; m < 24 * 60; m += 30) {
      if (isDue(m, reminder)) due.push(m);
    }
    assert.equal(due.length, 2, 'the window may span runs; the claim dedupes');
    assert.deepEqual(due, [9 * 60, 9 * 60 + 30], 'and never before the time itself');
  });

  test('the window wraps midnight', async () => {
    assert.equal(minutesSince(10, 23 * 60 + 55), 15, '00:10 is 15 minutes after 23:55');
    assert.ok(isDue(10, 23 * 60 + 55));
    assert.ok(!isDue(23 * 60 + 50, 10), 'and does not fire the day before');
  });

  // The claim, which is what actually makes delivery at-most-once. A NULL
  // last_reminder_day has to count as "not claimed" — with Prisma's NOT filter
  // it did not, and nobody would ever have been sent anything.
  test('a day can be claimed once, by one run only', async () => {
    await prisma.questData.deleteMany({ where: { userId: alice.id } });
    await prisma.questData.create({ data: { userId: alice.id, questData: {} } });

    const claim = () => prisma.$executeRaw`
      UPDATE quest_data
         SET last_reminder_day = ${'2031-05-04'}, updated_at = now()
       WHERE user_id = ${alice.id}
         AND last_reminder_day IS DISTINCT FROM ${'2031-05-04'}`;

    const results = await Promise.all([claim(), claim(), claim()]);
    assert.equal(results.filter((n) => n === 1).length, 1, 'exactly one run may send');

    const next = await claim();
    assert.equal(next, 0, 'and a later run that day sends nothing');

    // A new day is claimable again.
    const tomorrow = await prisma.$executeRaw`
      UPDATE quest_data
         SET last_reminder_day = ${'2031-05-05'}, updated_at = now()
       WHERE user_id = ${alice.id}
         AND last_reminder_day IS DISTINCT FROM ${'2031-05-05'}`;
    assert.equal(tomorrow, 1);

    await prisma.questData.deleteMany({ where: { userId: alice.id } });
  });
});

describe('what an in-app notification says', () => {
  test('milestones are the ones worth interrupting someone for', () => {
    assert.ok(isStreakMilestone(3));
    assert.ok(isStreakMilestone(7));
    assert.ok(isStreakMilestone(365));
    assert.ok(!isStreakMilestone(1), 'day one is the streak starting, not a milestone');
    assert.ok(!isStreakMilestone(4));
    assert.ok(!isStreakMilestone(0));
  });

  test('the last freeze is said differently from the others', () => {
    const ru = copyFor('ru');
    assert.match(ru.freezeUsed(2).body, /2/);
    assert.match(ru.freezeUsed(0).body, /последняя/i);
    assert.doesNotMatch(ru.freezeUsed(0).body, /0/, 'not "0 freezes left"');

    const en = copyFor('en');
    assert.match(en.freezeUsed(1).body, /1 freeze left/, 'singular');
    assert.match(en.freezeUsed(3).body, /3 freezes left/, 'plural');
    assert.match(en.freezeUsed(0).body, /last freeze/);
  });

  test('a lost streak of nothing does not claim a number', () => {
    for (const lang of ['ru', 'en'] as const) {
      assert.doesNotMatch(copyFor(lang).streakLost(0).body, /\b0\b/);
      assert.match(copyFor(lang).streakLost(9).body, /9/);
    }
  });

  test('an unknown language falls back to Russian rather than to nothing', () => {
    // The language is whatever the browser last saved; a value from an older
    // build must not leave a notification with no text at all.
    assert.deepEqual(copyFor('de' as 'ru'), copyFor('ru'));
  });
});

describe('the in-app notification log', () => {
  async function onboard(actor: Actor) {
    await prisma.notification.deleteMany({ where: { userId: actor.id } });
    await prisma.questData.deleteMany({ where: { userId: actor.id } });
    const res = await call('/api/quest-data', {
      token: actor.token, method: 'POST', body: { quest_data: QUESTS },
    });
    assert.equal(res.status, 201);
  }

  /** XP the way the app earns it — one completion per day, three each. */
  async function earnXp(actor: Actor, xp: number) {
    for (let i = 0; i < Math.ceil(xp / 3); i += 1) {
      await call('/api/quest-data/completions', {
        token: actor.token,
        method: 'POST',
        body: { day: `2032-06-${String(i + 1).padStart(2, '0')}`, category: 'health', quest_name: `q${i}`, level: 3 },
      });
    }
  }

  const list = async (actor: Actor) =>
    (await (await call('/api/notifications', { token: actor.token })).json()) as {
      notifications: { id: string; kind: string; title: string; body: string; data: unknown; read: boolean }[];
      unread: number;
    };

  test('the log is private to its owner', async () => {
    assert.equal((await call('/api/notifications')).status, 401);
    assert.equal((await call('/api/notifications/unread')).status, 401);
    assert.equal((await call('/api/notifications/read', { method: 'POST' })).status, 401);
  });

  test('a level-up is logged once, however many devices acknowledge it', async () => {
    await onboard(bob);
    await earnXp(bob, 30); // past the level 3 threshold

    const ack = () => call('/api/quest-data/level-celebrated', {
      token: bob.token, method: 'POST', body: { level: 3 },
    });

    // Two tabs showing the same modal, plus a retry after a dropped response.
    await Promise.all([ack(), ack()]);
    await ack();

    const { notifications } = await list(bob);
    const levelUps = notifications.filter((n) => n.kind === 'level_up');
    assert.equal(levelUps.length, 1, 'one row, not one per acknowledgement');
    assert.deepEqual(levelUps[0]?.data, { level: 3 });
    assert.match(levelUps[0]?.title ?? '', /3/, 'the line names the level');
  });

  test('a streak milestone is logged on the day it is reached, and only then', async () => {
    await onboard(bob);

    const countDay = (day: string) =>
      call('/api/quest-data/streak', { token: bob.token, method: 'POST', body: { day } });

    await countDay('2032-07-01');
    await countDay('2032-07-02');
    assert.equal(
      (await list(bob)).notifications.filter((n) => n.kind === 'streak_milestone').length,
      0,
      'two days is not a milestone',
    );

    await countDay('2032-07-03');
    const atThree = (await list(bob)).notifications.filter((n) => n.kind === 'streak_milestone');
    assert.equal(atThree.length, 1);
    assert.deepEqual(atThree[0]?.data, { streak: 3 });

    // The same day again does not count towards the streak, so it says nothing.
    await countDay('2032-07-03');
    assert.equal(
      (await list(bob)).notifications.filter((n) => n.kind === 'streak_milestone').length,
      1,
      'a second call for the same day is silent',
    );

    await countDay('2032-07-04');
    assert.equal(
      (await list(bob)).notifications.filter((n) => n.kind === 'streak_milestone').length,
      1,
      'four is not a milestone either',
    );
  });

  test('a spent freeze is logged with what is left of them', async () => {
    await onboard(bob);
    const used = await call('/api/quest-data/streak/freeze', {
      token: bob.token, method: 'POST', body: { action: 'use' },
    });
    assert.equal((await used.json()).applied, true);

    const rows = (await list(bob)).notifications.filter((n) => n.kind === 'freeze_used');
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]?.data, { freezes: 0 }, 'the count after spending, not before');

    // Nothing left to spend, so nothing more to say.
    const again = await call('/api/quest-data/streak/freeze', {
      token: bob.token, method: 'POST', body: { action: 'use' },
    });
    assert.equal((await again.json()).applied, false);
    assert.equal((await list(bob)).notifications.filter((n) => n.kind === 'freeze_used').length, 1);
  });

  /**
   * The value in the line is the streak the user just lost, which no longer
   * exists anywhere by the time the row is read back. RETURNING hands back the
   * new row — zero — so this would have logged "It was 0 days" without the CTE
   * that reads the pre-update snapshot.
   */
  test('a lost streak is logged with the number it was, not the zero it became', async () => {
    await onboard(bob);
    for (const day of ['2032-08-01', '2032-08-02', '2032-08-03', '2032-08-04', '2032-08-05']) {
      await call('/api/quest-data/streak', { token: bob.token, method: 'POST', body: { day } });
    }

    const lost = await call('/api/quest-data/streak/freeze', {
      token: bob.token, method: 'POST', body: { action: 'lose' },
    });
    const row = await lost.json();
    assert.equal(row.streak, 0);

    const logged = (await list(bob)).notifications.filter((n) => n.kind === 'streak_lost');
    assert.equal(logged.length, 1);
    assert.deepEqual(logged[0]?.data, { streak: 5 });
    assert.match(logged[0]?.body ?? '', /5/);
  });

  test('opening the list is what marks it read', async () => {
    await onboard(bob);
    await earnXp(bob, 30);
    await call('/api/quest-data/level-celebrated', {
      token: bob.token, method: 'POST', body: { level: 3 },
    });

    const before = await list(bob);
    assert.ok(before.unread >= 1);
    assert.ok(before.notifications.some((n) => !n.read), 'a new entry reads as new');

    const read = await (await call('/api/notifications/read', { token: bob.token, method: 'POST' })).json();
    assert.equal(read.unread, 0);

    const unread = await (await call('/api/notifications/unread', { token: bob.token })).json();
    assert.equal(unread.unread, 0);

    const after = await list(bob);
    assert.ok(after.notifications.every((n) => n.read));
    assert.equal(after.unread, 0);
  });

  test("one notification can be marked read without touching the rest", async () => {
    await onboard(bob);
    await prisma.notification.createMany({
      data: [
        { userId: bob.id, kind: 'reminder', title: 'one', body: 'b', dedupeKey: 'one' },
        { userId: bob.id, kind: 'reminder', title: 'two', body: 'b', dedupeKey: 'two' },
      ],
    });

    const { notifications } = await list(bob);
    const target = notifications.find((n) => n.title === 'one');
    const res = await (await call('/api/notifications/read', {
      token: bob.token, method: 'POST', body: { id: target?.id },
    })).json();
    assert.equal(res.unread, 1, 'the other one is still unread');
  });

  test("another account's notification cannot be marked read or cleared", async () => {
    await onboard(bob);
    await prisma.notification.deleteMany({ where: { userId: alice.id } });
    const mine = await prisma.notification.create({
      data: { userId: alice.id, kind: 'reminder', title: 'alice only', body: 'b' },
    });

    // Bob knows the id and asks for it by name.
    const res = await call('/api/notifications/read', {
      token: bob.token, method: 'POST', body: { id: mine.id },
    });
    assert.equal(res.status, 200, 'it matches nothing rather than erroring');
    assert.equal((await prisma.notification.findUnique({ where: { id: mine.id } }))?.readAt, null);

    await call('/api/notifications', { token: bob.token, method: 'DELETE' });
    assert.ok(
      await prisma.notification.findUnique({ where: { id: mine.id } }),
      "clearing your own log leaves someone else's alone",
    );

    assert.deepEqual((await list(bob)).notifications, [], 'and Bob only ever saw his own');
    await prisma.notification.deleteMany({ where: { userId: alice.id } });
  });

  /**
   * The log is bounded on write rather than paginated on read, so this is the
   * only thing stopping the table growing for the life of an account.
   */
  test('the log keeps the newest and drops the rest', async () => {
    await onboard(bob);
    for (let i = 0; i < MAX_PER_USER + 12; i += 1) {
      await recordNotification(bob.id, {
        kind: 'reminder',
        title: `n${String(i).padStart(3, '0')}`,
        body: 'b',
        dedupeKey: `trim-${i}`,
      });
    }

    const stored = await prisma.notification.count({ where: { userId: bob.id } });
    assert.equal(stored, MAX_PER_USER);

    const { notifications } = await list(bob);
    assert.equal(notifications[0]?.title, `n${String(MAX_PER_USER + 11).padStart(3, '0')}`);
    assert.ok(
      notifications.every((n) => Number(n.title.slice(1)) >= 12),
      'the twelve oldest are gone, not twelve arbitrary ones',
    );
  });

  test('the same dedupe key writes one row, whichever run gets there first', async () => {
    await onboard(bob);
    const write = () =>
      recordNotification(bob.id, {
        kind: 'reminder',
        title: 'the evening reminder',
        body: 'b',
        dedupeKey: 'reminder-2032-09-01',
      });

    const [a, b, c] = await Promise.all([write(), write(), write()]);
    assert.equal([a, b, c].filter(Boolean).length, 1, 'exactly one insert lands');
    assert.equal(await prisma.notification.count({ where: { userId: bob.id } }), 1);

    assert.equal(await write(), false, 'and a later run that day adds nothing');
  });

  test('an event with no dedupe key may happen twice', async () => {
    await onboard(bob);
    await recordNotification(bob.id, { kind: 'streak_lost', title: 'gone', body: 'b' });
    await recordNotification(bob.id, { kind: 'streak_lost', title: 'gone again', body: 'b' });
    assert.equal(await prisma.notification.count({ where: { userId: bob.id } }), 2);
  });
});

/**
 * The stub Bot API the running server is pointed at, via TELEGRAM_API_BASE.
 *
 * Asserting on what the bot replied is most of the value here — a webhook that
 * links the account but answers nothing looks broken to the user — and that
 * reply is made by the API process, not this one, so injecting a sender into
 * this process would see none of it.
 */
const TELEGRAM_STUB_PORT = 3112;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? 'test-webhook-secret-value';

interface StubCall {
  method: string;
  chat_id: string;
  text: string;
  /** Everything the API sent, for the methods that are not "say this to a chat". */
  body: Record<string, unknown>;
}

/** What createInvoiceLink returns. Telegram hands back a t.me link, so does this. */
const STUB_INVOICE_LINK = 'https://t.me/$stub-invoice-link';

const telegramCalls: StubCall[] = [];
let telegramStub: import('node:http').Server | null = null;

/** Chats the stub answers the way Telegram does once the user blocks the bot. */
const blockedChats = new Set<string>();

async function startTelegramStub() {
  const { createServer } = await import('node:http');
  telegramStub = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const method = (req.url ?? '').split('/').pop() ?? '';
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(raw || '{}') as Record<string, unknown>;
        telegramCalls.push({
          method,
          chat_id: String(body.chat_id ?? ''),
          text: String(body.text ?? ''),
          body,
        });
      } catch {
        telegramCalls.push({ method, chat_id: '', text: raw, body: {} });
      }
      if (blockedChats.has(String(body.chat_id ?? ''))) {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            error_code: 403,
            description: 'Forbidden: bot was blocked by the user',
          }),
        );
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      // Most methods return true; createInvoiceLink returns the link itself,
      // and the API refuses to hand out anything else.
      res.end(
        JSON.stringify({
          ok: true,
          result: method === 'createInvoiceLink' ? STUB_INVOICE_LINK : {},
        }),
      );
    });
  });
  await new Promise<void>((resolve) => telegramStub!.listen(TELEGRAM_STUB_PORT, '127.0.0.1', resolve));
}

/** What the bot said to this chat, oldest first. */
const saidTo = (chatId: string) => telegramCalls.filter((c) => c.chat_id === chatId).map((c) => c.text);

describe('connecting Telegram', () => {
  before(async () => {
    await startTelegramStub();
  });

  after(async () => {
    await new Promise<void>((resolve) => telegramStub?.close(() => resolve()));
  });

  const webhook = (body: unknown, secret: string | null = WEBHOOK_SECRET) =>
    fetch(`${BASE}/api/telegram/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret === null ? {} : { 'X-Telegram-Bot-Api-Secret-Token': secret }),
      },
      body: JSON.stringify(body),
    });

  const start = (chatId: number, payload?: string, username?: string) =>
    webhook({
      message: {
        chat: { id: chatId, ...(username ? { username } : {}) },
        ...(username ? { from: { username } } : {}),
        text: payload ? `/start ${payload}` : '/start',
      },
    });

  /** The code out of the t.me link the app hands the user. */
  async function mintCode(actor: Actor): Promise<string> {
    const res = await call('/api/telegram/link', { token: actor.token, method: 'POST' });
    assert.equal(res.status, 200);
    const { url } = await res.json();
    assert.match(url, /^https:\/\/t\.me\/dailyq_test_bot\?start=/);
    return new URL(url).searchParams.get('start')!;
  }

  test('the bot username is public, the token is not', async () => {
    const res = await fetch(`${BASE}/api/telegram/config`);
    assert.equal(res.status, 200, 'the SPA needs this before it can draw the button');
    const body = await res.json();
    assert.equal(body.enabled, true);
    assert.equal(body.bot_username, 'dailyq_test_bot');
    assert.equal(
      JSON.stringify(body).includes('test-bot-token'),
      false,
      'the token never leaves the server',
    );
  });

  test('linking needs a session; the webhook needs the secret', async () => {
    assert.equal((await call('/api/telegram/link')).status, 401);
    assert.equal((await call('/api/telegram/link', { method: 'POST' })).status, 401);
    assert.equal((await call('/api/telegram/link', { method: 'DELETE' })).status, 401);

    // No header at all, and a wrong one. Both are the front door.
    assert.equal((await webhook({ message: { chat: { id: 1 }, text: '/start' } }, null)).status, 403);
    assert.equal(
      (await webhook({ message: { chat: { id: 1 }, text: '/start' } }, 'not-the-secret')).status,
      403,
    );
    // Same length as the real one, so this is the compare rather than the length check.
    assert.equal(
      (await webhook({ message: { chat: { id: 1 }, text: '/start' } }, 'x'.repeat(WEBHOOK_SECRET.length)))
        .status,
      403,
    );
  });

  test('a code links the chat, and cannot be spent twice', async () => {
    await prisma.telegramLink.deleteMany({ where: { userId: bob.id } });
    const chatId = '900001';
    await prisma.telegramLink.deleteMany({ where: { chatId } });

    const before = await (await call('/api/telegram/link', { token: bob.token })).json();
    assert.equal(before.connected, false);

    const code = await mintCode(bob);
    assert.equal((await start(900001, code, 'bobtg')).status, 200);

    const after = await (await call('/api/telegram/link', { token: bob.token })).json();
    assert.equal(after.connected, true);
    assert.equal(after.username, 'bobtg');
    assert.ok(after.linked_at);

    // The code is gone from the row, not merely expired.
    const row = await prisma.telegramLink.findUnique({ where: { userId: bob.id } });
    assert.equal(row?.codeHash, null);
    assert.equal(row?.codeExpiresAt, null);

    assert.ok(
      saidTo(chatId).some((text) => /Подключено/.test(text)),
      'the bot confirms, rather than going silent',
    );

    // A replay of the same link — a forwarded message, a second tap.
    telegramCalls.length = 0;
    await start(900002, code);
    assert.equal(
      (await prisma.telegramLink.count({ where: { chatId: '900002' } })),
      0,
      'a spent code links nothing',
    );
    assert.ok(
      saidTo('900002').some((text) => /больше не действует|expired/i.test(text)),
      'and the second chat is told why',
    );
  });

  test('an expired code links nothing', async () => {
    await prisma.telegramLink.deleteMany({ where: { userId: bob.id } });
    const code = await mintCode(bob);

    // Wind the expiry back rather than waiting fifteen minutes.
    await prisma.telegramLink.updateMany({
      where: { userId: bob.id },
      data: { codeExpiresAt: new Date(Date.now() - 1000) },
    });

    await start(900003, code);
    const row = await prisma.telegramLink.findUnique({ where: { userId: bob.id } });
    assert.equal(row?.chatId, null);
    assert.ok(row?.codeHash, 'and the code is left alone rather than consumed');
  });

  test('minting a code again replaces the old one', async () => {
    await prisma.telegramLink.deleteMany({ where: { userId: bob.id } });
    const first = await mintCode(bob);
    const second = await mintCode(bob);
    assert.notEqual(first, second);

    await start(900004, first);
    assert.equal(
      await prisma.telegramLink.count({ where: { chatId: '900004' } }),
      0,
      'the invitation the user abandoned is dead',
    );

    await start(900004, second);
    assert.equal(await prisma.telegramLink.count({ where: { chatId: '900004' } }), 1);
  });

  /**
   * One chat cannot feed two accounts: the reminders would interleave in the
   * same conversation with no way to tell whose they were. The unique index
   * would also simply reject the second claim, which the user would see as the
   * link silently not working.
   */
  test('a chat already linked elsewhere moves rather than failing', async () => {
    const chatId = '900005';
    await prisma.telegramLink.deleteMany({ where: { OR: [{ chatId }, { userId: bob.id }, { userId: alice.id }] } });

    await start(900005, await mintCode(alice));
    assert.equal((await (await call('/api/telegram/link', { token: alice.token })).json()).connected, true);

    await start(900005, await mintCode(bob));
    assert.equal(
      (await (await call('/api/telegram/link', { token: alice.token })).json()).connected,
      false,
      'the previous owner is disconnected',
    );
    assert.equal((await (await call('/api/telegram/link', { token: bob.token })).json()).connected, true);
    assert.equal(await prisma.telegramLink.count({ where: { chatId } }), 1);
  });

  test('/stop unlinks from the Telegram side', async () => {
    await prisma.telegramLink.deleteMany({ where: { userId: bob.id } });
    await prisma.telegramLink.deleteMany({ where: { chatId: '900006' } });
    await start(900006, await mintCode(bob));

    telegramCalls.length = 0;
    const res = await webhook({ message: { chat: { id: 900006 }, text: '/stop' } });
    assert.equal(res.status, 200);

    assert.equal((await (await call('/api/telegram/link', { token: bob.token })).json()).connected, false);
    assert.ok(saidTo('900006').some((text) => /Отключено|Disconnected/.test(text)));

    // Again, with nothing left to stop.
    telegramCalls.length = 0;
    await webhook({ message: { chat: { id: 900006 }, text: '/stop' } });
    assert.ok(saidTo('900006').some((text) => /ничего не подключено|Nothing connected/i.test(text)));
  });

  test('disconnecting from the app removes the row', async () => {
    await prisma.telegramLink.deleteMany({ where: { chatId: '900007' } });
    await prisma.telegramLink.deleteMany({ where: { userId: bob.id } });
    await start(900007, await mintCode(bob));

    const res = await call('/api/telegram/link', { token: bob.token, method: 'DELETE' });
    assert.equal((await res.json()).disconnected, true);
    assert.equal(await prisma.telegramLink.count({ where: { userId: bob.id } }), 0);
  });

  test('a bare /start explains itself instead of erroring', async () => {
    telegramCalls.length = 0;
    const res = await start(900008);
    assert.equal(res.status, 200);
    assert.ok(saidTo('900008').some((text) => /Подключить Telegram|Connect Telegram/.test(text)));
  });

  /**
   * Telegram retries any non-2xx with backoff and eventually drops the webhook
   * altogether, so an update shape this bot does not handle has to be a 200.
   */
  test('an update this bot does not handle is accepted and ignored', async () => {
    for (const body of [
      { edited_message: { chat: { id: 1 }, text: 'hi' } },
      { message: { chat: { id: 1 }, photo: [] } },
      { channel_post: { chat: { id: 1 }, text: 'hi' } },
      {},
    ]) {
      const res = await webhook(body);
      assert.equal(res.status, 200, JSON.stringify(body));
    }
  });
});

/**
 * Paying for Pro with Telegram Stars.
 *
 * Money is the one path that cannot be checked by trying it, so all of it is
 * checked here: that the invoice names the right price in the right currency,
 * that a checkout is approved only against a payload we signed, that a payment
 * grants exactly one period, and — the part a retry would otherwise break —
 * that Telegram redelivering the same charge does not buy a second month.
 */
/**
 * The test send, which exists so "it did not arrive" has an answer.
 *
 * The two numbers it returns are the point: no devices and no delivery look
 * identical from the app and need opposite fixes — subscribe this browser,
 * versus replace a subscription the push service has stopped accepting. Both
 * of those are what is checked here.
 *
 * What is deliberately not checked is a successful delivery. web-push speaks
 * TLS whatever scheme the endpoint carries, so standing a stub in for a
 * browser vendor's push service would mean a self-signed certificate and an
 * API process told to accept it — weakening the server under test to prove
 * something only a real push service can prove. That case is exactly what the
 * button is for a person to check on their own phone.
 */
/**
 * The two VAPID keys are two independent environment variables, which makes
 * regenerating one and pasting only that an easy mistake — and a completely
 * silent one before this: the key endpoint hands out a public key, the browser
 * subscribes against it happily, and only the send fails, invisibly, hours
 * later.
 */
describe('VAPID keys that are not a pair', () => {
  after(() => configurePush(null));

  test('a matching pair configures push', () => {
    configurePush({
      publicKey: VAPID.publicKey,
      privateKey: VAPID.privateKey,
      subject: 'mailto:t@t.local',
    });
    assert.equal(pushEnabled(), true);
  });

  test('a mismatched pair is refused rather than accepted and left to fail', () => {
    const other = webpush.generateVAPIDKeys();
    configurePush({
      publicKey: VAPID.publicKey,
      privateKey: other.privateKey,
      subject: 'mailto:t@t.local',
    });
    assert.equal(pushEnabled(), false, 'configured-but-broken reports itself as working');
    assert.equal(publicKey(), null, 'and must not hand out a key nothing can sign for');
  });

  test('a private key that is not a key at all is refused too', () => {
    configurePush({
      publicKey: VAPID.publicKey,
      privateKey: 'not-a-key',
      subject: 'mailto:t@t.local',
    });
    assert.equal(pushEnabled(), false);
  });
});

/** A guest is decided by its subject, never by what its address looks like. */
describe('what a guest is', () => {
  test('the `guest:` subject is the definition', () => {
    assert.equal(isGuestSubject('guest:abc'), true);
    assert.equal(isGuestSubject('1234567890'), false);
  });
});

describe('sending a test notification', () => {
  /** Whether the server this suite is pointed at can send at all. */
  const pushConfigured = async () =>
    (await (await call('/api/push/key', { token: alice.token })).json()).enabled === true;

  test('it needs a session', async () => {
    assert.equal((await call('/api/push/test', { method: 'POST' })).status, 401);
  });

  test('a server with no VAPID pair says so rather than reporting a silent success', async () => {
    if (await pushConfigured()) return;
    const res = await call('/api/push/test', { token: alice.token, method: 'POST' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'push_disabled');
  });

  test('with nothing subscribed it reports no devices, not a failure', async () => {
    if (!(await pushConfigured())) return;
    const actor = await makeUser('push-tester');
    await prisma.pushSubscription.deleteMany({ where: { userId: actor.id } });

    const res = await call('/api/push/test', { token: actor.token, method: 'POST' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.devices, 0, 'which means: this browser never subscribed');
    assert.equal(body.delivered, 0);
  });

  test('a subscription the service refuses is counted but not delivered', async () => {
    if (!(await pushConfigured())) return;
    const actor = await makeUser('push-tester-2');
    await prisma.pushSubscription.deleteMany({ where: { userId: actor.id } });
    await prisma.pushSubscription.create({
      data: {
        userId: actor.id,
        // Nothing is listening, so this fails the way a subscription that died
        // with the browser's storage does. Keyed on the user because the column
        // is unique: a fixed string collides with whoever holds it already.
        endpoint: `http://127.0.0.1:9/gone-${actor.id}`,
        p256dh: 'not-a-key',
        auth: 'nope',
      },
    });

    const body = await (await call('/api/push/test', { token: actor.token, method: 'POST' })).json();
    assert.equal(body.devices, 1);
    assert.equal(body.delivered, 0, 'which means: subscribed, but the send failed');
  });

});

/**
 * Which channels can reach a user, and proving each one from the profile.
 *
 * Before this the app could not tell anyone whether Telegram or push worked
 * at all — the first sign of a broken channel was a reminder that never came,
 * and nothing said which one should have carried it.
 */
describe('which channels reach a user', () => {
  before(async () => {
    await startTelegramStub();
  });

  after(async () => {
    blockedChats.clear();
    await new Promise<void>((resolve) => telegramStub?.close(() => resolve()));
  });

  const channels = async (actor: Actor) => {
    const res = await call('/api/notifications/channels', { token: actor.token });
    assert.equal(res.status, 200);
    return res.json();
  };

  test('both need a session', async () => {
    assert.equal((await call('/api/notifications/channels')).status, 401);
    assert.equal((await call('/api/telegram/test', { method: 'POST' })).status, 401);
  });

  test('a fresh account is told what is missing, channel by channel', async () => {
    const actor = await makeUser('channels-fresh');
    const body = await channels(actor);

    // Push follows what the server was given, and says which way it is off.
    const pushOn = (await (await call('/api/push/key', { token: actor.token })).json()).enabled;
    assert.equal(body.push.configured, pushOn);
    assert.equal(body.push.devices, 0);
    assert.equal(body.push.works, false);
    if (pushOn) assert.equal(body.push.reason, 'no_devices');
    else assert.ok(['not_configured', 'keys_mismatch'].includes(body.push.reason));

    // The suite's server always has a bot.
    assert.deepEqual(body.telegram, {
      configured: true,
      works: false,
      reason: 'not_linked',
      connected: false,
      username: null,
    });

    // Email was dropped as a channel; nothing reaches this account yet.
    assert.equal('email' in body, false);
    assert.equal(body.reminders_via, null);
  });

  test('a linked chat and a subscribed device show up, and Telegram wins', async () => {
    const actor = await makeUser('channels-linked');
    await prisma.telegramLink.deleteMany({ where: { chatId: '940001' } });
    await prisma.telegramLink.create({
      data: { userId: actor.id, chatId: '940001', username: 'linked_person', linkedAt: new Date() },
    });
    await prisma.pushSubscription.create({
      data: {
        userId: actor.id,
        // Keyed on the user: the column is unique across accounts.
        endpoint: `http://127.0.0.1:9/channels-${actor.id}`,
        p256dh: 'k',
        auth: 'a',
      },
    });

    const body = await channels(actor);
    assert.equal(body.telegram.connected, true);
    assert.equal(body.telegram.works, true);
    assert.equal(body.telegram.reason, null);
    assert.equal(body.telegram.username, 'linked_person');
    assert.equal(body.push.devices, 1);
    assert.equal(body.push.works, body.push.configured);
    // The job's order: Telegram first, whatever else works.
    assert.equal(body.reminders_via, 'telegram');
  });

  test('another account is not counted', async () => {
    const body = await channels(await makeUser('channels-other'));
    assert.equal(body.telegram.connected, false);
    assert.equal(body.push.devices, 0);
  });

  describe('a test Telegram message', () => {
    const sendTest = (actor: Actor) =>
      call('/api/telegram/test', { token: actor.token, method: 'POST' });

    async function linkChat(actor: Actor, chatId: string) {
      await prisma.telegramLink.deleteMany({ where: { OR: [{ userId: actor.id }, { chatId }] } });
      await prisma.telegramLink.create({ data: { userId: actor.id, chatId, linkedAt: new Date() } });
    }

    test('with no chat linked it says so, and sends nothing', async () => {
      const actor = await makeUser('tg-tester');
      telegramCalls.length = 0;

      const res = await sendTest(actor);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { sent: false, reason: 'not_linked' });
      assert.equal(telegramCalls.length, 0);
    });

    test('a linked chat receives it', async () => {
      const actor = await makeUser('tg-tester');
      await linkChat(actor, '940002');
      telegramCalls.length = 0;

      const res = await sendTest(actor);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { sent: true, reason: null });
      const said = saidTo('940002');
      assert.equal(said.length, 1);
      assert.match(said[0] ?? '', /Тестовое сообщение|Test message/);
    });

    /**
     * The bot blocked or the chat deleted. The answer has to differ from "not
     * linked" — the user did connect it — and the chat is unlinked now, so the
     * profile goes back to offering the connect button.
     */
    test('a chat Telegram calls gone is reported as gone, and unlinked', async () => {
      const actor = await makeUser('tg-tester');
      await linkChat(actor, '940003');
      blockedChats.add('940003');

      assert.deepEqual(await (await sendTest(actor)).json(), { sent: false, reason: 'chat_gone' });
      const row = await prisma.telegramLink.findUnique({ where: { userId: actor.id } });
      assert.equal(row?.chatId, null);
      assert.equal((await channels(actor)).telegram.reason, 'not_linked');
    });
  });
});

describe('paying for Pro', () => {
  before(async () => {
    await startTelegramStub();
  });

  after(async () => {
    await new Promise<void>((resolve) => telegramStub?.close(() => resolve()));
  });

  const webhook = (body: unknown) =>
    fetch(`${BASE}/api/telegram/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET,
      },
      body: JSON.stringify(body),
    });

  /** An account whose trial is long gone, which is who this is for. */
  async function lapsedUser(name: string) {
    const actor = await makeUser(name);
    await prisma.user.update({
      where: { id: actor.id },
      data: { trialStartedAt: new Date(Date.now() - 10 * 864e5), isPremium: false },
    });
    return actor;
  }

  /** Asks for an invoice and returns the payload the API put inside it. */
  async function invoicePayload(actor: Actor): Promise<string> {
    telegramCalls.length = 0;
    const res = await call('/api/billing/invoice', { token: actor.token, method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).url, STUB_INVOICE_LINK);

    const minted = telegramCalls.find((c) => c.method === 'createInvoiceLink');
    assert.ok(minted, 'the API should have called createInvoiceLink');
    return String(minted.body.payload);
  }

  const paymentUpdate = (chatId: number, payload: string, chargeId: string) => ({
    message: {
      chat: { id: chatId },
      successful_payment: {
        currency: 'XTR',
        total_amount: 150,
        invoice_payload: payload,
        telegram_payment_charge_id: chargeId,
      },
    },
  });

  const premiumUntil = async (id: string) =>
    (await prisma.user.findUnique({ where: { id }, select: { premiumUntil: true } }))?.premiumUntil ??
    null;

  test('the plan names a price in Stars', async () => {
    const actor = await lapsedUser('plan-reader');
    const plan = await (await call('/api/billing/plan', { token: actor.token })).json();

    assert.equal(plan.enabled, true);
    assert.equal(plan.currency, 'XTR');
    assert.equal(plan.provider, 'telegram_stars');
    assert.ok(plan.price > 0);
    assert.ok(plan.days > 0);
    assert.equal(plan.is_pro, false);
  });

  test('the invoice is for Stars, with no provider token', async () => {
    const actor = await lapsedUser('invoice-buyer');
    telegramCalls.length = 0;
    await call('/api/billing/invoice', { token: actor.token, method: 'POST' });

    const minted = telegramCalls.find((c) => c.method === 'createInvoiceLink');
    assert.ok(minted);
    assert.equal(minted.body.currency, 'XTR');
    // Telegram rejects a Stars invoice that carries one.
    assert.equal(minted.body.provider_token, '');
    const prices = minted.body.prices as { amount: number }[];
    assert.equal(prices.length, 1, 'XTR allows exactly one line item');
    assert.ok(prices[0]!.amount > 0);
  });

  test('an invoice needs a session', async () => {
    assert.equal((await call('/api/billing/invoice', { method: 'POST' })).status, 401);
  });

  test('checkout is approved for our payload and refused for a forged one', async () => {
    const actor = await lapsedUser('checkout');
    const payload = await invoicePayload(actor);

    telegramCalls.length = 0;
    await webhook({ pre_checkout_query: { id: 'q1', invoice_payload: payload } });
    const approved = telegramCalls.find((c) => c.method === 'answerPreCheckoutQuery');
    assert.ok(approved);
    assert.equal(approved.body.ok, true);

    /**
     * The same payload with the account swapped for someone else's. Without the
     * signature this is all it would take to have a stranger's payment credited
     * to your own account — or your own payment credited to an account you do
     * not own, which is the same hole from the other side.
     */
    const other = await lapsedUser('checkout-victim');
    const forged = payload.replace(/:[^:]+:/, `:${other.id}:`);

    telegramCalls.length = 0;
    await webhook({ pre_checkout_query: { id: 'q2', invoice_payload: forged } });
    const refused = telegramCalls.find((c) => c.method === 'answerPreCheckoutQuery');
    assert.ok(refused, 'silence would read to the user as a failed payment');
    assert.equal(refused.body.ok, false);
  });

  test('a payment grants the period, and unlocks the AI the trial had locked', async () => {
    const actor = await lapsedUser('payer');

    const blocked = await call('/api/ai/meal/text', {
      token: actor.token, method: 'POST', body: { text: 'a burger' },
    });
    assert.equal((await blocked.json()).code, 'premium_required');

    const payload = await invoicePayload(actor);
    telegramCalls.length = 0;
    assert.equal((await webhook(paymentUpdate(930001, payload, 'charge-1'))).status, 200);

    const until = await premiumUntil(actor.id);
    assert.ok(until, 'the account should now have paid time');
    const days = (until.getTime() - Date.now()) / 864e5;
    assert.ok(days > 29 && days < 31, `expected ~30 days, got ${days}`);

    const row = await prisma.payment.findUnique({ where: { chargeId: 'charge-1' } });
    assert.equal(row?.userId, actor.id);
    assert.equal(row?.amount, 150);
    assert.equal(row?.provider, 'telegram_stars');

    assert.ok(
      telegramCalls.some((c) => /Pro/.test(c.text)),
      'the bot should confirm the purchase',
    );

    const allowed = await call('/api/ai/meal/text', {
      token: actor.token, method: 'POST', body: { text: 'a burger' },
    });
    assert.notEqual(allowed.status, 403, 'a paid account passes the gate');
  });

  /**
   * Telegram redelivers any update it did not hear a 200 for, and a network
   * blip between the grant and our response is enough. Recording the charge id
   * first, in the same transaction, is what makes the second delivery free.
   */
  test('the same charge delivered twice buys one period', async () => {
    const actor = await lapsedUser('double-delivery');
    const payload = await invoicePayload(actor);

    await webhook(paymentUpdate(930002, payload, 'charge-2'));
    const first = await premiumUntil(actor.id);

    telegramCalls.length = 0;
    await webhook(paymentUpdate(930002, payload, 'charge-2'));
    const second = await premiumUntil(actor.id);

    assert.equal(second?.getTime(), first?.getTime(), 'the expiry must not move');
    assert.equal(await prisma.payment.count({ where: { userId: actor.id } }), 1);
    assert.equal(
      telegramCalls.filter((c) => c.method === 'sendMessage').length,
      0,
      'and the user is thanked once, not twice',
    );
  });

  test('paying again adds to the time left instead of replacing it', async () => {
    const actor = await lapsedUser('renewer');
    const payload = await invoicePayload(actor);

    await webhook(paymentUpdate(930003, payload, 'charge-3a'));
    const first = await premiumUntil(actor.id);
    assert.ok(first);

    await webhook(paymentUpdate(930003, await invoicePayload(actor), 'charge-3b'));
    const second = await premiumUntil(actor.id);
    assert.ok(second);

    const added = (second.getTime() - first.getTime()) / 864e5;
    assert.ok(added > 29 && added < 31, `the second month should stack, added ${added}`);
  });

  test('a payment whose payload does not verify grants nothing', async () => {
    const actor = await lapsedUser('forger');
    const payload = await invoicePayload(actor);
    const forged = `${payload.slice(0, -1)}${payload.endsWith('a') ? 'b' : 'a'}`;

    assert.equal((await webhook(paymentUpdate(930004, forged, 'charge-4'))).status, 200);

    assert.equal(await premiumUntil(actor.id), null);
    assert.equal(await prisma.payment.count({ where: { chargeId: 'charge-4' } }), 0);
  });
});

describe('sending to Telegram', () => {
  /** The transport, in this process, where it can be swapped. */
  const calls: { chatId: string; text: string }[] = [];

  before(() => {
    configureTelegram({ token: 'unit-token', username: 'unit_bot' });
  });

  after(() => {
    setTelegramSender(null);
    configureTelegram(null);
  });

  function respondWith(status: number, ok = status === 200) {
    calls.length = 0;
    setTelegramSender(async (_token, _method, payload) => {
      const body = payload as { chat_id: string; text: string };
      calls.push({ chatId: String(body.chat_id), text: body.text });
      return { ok, status };
    });
  }

  async function link(actor: Actor, chatId: string) {
    await prisma.telegramLink.deleteMany({ where: { OR: [{ userId: actor.id }, { chatId }] } });
    await prisma.telegramLink.create({
      data: { userId: actor.id, chatId, linkedAt: new Date() },
    });
  }

  test('a reminder reaches the linked chat', async () => {
    respondWith(200);
    await link(bob, '910001');

    assert.equal(await notifyTelegram(bob.id, { title: 'Серия', body: '6 дн.' }), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.chatId, '910001');
    assert.match(calls[0]?.text ?? '', /<b>Серия<\/b>/);
  });

  test('a user with no chat is simply not a Telegram user', async () => {
    respondWith(200);
    await prisma.telegramLink.deleteMany({ where: { userId: bob.id } });
    assert.equal(await notifyTelegram(bob.id, { title: 't', body: 'b' }), false);
    assert.equal(calls.length, 0, 'and nothing is sent anywhere');
  });

  /**
   * Markup that does not parse makes Telegram reject the whole message, so a
   * quest someone named "<b>gym" would cost them the reminder rather than
   * looking odd.
   */
  test('a quest name that looks like markup does not cost the reminder', async () => {
    respondWith(200);
    await link(bob, '910002');

    await notifyTelegram(bob.id, { title: 'Ждёт «<b>gym»', body: 'a & b <script>' });
    const text = calls[0]?.text ?? '';
    assert.match(text, /&lt;b&gt;gym/);
    assert.match(text, /a &amp; b &lt;script&gt;/);
    assert.equal(text.includes('<script>'), false);
    // Our own bold tags are still tags.
    assert.match(text, /^<b>/);
  });

  test('a blocked bot unlinks the chat rather than being retried nightly', async () => {
    respondWith(403, false);
    await link(bob, '910003');

    assert.equal(await notifyTelegram(bob.id, { title: 't', body: 'b' }), false);
    const row = await prisma.telegramLink.findUnique({ where: { userId: bob.id } });
    assert.equal(row?.chatId, null, 'the chat is gone');
    assert.ok(row, 'but the row stays, so reconnecting changes nothing else');
  });

  test('Telegram merely having a bad day keeps the chat', async () => {
    respondWith(503, false);
    await link(bob, '910004');

    assert.equal(await notifyTelegram(bob.id, { title: 't', body: 'b' }), false);
    assert.equal(
      (await prisma.telegramLink.findUnique({ where: { userId: bob.id } }))?.chatId,
      '910004',
      'tomorrow will try again',
    );
  });

  test('with no bot configured nothing is attempted', async () => {
    respondWith(200);
    await link(bob, '910005');
    configureTelegram(null);

    assert.equal(await notifyTelegram(bob.id, { title: 't', body: 'b' }), false);
    assert.equal(calls.length, 0);

    configureTelegram({ token: 'unit-token', username: 'unit_bot' });
  });
});

/**
 * The same seams in-process, where the transport can be swapped: what is worth
 * pinning is that each failure is told apart from the others, not that the SDKs
 * can speak HTTP.
 */
describe('why a channel did not deliver', () => {
  after(() => {
    setTelegramSender(null);
    configureTelegram(null);
    configurePush(null);
  });

  test('push says whether its keys are missing or mismatched', () => {
    configurePush(null);
    assert.equal(pushProblem(), 'no_keys');

    configurePush({
      publicKey: VAPID.publicKey,
      privateKey: webpush.generateVAPIDKeys().privateKey,
      subject: 'mailto:t@t.local',
    });
    assert.equal(pushProblem(), 'keys_mismatch');

    configurePush({ publicKey: VAPID.publicKey, privateKey: VAPID.privateKey, subject: 'mailto:t@t.local' });
    assert.equal(pushProblem(), null);
  });

  test('Telegram tells no bot, no chat, a bad day and a gone chat apart', async () => {
    const chatId = '950001';
    const answer = (status: number) =>
      setTelegramSender(async () => ({ ok: status === 200, status }));
    const msg = { title: 't', body: 'b' };

    configureTelegram(null);
    assert.equal(await sendTelegramTo(bob.id, msg), 'disabled');

    configureTelegram({ token: 'unit-token', username: 'unit_bot' });
    await prisma.telegramLink.deleteMany({ where: { OR: [{ userId: bob.id }, { chatId }] } });
    answer(200);
    assert.equal(await sendTelegramTo(bob.id, msg), 'not_linked');

    await prisma.telegramLink.create({ data: { userId: bob.id, chatId, linkedAt: new Date() } });
    assert.equal(await sendTelegramTo(bob.id, msg), 'sent');

    answer(503);
    assert.equal(await sendTelegramTo(bob.id, msg), 'failed');

    answer(403);
    assert.equal(await sendTelegramTo(bob.id, msg), 'gone');
    assert.equal((await prisma.telegramLink.findUnique({ where: { userId: bob.id } }))?.chatId, null);
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
