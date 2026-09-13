import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest } from '../lib/errors.js';
import { publicKey, pushEnabled } from '../lib/push.js';

/**
 * What a browser hands back from pushManager.subscribe(). The endpoint is a URL
 * at the browser vendor's push service; the keys are what the payload is
 * encrypted to, so only that browser can read it.
 */
const subscribeBody = z
  .object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(256),
    }),
  })
  .strict();

export default async function pushRoutes(app: FastifyInstance) {
  /**
   * The public half of the VAPID pair, which the browser needs before it can
   * subscribe. Public by design — it ships in every subscription request — but
   * behind auth anyway, since only signed-in users have anything to subscribe
   * for.
   */
  app.get('/key', { preHandler: requireAuth }, async () => ({
    enabled: pushEnabled(),
    public_key: publicKey(),
  }));

  /**
   * Records this browser's permission.
   *
   * Keyed on the endpoint rather than the user: the same device re-subscribing
   * updates its row instead of accumulating duplicates, and an endpoint that
   * somehow arrives under a second account moves rather than being rejected —
   * it is the browser's identity, and the browser has just told us whose it is.
   */
  app.post('/subscribe', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = subscribeBody.safeParse(request.body);
    if (!parsed.success) throw badRequest('That is not a push subscription');

    const userId = currentUserId(request);
    const { endpoint, keys } = parsed.data;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, lastSeenAt: new Date() },
    });

    reply.code(201);
    return { ok: true };
  });

  /**
   * Forgets one browser. Deleting by endpoint AND user so a caller cannot
   * unsubscribe someone else's device by guessing an endpoint.
   */
  app.delete('/subscribe', { preHandler: requireAuth }, async (request) => {
    const parsed = z
      .object({ endpoint: z.string().url().max(2048) })
      .strict()
      .safeParse(request.body);
    if (!parsed.success) throw badRequest('Which subscription?');

    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: currentUserId(request) },
    });
    return { ok: true };
  });
}
