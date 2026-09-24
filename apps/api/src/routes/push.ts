import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest } from '../lib/errors.js';
import { publicKey, pushEnabled, sendToUser } from '../lib/push.js';

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
  // Only the test send is limited; `global: false` keeps the limiter off the
  // rest of this plugin.
  await app.register(import('@fastify/rate-limit'), { global: false });

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
   * Sends one notification to whoever asks, right now.
   *
   * "It did not arrive" has too many possible causes to guess between from the
   * outside: the permission was never granted, the subscription was recorded
   * against another browser, VAPID never reached the service doing the sending,
   * the phone suppressed it, or the reminder simply was not due. This collapses
   * all of that into one tap with an answer, and the answer distinguishes the
   * two cases that look identical from the app: nothing subscribed, versus
   * subscribed and the push service refused it.
   *
   * Rate limited because it is a send button, and generously: the point is to
   * stop someone using us to hammer a push service, not to ration checking.
   * Five a minute was the first attempt and it was too mean — the test suite
   * tripped it on a second run inside a minute, which is exactly what a person
   * fiddling with notification settings does too.
   */
  app.post(
    '/test',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request) => {
      if (!pushEnabled()) {
        throw badRequest('Push is not configured on the server', 'push_disabled');
      }

      const outcome = await sendToUser(currentUserId(request), {
        title: 'DailyQ',
        body: 'Test notification — push is working on this device.',
        url: '/',
        // Its own tag, so testing never replaces a real reminder sitting in the
        // shade, and a second test replaces the first.
        tag: 'dailyq-test',
      });

      /**
       * The status codes go back to the caller, not just the log.
       *
       * They are the difference between two answers that need opposite things
       * done: 401 or 403 is the server's VAPID details being wrong, which no
       * amount of resubscribing will fix, while anything else against a live
       * subscription usually is stale registration. Nothing here is secret —
       * it is the push service's opinion of our own request.
       */
      return {
        devices: outcome.devices,
        delivered: outcome.delivered,
        expired: outcome.expired,
        statuses: outcome.failures.map((f) => f.status),
      };
    },
  );

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
