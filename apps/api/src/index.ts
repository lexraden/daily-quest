import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { isProd } from './env.js';
import { apiEnv, corsOrigins } from './env.api.js';
import { prisma } from './db.js';
import { HttpError } from './lib/errors.js';
import { ensureUploadDir } from './lib/storage.js';
import authRoutes from './routes/auth.js';
import questDataRoutes from './routes/questData.js';
import aiRoutes from './routes/ai.js';
import fileRoutes from './routes/files.js';

const app = Fastify({
  logger: {
    level: isProd ? 'info' : 'debug',
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  },
  trustProxy: true,
  bodyLimit: 2 * 1024 * 1024, // quest_data snapshots are the largest JSON body
});

await app.register(import('@fastify/cookie'));
await app.register(import('@fastify/multipart'), {
  limits: { fileSize: apiEnv.MAX_UPLOAD_BYTES, files: 1 },
});

// Production serves the SPA from this same origin, so no CORS is needed there.
// CORS_ORIGINS exists for local dev, where Vite runs on another port.
if (corsOrigins.length > 0) {
  await app.register(import('@fastify/cors'), {
    origin: corsOrigins,
    credentials: true,
  });
}

app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProd) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

app.setErrorHandler((error: unknown, request, reply) => {
  if (error instanceof HttpError) {
    return reply
      .code(error.statusCode)
      .send({ error: error.message, code: error.code });
  }

  // Fastify's own errors (body too large, malformed JSON, rate limit) already
  // carry a usable status and message.
  const fastifyError = error as { statusCode?: number; message?: string; code?: string };
  const status = fastifyError.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return reply
      .code(status)
      .send({ error: fastifyError.message ?? 'Bad request', code: fastifyError.code });
  }

  request.log.error({ err: error }, 'unhandled error');
  return reply.code(500).send({ error: 'Something went wrong', code: 'internal' });
});

app.get('/api/health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return {
    ok: true,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',
    time: new Date().toISOString(),
  };
});

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(questDataRoutes, { prefix: '/api/quest-data' });
await app.register(aiRoutes, { prefix: '/api/ai' });
await app.register(fileRoutes, { prefix: '/api/files' });

// Serve the built SPA. Absent in local API-only dev, where Vite serves it.
const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, '../../web/dist');

if (existsSync(webDist)) {
  await app.register(import('@fastify/static'), { root: webDist, wildcard: false });

  // Client-side routing: anything that isn't an API call or a real file is the
  // app shell. An unmatched /api/* path must still 404 as JSON.
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found', code: 'not_found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn({ webDist }, 'no web build found — serving API only');
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await ensureUploadDir();
await app.listen({ port: apiEnv.PORT, host: apiEnv.HOST });
