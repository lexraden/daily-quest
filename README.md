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

Rotation claims the token with an atomic conditional update — the validity
predicate lives in the `WHERE` clause and the affected-row count is the
authorization, so exactly one caller can consume it. Checking `revokedAt` in
JavaScript and then updating by id was not the same thing: two refreshes
arriving together both read a live row and both minted a successor, turning one
token into two live sessions, and a logout racing a refresh was undone the same
way. There is deliberately no token-family revocation on reuse — with several
tabs open, a legitimate double refresh would sign the user out everywhere.

Every route derives the user from that token. No endpoint accepts a user id or
email in a request body — that was the authorisation hole in the Base44 version,
where the client chose its own `created_by` filter.

**Guest accounts.** `POST /api/auth/guest` mints a throwaway account, for
testing somewhere Google sign-in cannot be reached. It is off unless
`GUEST_LOGIN_ENABLED` is `1`, and returns 404 otherwise; `GET /api/auth/config`
reports whether it is on, and the sign-in screen only offers it where it is. A
guest is an ordinary user — own row, own data, same trial, same per-user AI
quota — so nothing about the isolation other routes rely on changes. What it
removes is the identity proof, which is why it is rate limited to five per hour
per IP: every new guest is a fresh trial, and a fresh trial can spend money on
OpenAI. Leave it off in production once testing is done. Guests are identifiable
by their `guest:` subject prefix and `@guest.invalid` email, so they are easy to
delete later.

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
success. `AI_GATE_ENABLED=0` drops the trial check for testing — an expired
three-day trial is otherwise just in the way — while leaving the monthly quota
in force, so it is not a blank cheque. Turning it back on resumes the clock
where it was rather than granting everyone a fresh trial. The client-side `usePremiumStatus` hook decides what the UI *offers*;
the server decides what actually runs.

Entitlement lives on the **user** row, not on `quest_data` — that row is deleted
when someone resets onboarding, which would otherwise hand out a fresh trial
each time. The trial clock starts at the first AI call rather than at onboarding
completion, because generating the opening quests happens before any quest data
exists, and because never onboarding must not buy an unexpiring trial.

**Statistics.** No longer reachable: the entry point on Profile is gone. The
page and its route are still there, unlinked, along with the mood history it
plots.

**Mood.** The daily check-in has been taken off the main screen — it competed
for the top of the page with the day's quests. `quest_data.mood_log` still
holds whatever was recorded while it was there, and the Statistics page still
plots it, so nothing was lost; there is simply no way to add to it right now.
Statistics falls back to its "check in for a few days" empty state once that
history runs out.

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

## Installing on a phone

There is no app package. The SPA is an installable PWA, so Chrome on Android
offers "Add to home screen" and it then runs standalone — its own icon, no
address bar. `apps/web/public/manifest.json` carries the raster icons Chrome
requires (192 and 512 PNG, plus a maskable one so Android does not frame the
icon in a white circle) and `sw.js` is the service worker that makes it
installable at all.

The light and dark themes live in one place (`apps/web/src/lib/theme.js`),
applied to `<html>` at boot before the first paint and **observable** — pages
subscribe through `useTheme()` instead of reading storage on mount. Reading
once was not enough: tabs stay mounted after their first visit, so History and
Profile kept whatever theme was in force when they were first opened and never
followed the toggle on the tracker.

`body` is painted with the theme's own colour rather than Tailwind's token,
because in standalone the page runs under the status bar and that is what shows
through. The full-page gradients run **vertically** for the same reason: on a
diagonal (`to-br`) the top row shades across the width, so it could not match a
status bar filled with one flat colour and left a visible band along the top
edge. Vertical means the first row is exactly the `from-` colour, which is the
theme colour. The manifest carries **no** `theme_color`, on purpose. A value there is fixed
at install time and cannot follow a theme the user picks by hand — setting it
light left a light bar over the dark app, setting it dark left a dark bar over
the light one. Without it the page's `<meta name="theme-color">` is the only
source, and that one does follow the theme.

The meta is corrected by an inline script in `<head>`, during parsing, before
any module loads: Chrome reads theme-color very early and an installed app may
never look again, so the first value it sees has to be right. `applyTheme`
keeps it in step afterwards for the toggle.

Note that the Android navigation bar along the bottom is not part of this. No
way was found to colour it from the page; it appears to follow the system. Components style
themselves from a `theme` prop, so nothing had ever set the `dark` class
Tailwind is configured for: `body` kept the light background in dark mode, and
in standalone — where the page runs under the status bar — that showed as a
white strip above a dark app. The manifest's `background_color` and
`theme_color` have to agree with each other too; a dark background against a
light theme painted a black band under a light app.

