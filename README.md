# DailyQ

Daily quests, streaks, journalling and calorie tracking. A React SPA with its
own API, running on Railway.

Previously built on Base44; that dependency is gone. Base44 now holds nothing
but historical stats and nothing in this repo talks to it.

## Layout

```
apps/web     Vite + React 18 SPA (Tailwind, shadcn/ui, React Query)
apps/api     Fastify + Prisma API — also serves the built SPA in production
```

npm workspaces, so `npm install` at the root installs both.

## Running locally

You need Node 20+ and a Postgres database.

```bash
npm install

# 1. Configure. Fill in the values marked in the file.
cp .env.example apps/api/.env

# 2. Create the schema.
npm run prisma:migrate --workspace apps/api

# 3. Start the API on :3000
npm run dev:api

# 4. In a second terminal, start the SPA on :5173
#    Vite proxies /api through to the API, so it is same-origin in dev too.
npm run dev
```

For sign-in to work locally, the Google OAuth client needs
`http://localhost:5173` in its authorised JavaScript origins. The client id
itself is only ever set as `GOOGLE_CLIENT_ID` on the API — the SPA fetches it
from `GET /api/auth/config` at runtime, so there is no second copy to keep in
sync and no rebuild when it changes.

## Architecture

**Auth.** Google Sign-In on the client hands an ID token to
`POST /api/auth/google`. The API verifies it against Google's keys, upserts the
user, and returns a 15-minute access token plus an `HttpOnly` refresh cookie.
Refresh tokens are stored hashed and rotate on every use, so a replayed token is
already revoked. The access token lives in memory only.

Every route derives the user from that token. No endpoint accepts a user id or
email in a request body — that was the authorisation hole in the Base44 version,
where the client chose its own `created_by` filter.

**Data.** One `quest_data` row per user, keyed by user id. The JSON columns keep
the shape the React app already read and wrote, so components did not need
reshaping. `PATCH /api/quest-data` merges only the fields it is given, against an
explicit allowlist — `is_premium` and `trial_started_at` are not on it and can
only be set server-side.

**AI.** Five endpoints under `/api/ai`, one per thing the app actually does:
generate onboarding quests, interpret a voice command, clean up a transcript,
estimate a meal from text, and estimate a meal from a photo. Prompts live in
`apps/api/src/ai/prompts.ts`.

There is deliberately no generic "run this prompt" endpoint. Forwarding a
caller-supplied prompt would put an authenticated, billable OpenAI proxy on the
public internet.

Access is gated server-side on trial or premium status read from the database,
with a per-minute rate limit and a monthly per-user ceiling charged only on
success. The client-side `usePremiumStatus` hook decides what the UI *offers*;
the server decides what actually runs.

Entitlement lives on the **user** row, not on `quest_data` — that row is deleted
when someone resets onboarding, which would otherwise hand out a fresh trial
each time. The trial clock starts at the first AI call rather than at onboarding
completion, because generating the opening quests happens before any quest data
exists, and because never onboarding must not buy an unexpiring trial.

**Mood.** A daily check-in (1-5, optional note) is stored on
`quest_data.mood_log`, keyed by local date like `completion_history` and
`calories_burned` are. The Statistics page reads both and shows average mood by
how many quests were completed that day — the app already recorded what you
*did*, and this records how it *felt*, which is the pairing that makes the
history worth looking at.

**Progress.** XP, category totals and category levels are never taken from the
request — the server derives them from `completion_history` (`src/lib/progress.ts`).
Completions are applied one at a time by `POST`/`DELETE /api/quest-data/completions`,
which lock the row for the transaction, so two tabs completing different quests
queue up instead of one overwriting the other. They used to arrive as absolute
integers computed in the browser, which lost an increment whenever two tabs
saved inside the same window.

The streak has its own endpoints for the same reason. `POST /api/quest-data/streak`
counts a day with `WHERE last_completed_date IS DISTINCT FROM $day`, so a retry
or a second tab adds nothing rather than incrementing twice; `POST
/api/quest-data/streak/freeze` spends a freeze under `WHERE streak_freezes > 0`,
so the last one cannot be spent twice. The debounced whole-document save no
longer carries any of these fields. `PATCH` still *accepts* them, and ignores
them, so an older bundle left open in a tab keeps saving instead of getting a
400.

**Days.** `completion_history`, `calories_burned`, `mood_log` and `meal_history`
are all keyed by `YYYY-MM-DD` in the **viewer's own timezone**, built by
`apps/web/src/lib/dates.js`. They used to be built with `toISOString()`, which
is UTC: east of Greenwich the key rolled over early — at UTC+4 the day flipped
at 04:00 local, so anything logged just after midnight landed on the previous
day. It was not only cosmetic, because DailyTracker compares `last_visit_date`
against today's key to decide whether a new day started, and the streak follows
from that. The server never invents a day: it cannot know the caller's
timezone, so `POST /api/quest-data` takes `last_visit_date` from the client.

