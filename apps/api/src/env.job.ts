import { z } from 'zod';
import { parseEnv } from './env.js';

/**
 * Variables only the reminders cron service needs. It runs with DATABASE_URL
 * and these — none of the API's signing secrets or the OpenAI key.
 */
const schema = z.object({
  /**
   * Optional, like the other two channels.
   *
   * It used to be required, which made email's key a prerequisite for push: a
   * service with a VAPID pair and no Resend account refused to boot and sent
   * nothing at all. Email is the last fallback, so its absence should cost the
   * fallback and nothing else — and every reminder is in the in-app log either
   * way, so nothing disappears silently.
   */
  RESEND_API_KEY: z.string().default(''),
  REMINDER_FROM: z.string().default('DailyQ <noreply@dailyq.app>'),
  // Used for the "open the app" link in reminder emails.
  APP_ORIGIN: z.string().url(),

  // The same pair the API hands to browsers when they subscribe. Without them
  // the job falls back to email alone.
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
