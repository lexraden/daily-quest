import { z } from 'zod';
import { parseEnv } from './env.js';

/**
 * Variables only the reminders cron service needs. It runs with DATABASE_URL
 * and these — none of the API's signing secrets or the OpenAI key.
 */
const schema = z.object({
  // Used for the "open the app" link in Telegram reminders.
  APP_ORIGIN: z.string().url(),

  // The same pair the API hands to browsers when they subscribe. Without them
  // the job skips push.
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:noreply@dailyq.app'),

  // The same bot the API links accounts to. Without it the job skips the
  // channel; the username is needed because lib/telegram treats a config with
  // either half missing as no config at all.
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_BOT_USERNAME: z.string().default(''),
  // Overridable only so a test run can point at a stub. Leave it unset.
  TELEGRAM_API_BASE: z.string().default(''),
});

export const jobEnv = parseEnv(schema, 'reminders');