Profile carries an **Install app** button where the browser has an install to
offer. `beforeinstallprompt` fires once and early, so it is captured at boot
(`apps/web/src/lib/installPrompt.js`) rather than by the screen that shows the
button; where it never fires — any iOS browser, or an app already installed —
there is nothing to offer and the button stays hidden.

That worker is deliberately small, because a bad one is very hard to undo on
someone's phone:

- `/api/` is never intercepted. Those responses are per-user and change
  constantly.
- Navigations are network-first and fall back to the cached shell only offline.
  Serving a cached `index.html` first is how a deploy strands people: the old
  shell asks for asset hashes that no longer exist and the app comes up blank.
- `/assets/` is cache-first, and only `/assets/`, which is safe because Vite
  content-hashes those filenames — a changed file is a different URL. Anything
  else keeps its name forever, so caching it that way meant a change could
  never reach a phone that had loaded it once; `manifest.json` in particular
  sat frozen through two attempts to fix the status-bar colour. Those go to the
  network first and fall back to the cache only offline.

If a package is ever needed for a store listing, use a Trusted Web Activity
(Bubblewrap) over this PWA rather than a WebView wrapper: Google refuses OAuth
in an embedded WebView (`disallowed_useragent`), so Capacitor would break
sign-in and need a native Google plugin instead.

## Environment

`NODE_ENV` is parsed leniently at one end and strictly at the other. An empty
value counts as absent — Zod's `.default()` only fills a *missing* key, so a
blanked-out `NODE_ENV=""` reached the enum and crash-looped the service on
boot. An unrecognised value still fails loudly.

When nothing is set, a deployed container (detected from the `RAILWAY_*`
variables) falls back to `production` and a laptop to `development`. That
asymmetry is deliberate: `isProd` gates the `Secure` flag on the refresh
cookie, so defaulting a deployment to development would quietly ship session
cookies without it, while defaulting a laptop to production would break sign-in
over plain http.

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

**`dailyq-reminders`** — same repo, also at the repo root, but point its
**Config-as-code path at `railway.reminders.json`** and set a cron schedule;
every 30 minutes is a good default, and the job no longer depends on the period
being exact.

The separate config file is the whole trick. Railway applies the repo's
`railway.json` to every service built from it, and config-as-code takes
precedence over the dashboard — so this service would inherit the API's start
command, the API's `/api/health` healthcheck (which a job that exits by design
can never answer) and `ON_FAILURE` restarts, and a start command typed into the
dashboard would be ignored. `railway.reminders.json` sets what a cron job
actually needs: build only the API, run `npm run reminders`, never restart. It
also skips building the web bundle, which this service has no use for.

Note that it does **not** run `prisma migrate deploy` — only `dailyq-api` does.
Two services migrating the same database on every deploy is a race for no gain.

It needs `DATABASE_URL`, `APP_ORIGIN`, the VAPID pair and the Telegram bot token
and username, since it is the process that actually sends. `RESEND_API_KEY` and
`REMINDER_FROM` are optional: without them email is simply not one of the
channels. None of the API's signing secrets or its OpenAI key belong here.

Delivery is at-most-once per local day. The job claims the day with a
conditional `UPDATE ... WHERE last_reminder_day IS DISTINCT FROM $day` and only
sends if that claimed a row, so a retry after a crash, a manual trigger running
beside the schedule, or a second replica all send nothing. Recording after
sending would be the wrong way round — a crash in between leaves no record and
the retry emails everyone again. If the send itself fails the day is given back,
so a provider outage costs a retry rather than everyone's reminder; the residual
risk is a send that succeeded but reported failure, and one duplicate beats
silently dropping a day.

### Which service is which

Both services deploy the same image from the same repository and differ only in
what they run. Railway's mechanism for that is a per-service config-as-code
path, and `railway.reminders.json` is it: `npm run reminders`, no healthcheck,
`restartPolicyType: NEVER` because a job that has finished is not a crash.

`SERVICE_ROLE=reminders` does the same job a second way, for when that setting
is wrong. It is worth having because the failure is silent in the worst
direction: a reminders service without it inherits the root `railway.json`, so
it runs `prisma migrate deploy`, binds a port, and dies on API secrets it was
never meant to hold — which looks like a broken job rather than a misconfigured
one, and happened twice.

The two do not conflict. A service whose config-as-code points at
`railway.reminders.json` never reaches the dispatcher; that file names the job
directly. `scripts/start.mjs` only decides for a service running the root
config's start command, and there the default stays the API, because the web
service is the one that has to keep working when nobody has set anything.

