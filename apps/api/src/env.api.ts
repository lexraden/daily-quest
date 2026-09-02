import { z } from 'zod';
import { parseEnv } from './env.js';

/** Variables only the API service needs. Imported by API modules alone. */
const schema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),

  GOOGLE_CLIENT_ID: z.string().min(1),

  // Signs image URLs so <img> tags work without a bearer header. Rotating this
  // invalidates every previously issued photo URL, so treat it as permanent.
  FILE_SIGNING_SECRET: z.string().min(32, 'must be at least 32 characters'),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL_QUESTS: z.string().default('gpt-4o'),
  OPENAI_MODEL_MEAL: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_VISION: z.string().default('gpt-4o'),

  UPLOAD_DIR: z.string().default('/data/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(8 * 1024 * 1024),

  // Comma-separated. Empty in production: the API serves the SPA same-origin.
  CORS_ORIGINS: z.string().default(''),

  AI_MONTHLY_CALL_LIMIT: z.coerce.number().default(500),
});

export const apiEnv = parseEnv(schema, 'API');

export const corsOrigins = apiEnv.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
