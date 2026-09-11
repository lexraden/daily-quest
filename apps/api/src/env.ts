import { z } from 'zod';

/**
 * Variables every process needs. The API and the reminders cron are separate
 * Railway services with different secrets, so the rest is split into
 * env.api.ts and env.job.ts — importing this file must not demand a secret the
 * importing service was never given.
 */
/**
 * Railway injects these into every deployed container. They are the signal that
 * this is not someone's laptop.
 */
const isDeployed = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_PROJECT_ID,
);

const schema = z.object({
  /**
   * Empty counts as absent. Zod's `.default()` only fills in a missing key, so
   * `NODE_ENV=""` — which is what a blanked-out Railway variable sends — reached
   * the enum and crash-looped the service on boot.
   *
   * A deployed container with nothing set falls back to production rather than
   * development, because `isProd` gates the Secure flag on the refresh cookie:
   * guessing wrong in that direction would quietly ship session cookies without
   * it. Locally, where none of the Railway variables exist, development still
   * wins so sign-in works over plain http.
   */
  NODE_ENV: z.preprocess(
    (v) => {
      const value = typeof v === 'string' ? v.trim() : v;
      return value === '' || value === undefined
        ? isDeployed
          ? 'production'
          : 'development'
        : value;
    },
    z.enum(['development', 'production', 'test']),
  ),
  DATABASE_URL: z.string().min(1),
});

export function parseEnv<T extends z.ZodTypeAny>(shape: T, label: string): z.infer<T> {
  const parsed = shape.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`Invalid ${label} environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = parseEnv(schema, 'shared');
export const isProd = env.NODE_ENV === 'production';