**Files.** Meal photos and avatars are written to the Railway volume at
`/data/uploads/<userId>/`, with the type sniffed from the bytes rather than
trusted from the upload header. Since a browser cannot put an `Authorization`
header on an `<img>` request, image URLs carry an HMAC signature instead:
`/api/files/<id>?sig=…`. The signature covers the file and its owner and is
stable for the file's lifetime, because these URLs are persisted inside
`meal_history`.

Photos are sent to OpenAI inline as base64 — the model has no credentials to
fetch a URL on our volume.

## Tests

```bash
npm test          # end-to-end API tests, needs a running API + Postgres
npm run lint
npm run typecheck
```

See `apps/api/test/README.md` for the database setup. The suite runs against
real HTTP and a real database rather than mocks: every case in it corresponds
to something that was genuinely broken or exploitable at some point — the
autosave payload the client actually sends, cross-user isolation on rows and
files, refresh-token replay, signed image URLs, the trial gate. CI
(`.github/workflows/ci.yml`) runs all of it on every push and pull request.

## Deploying to Railway

One project, three services.

**Postgres** — add the database plugin. Enable scheduled backups.

**`dailyq-api`** — deploy from this repo with **Root Directory left at the repo
root**, not `apps/api`. This is an npm workspace: `npm ci` has to run at the root
where the single lockfile lives, and the build has to produce `apps/web/dist`
for the API to serve. `railway.json` at the root sets the build and start
commands. Attach a volume mounted at `/data`.

There is no separate web service — this one serves the SPA too. Set the variables from `.env.example`,
referencing the database as `${{Postgres.DATABASE_URL}}`. `npm start` runs
`prisma migrate deploy` before booting, so deploys migrate themselves. Health
check is `/api/health`, which does a real database round-trip.

This service serves the SPA as well as the API, so there is one domain, no CORS,
and no cookie `SameSite` problems.

**`dailyq-reminders`** — same repo, also at the repo root, but override the
start command to `npm run reminders` and set a cron schedule (every 30 minutes
matches the reminder window logic). It needs `DATABASE_URL`, `RESEND_API_KEY`
and `REMINDER_FROM`, plus `APP_ORIGIN` for the link in the email. It does not
need the volume, and deliberately does not load the API's signing secrets or
the OpenAI key — its environment is validated separately in `src/env.job.ts`. The job checks each user's
local reminder time against their timezone, skips anyone who has already
completed a quest today, and exits.

Note that a Railway volume attaches to exactly one service and pins it to a
single replica. If `dailyq-api` ever needs to scale out, move file storage to
S3/R2 behind the existing `/api/files` contract.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/auth/config` | Public sign-in config (the Google client id) |
| `POST /api/auth/google` | Exchange a Google ID token for a session |
| `POST /api/auth/refresh` | Rotate the refresh token, mint an access token |
| `POST /api/auth/logout` | Revoke the refresh token |
| `GET/PATCH/DELETE /api/auth/me` | Read, update, or delete the account |
| `GET /api/quest-data` | The caller's row; `204` when onboarding is pending |
| `POST /api/quest-data` | Create after onboarding; starts the trial |
| `PATCH /api/quest-data` | Field-level merge — target of the debounced save |
| `POST/DELETE /api/quest-data/completions` | Record or undo one quest; XP is derived |
| `POST /api/quest-data/streak` | Count a day towards the streak, once |
| `POST /api/quest-data/streak/freeze` | Spend a freeze, or let the streak go |
| `DELETE /api/quest-data` | Reset onboarding |
| `POST /api/ai/quests/generate` | Onboarding answers → 6 categories × 3 levels |
| `POST /api/ai/quests/voice` | Voice transcript → intent and quest |
| `POST /api/ai/text/cleanup` | Tidy a spoken onboarding answer |
| `POST /api/ai/meal/text` | Description → macros |
| `POST /api/ai/meal/correct` | Meal + correction → recalculated macros |
| `POST /api/ai/meal/photo` | Photos → macros |
| `POST /api/files` | Upload an image; returns id and signed URL |
| `GET/DELETE /api/files/:id` | Serve or remove an owned file |
| `GET /api/health` | Liveness plus a database round-trip |

`quest_data.mood_log` is written through the same `PATCH /api/quest-data`
allowlist as every other field; there is no separate mood endpoint.

## Known limitations

- **Billing is not built.** `is_premium` is a flag with no payment path behind
  it. Stripe was listed as a dependency in the Base44 version but never
  imported; those packages have been removed.
- **Last-write-wins across devices, for the fields the client still owns.**
  Quests, journal entries, meals, calories and mood are still sent as a
  debounced snapshot, so two open tabs can overwrite each other there. Progress
  no longer works that way — see **Progress** above.
- **`meal_history` and `journal_entries` are unbounded arrays** rewritten
  wholesale on every save. Fine at current scale; normalise into their own
  tables when they get long.
- **The Statistics page needs three check-ins** before it shows charts; below
  that it explains what to do instead of drawing an empty axis.
- **Push notifications are stubbed.** `notification_settings.push_token` exists
  and the reminders job has the hook for it, but delivery is email only.