The dispatcher runs the child in its own process group and signals the group,
not the child. Underneath is `npm run` → `sh -c` → `node`, and npm does not pass
signals down: signalling the child alone killed npm and left the server holding
its port and its database connections until the container was killed outright.

### Granting Pro

`isPremium` on the user row is the paid flag; without it access comes from the
three-day trial that starts at the first AI call. To hand Pro to the earliest
accounts — a launch gift, a thank-you — run the script from `dailyq-api`, where
`DATABASE_URL` already points at the right database:

```bash
npm run grant-pro --workspace apps/api -- --dry-run   # who would get it
npm run grant-pro --workspace apps/api                # the first 5
npm run grant-pro --workspace apps/api -- --count=10
npm run grant-pro --workspace apps/api -- --revoke    # undo
```

It orders by `created_at` (and by id, so a tie cannot swap places between a dry
run and the real one), skips guest accounts from `GUEST_LOGIN_ENABLED`, and only
writes rows that need changing — so re-running it is a no-op and the count it
prints is the number of people whose access actually changed.

A grant reaches people who are already signed in. The access token carries only
a subject and an email, and the gate reads `is_premium` from the database on
every call; the badge in the app follows on its next load of quest data. Putting
the flag in the token would be faster and would silently mean a grant did nothing
until the user signed out, which is the moment nobody would connect to the
change — there is a test pinning this.

### Paying for Pro

Pro is bought with **Telegram Stars**, through the same bot that delivers the
reminders. Telegram is the merchant of record, so there is no merchant account,
no card data on our side and nothing to certify — and it works inside the iOS
app, where a card form would not. The cost is Telegram's cut and that payouts go
through them.

`PRO_PRICE_STARS` and `PRO_PERIOD_DAYS` set the price and what it buys. Both are
read when an invoice is minted, so changing them needs a restart but not a
release, and never touches what someone already paid for.

The flow is three moves:

1. the app calls `POST /api/billing/invoice`, which mints a Telegram invoice
   link and returns it;
2. Telegram asks the webhook whether to allow the checkout
   (`pre_checkout_query`) and gives ten seconds to answer;
3. Telegram reports the completed payment (`successful_payment`).

Nothing is written before step 3, so a user who opens an invoice and walks away
leaves nothing to clean up.

Step 2 arrives on its own update type, so the webhook's `allowed_updates` has to
name `pre_checkout_query` — without it Telegram never asks, the ten-second
window lapses and every checkout fails while the bot otherwise looks healthy. A
completed payment arrives inside a `message`, which is already allowed.

Which account an invoice belongs to travels inside `invoice_payload`, the one
field that survives the round trip — **signed**, because the string is handed to
a Telegram client, and an unsigned account id there would let anyone who can mint
an invoice name someone else's account as the beneficiary. The signature is
re-checked on `successful_payment` rather than trusted from the pre-checkout
step: they are separate HTTP requests and only the second one grants anything.

Payments are recorded in `payments` with the provider's charge id as a unique
column, and that is the whole idempotency mechanism: Telegram redelivers any
update it did not hear a 200 for, and the insert and the grant are one
transaction, so a redelivered payment adds nothing. The extension is
`max(now, premium_until) + days`, so paying again mid-period stacks instead of
truncating, and paying again after a lapse starts from today.

Entitlement is read as `isPremium || premiumUntil > now` (`hasPro` in
`lib/access.ts`). The two are deliberately separate: `isPremium` is a standing
grant that no clock turns off, so a comped account is never quietly cancelled.

### Notifications

Three channels for the same events, in the order they are tried.

**The in-app log** (`notifications` table, the bell in the tracker header) is
written first and unconditionally, so it does not depend on either of the
others working. It is the only channel that cannot be missed: a phone that was
off, a permission never granted, a subscription the browser dropped when site
data was cleared, an email in a promotions tab — the line is still there the
next time the app is opened. Rows carry the text as it was rendered, in the
language the user had at the time, because a log records what was said rather
than retelling it in whatever language is current. Writes are idempotent through
a `(user_id, dedupe_key)` unique index, and the table is trimmed to the newest
forty rows per user on write, so it is bounded rather than paginated.

Events logged: the daily reminder and the streak warning (from the job), a new
overall level, a streak milestone (3, 7, 14, 30, 50, 100, 150, 200, 365 days), a
spent streak freeze, and a lost streak.

Then **one** of the three delivery channels, not all of them — whichever is
reachable first wins and the rest are skipped, because two notifications for one
reminder is nagging and nagging is how the permission gets revoked.

