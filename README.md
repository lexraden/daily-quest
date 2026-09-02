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
`http://localhost:5173` in its authorised JavaScript origins, and
`VITE_GOOGLE_CLIENT_ID` must be set when the web app builds.

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
with a per-minute rate limit and a monthly per-user ceiling. The client-side
`usePremiumStatus` hook decides what the UI *offers*; the server decides what
actually runs.

**Files.** Meal photos and avatars are written to the Railway volume at
`/data/uploads/<userId>/`, with the type sniffed from the bytes rather than
trusted from the upload header. Since a browser cannot put an `Authorization`
header on an `<img>` request, image URLs carry an HMAC signature instead:
`/api/files/<id>?sig=…`. The signature covers the file and its owner and is
stable for the file's lifetime, because these URLs are persisted inside
`meal_history`.

Photos are sent to OpenAI inline as base64 — the model has no credentials to
fetch a URL on our volume.

## Deploying to Railway

One project, three services.

**Postgres** — add the database plugin. Enable scheduled backups.

**`dailyq-api`** — deploy from this repo with root directory `apps/api`.
Attach a volume mounted at `/data`. Set the variables from `.env.example`,
referencing the database as `${{Postgres.DATABASE_URL}}`. `npm start` runs
`prisma migrate deploy` before booting, so deploys migrate themselves. Health
check is `/api/health`, which does a real database round-trip.

This service serves the SPA as well as the API, so there is one domain, no CORS,
and no cookie `SameSite` problems.

**`dailyq-reminders`** — same repo, same root directory, with the start command
`npm run reminders --workspace apps/api` and a cron schedule (every 30 minutes
matches the reminder window logic). It needs `DATABASE_URL`, `RESEND_API_KEY`
and `REMINDER_FROM`; it does not need the volume. The job checks each user's
local reminder time against their timezone, skips anyone who has already
completed a quest today, and exits.

Note that a Railway volume attaches to exactly one service and pins it to a
single replica. If `dailyq-api` ever needs to scale out, move file storage to
S3/R2 behind the existing `/api/files` contract.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/google` | Exchange a Google ID token for a session |
| `POST /api/auth/refresh` | Rotate the refresh token, mint an access token |
| `POST /api/auth/logout` | Revoke the refresh token |
| `GET/PATCH/DELETE /api/auth/me` | Read, update, or delete the account |
| `GET /api/quest-data` | The caller's row; `204` when onboarding is pending |
| `POST /api/quest-data` | Create after onboarding; starts the trial |
| `PATCH /api/quest-data` | Field-level merge — target of the debounced save |
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

## Known limitations

- **Billing is not built.** `is_premium` is a flag with no payment path behind
  it. Stripe was listed as a dependency in the Base44 version but never
  imported; those packages have been removed.
- **Last-write-wins across devices.** The debounced save writes a snapshot, so
  two open tabs will overwrite each other. This was true on Base44 as well; the
  field-level merge makes it less destructive. Add an `updatedAt` concurrency
  check if it ever causes real data loss.
- **`meal_history` and `journal_entries` are unbounded arrays** rewritten
  wholesale on every save. Fine at current scale; normalise into their own
  tables when they get long.
- **Push notifications are stubbed.** `notification_settings.push_token` exists
  and the reminders job has the hook for it, but delivery is email only.
