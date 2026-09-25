import { z } from 'zod';
import { parseEnv } from './env.js';

/** Variables only the API service needs. Imported by API modules alone. */
const schema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),

  GOOGLE_CLIENT_ID: z.string().min(1),

  // Lets anyone with the URL create a throwaway account — for testing when
  // Google sign-in is not available. Parsed explicitly rather than with
  // z.coerce.boolean(), which turns the string "false" into true.
  GUEST_LOGIN_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === '1' || v.toLowerCase() === 'true'),

  // Signs image URLs so <img> tags work without a bearer header. Rotating this
  // invalidates every previously issued photo URL, so treat it as permanent.
  FILE_SIGNING_SECRET: z.string().min(32, 'must be at least 32 characters'),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL_QUESTS: z.string().default('gpt-4o'),
  OPENAI_MODEL_MEAL: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_VISION: z.string().default('gpt-4o'),

  /**
   * Web Push signing pair. Optional: without them the app runs and simply never
   * notifies, which is better than refusing to boot over a feature that was
   * added later. Generate once with `npx web-push generate-vapid-keys` and keep
   * them — changing the pair invalidates every device already subscribed.
   */
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:noreply@dailyq.app'),

  /**
   * Telegram bot, as a third notification channel. Optional: all three empty and
   * the endpoints report it is not configured.
   *
   * The token is the bot's entire identity, so it never leaves the server — the
   * SPA is told only the username, which is public anyway. The webhook secret is
   * what Telegram presents back to us in a header; without it the webhook
   * refuses every caller, because a webhook anyone can post to would let a
   * stranger link their own chat to someone else's account.
   */
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_BOT_USERNAME: z.string().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  // Overridable only so the tests can point at a stub. Leave it unset.
  TELEGRAM_API_BASE: z.string().default(''),

  /**
   * What Pro costs, in Telegram Stars, and how long one purchase lasts.
   *
   * Configurable rather than baked in because a price is a decision that gets
   * revisited, and a redeploy is a bad way to revisit one. Changing it affects
   * only invoices minted afterwards: what someone already paid is in the
   * payments ledger.
   *
   * The default is one star — a real payment that costs nothing to make, which
   * is the only way to exercise the whole path (invoice, pre-checkout, charge,
   * grant, the bot's reply) against Telegram rather than a stub. Set a real
   * price in the environment before this is worth money.
   */
  PRO_PRICE_STARS: z.coerce.number().int().positive().default(1),
  PRO_PERIOD_DAYS: z.coerce.number().int().positive().default(30),

  UPLOAD_DIR: z.string().default('/data/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(8 * 1024 * 1024),

  // Comma-separated. Empty in production: the API serves the SPA same-origin.
  CORS_ORIGINS: z.string().default(''),

  AI_MONTHLY_CALL_LIMIT: z.coerce.number().default(500),

  // Set to 0 to let every signed-in user reach the AI endpoints regardless of
  // trial or premium status — for testing, where a three-day trial that has
  // already expired is just in the way. The monthly per-user quota still
  // applies, so this is not a blank cheque. Parsed explicitly rather than with
  // z.coerce.boolean(), which reads the string "false" as true.
  AI_GATE_ENABLED: z
    .string()
    .default('true')
    .transform((v) => !(v === '0' || v.toLowerCase() === 'false')),
});

export const apiEnv = parseEnv(schema, 'API');

export const corsOrigins = apiEnv.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