**Telegram** is tried first. Connecting it is a deliberate act — the user opened
their profile and linked an account — where a push permission is a prompt
somebody tapped through once. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
and `TELEGRAM_WEBHOOK_SECRET` (see `.env.example` for the one-off `setWebhook`
call); leave them empty and the profile hides the button. `GET
/api/telegram/config` answers whether the API actually got them — `enabled:
false` there means the channel is off whatever the dashboard shows.

The link is made by a one-time code, because the alternative is asking users to
find their own numeric chat id. `POST /api/telegram/link` mints one, hands back
`t.me/<bot>?start=<code>`, and the bot's webhook turns that code into the chat it
arrived from. The code lives fifteen minutes, is stored only as a SHA-256 hash,
and is consumed by the same `UPDATE` that claims it — so two messages arriving
together cannot both spend it, and minting a new one kills the old. A chat that
is already linked to another account is moved rather than rejected; the unique
index would otherwise reject the claim and the user would see the link silently
not working. `/stop` in the chat unlinks from Telegram's side, which the platform
expects to work.

The webhook is the one unauthenticated route in the app. Telegram has no bearer
token to present, so the secret it echoes in `X-Telegram-Bot-Api-Secret-Token`
is the entire door — compared in constant time, and with the secret unset the
route refuses everyone rather than trusting its caller. Every answer is 200:
Telegram retries a non-2xx with backoff and eventually drops the webhook, and
none of the failures here are ones a retry fixes.

**Web push** goes next, to every browser the user has subscribed — `POST
/api/push/subscribe` per device, keyed on the endpoint, with a 404 or 410 from
the push service meaning the subscription is gone and the row is deleted. The
service worker also messages any open page when a push lands, so the bell's
badge updates without waiting for the app to be resumed.

**Email** last. An email about a habit tracker is read hours later if at all, but
a user with neither of the other two would otherwise hear nothing, so it stays as
the fallback rather than being replaced.

A chat Telegram reports as gone — 403 for a blocked bot, 400 for a chat that no
longer exists — is unlinked on the spot, the same way a dead push subscription is
deleted. A 429 or a 5xx is Telegram having a bad day and the chat is kept.

The window is one-sided — the reminder time has to have passed — and wider than
the cron period so a late run still delivers. It used to be plus-or-minus 30
minutes, which is 61 minutes wide: against a 30-minute cron a 09:00 reminder
matched the 08:30, 09:00 and 09:30 runs, so everyone who had not completed a
quest got three identical emails a day, the first of them half an hour before
the time it announced.

Note that Resend reports API failures in its result rather than by throwing, so
the result is inspected: without that a rejected API key counted every address
as sent and the run logged a clean summary while delivering nothing. It needs `DATABASE_URL`, `RESEND_API_KEY`
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
| `POST /api/auth/guest` | Throwaway account; 404 unless enabled |
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

- **Pro buys two features, not a tier.** Voice capture and photo calories are
  the only things the gate refuses; the tracker, streaks, freezes and reminders
  are free and are meant to stay that way. The Pro screen says so rather than
  listing a wall of features that do not exist.
- **Subscriptions do not renew.** A Stars payment buys a fixed period and the
  account lapses at the end of it. Telegram supports recurring Stars
  subscriptions; this uses one-off invoices, so a user who wants another month
  pays for another month.
- **Refunds are manual.** The charge id is stored against every payment, which
  is what `refundStarPayment` needs, but nothing in the app calls it.
- **Tabs stay mounted once visited**, so a page that loads on mount alone never
  loads again. History and Profile key their load on the route and read past
  the cache's 30-second TTL, which is why arriving from the tracker shows what
  was just done there. A forced read first settles any queued or
  in-flight save, otherwise it would read the row back before the write landed
  and cache that — the edit would appear to undo itself.
- **Last-write-wins across devices, for the fields the client still owns.**
  Quests, journal entries, meals, calories and mood are still sent as a
  debounced snapshot, so two open tabs can overwrite each other there. Progress
  no longer works that way — see **Progress** above.
- **`meal_history` and `journal_entries` are unbounded arrays** rewritten
  wholesale on every save. Fine at current scale; normalise into their own
  tables when they get long.
- **The Statistics page needs three check-ins** before it shows charts; below
  that it explains what to do instead of drawing an empty axis.
- **Push needs a VAPID pair to do anything.** Without `VAPID_PUBLIC_KEY` and
  `VAPID_PRIVATE_KEY` on both services the endpoints answer "not enabled", the
  Profile switch says so, and reminders fall back to email. The in-app log works
  either way — see **Notifications** below.
