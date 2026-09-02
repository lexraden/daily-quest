import { z } from 'zod';

// Fail loudly at boot rather than at the first request that needs a missing
// value. Railway injects DATABASE_URL and PORT; everything else is set by hand.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  GOOGLE_CLIENT_ID: z.string().min(1),

  // Signs image URLs so <img> tags work without a bearer header. Rotating this
  // invalidates every previously issued photo URL, so treat it as permanent.
  FILE_SIGNING_SECRET: z.string().min(32, 'FILE_SIGNING_SECRET must be at least 32 characters'),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL_QUESTS: z.string().default('gpt-4o'),
  OPENAI_MODEL_MEAL: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_VISION: z.string().default('gpt-4o'),

  UPLOAD_DIR: z.string().default('/data/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(8 * 1024 * 1024),

  APP_ORIGIN: z.string().url(),
  // Comma-separated. Empty in production: the API serves the SPA same-origin.
  CORS_ORIGINS: z.string().default(''),

  // Only the reminders job needs these; it validates them separately.
  RESEND_API_KEY: z.string().optional(),
  REMINDER_FROM: z.string().default('DailyQ <noreply@dailyq.app>'),

  AI_MONTHLY_CALL_LIMIT: z.coerce.number().default(500),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
