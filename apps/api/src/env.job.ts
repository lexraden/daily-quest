import { z } from 'zod';
import { parseEnv } from './env.js';

/**
 * Variables only the reminders cron service needs. It runs with DATABASE_URL
 * and these — none of the API's signing secrets or the OpenAI key.
 */
const schema = z.object({
  RESEND_API_KEY: z.string().min(1),
  REMINDER_FROM: z.string().default('DailyQ <noreply@dailyq.app>'),
  // Used for the "open the app" link in reminder emails.
  APP_ORIGIN: z.string().url(),

  // The same pair the API hands to browsers when they subscribe. Without them
  // the job falls back to email alone.
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:noreply@dailyq.app'),
});

export const jobEnv = parseEnv(schema, 'reminders');
