import { z } from 'zod';

/**
 * Variables every process needs. The API and the reminders cron are separate
 * Railway services with different secrets, so the rest is split into
 * env.api.ts and env.job.ts — importing this file must not demand a secret the
 * importing service was never given.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
