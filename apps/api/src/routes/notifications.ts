import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest } from '../lib/errors.js';
import { MAX_PER_USER, toWire } from '../lib/notifications.js';

const readBody = z.object({ id: z.string().min(1).max(64).optional() }).strict();

export default async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /**
   * The whole log, newest first, with the unread count alongside it.
   *
   * No pagination: the table is trimmed to MAX_PER_USER on write, so "all of
   * them" is a bounded answer and the client never needs a second request to
   * render the badge.
   */
  app.get('/', async (request) => {
    const userId = currentUserId(request);

    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_PER_USER,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { notifications: rows.map(toWire), unread };
  });

  /**
   * Just the badge number.
   *
   * Separate from the list because it is fetched on every load and after every
   * pull-to-refresh, and a count is one indexed aggregate against forty rows of
   * text the user has not asked to see yet.
   */
  app.get('/unread', async (request) => ({
    unread: await prisma.notification.count({
      where: { userId: currentUserId(request), readAt: null },
    }),
  }));

  /**
   * Marks one read, or all of them when no id is given.
   *
   * `updateMany` scoped by userId rather than `update` by id: an id from another
   * account matches nothing instead of updating someone else's row, so the
   * authorisation is in the query rather than in a check before it.
   */
  app.post('/read', async (request) => {
    const parsed = readBody.safeParse(request.body ?? {});
    if (!parsed.success) throw badRequest('Cannot mark that read — expected a notification id');
    const userId = currentUserId(request);
    const { id } = parsed.data;

    await prisma.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });

    const unread = await prisma.notification.count({ where: { userId, readAt: null } });
    return { unread };
  });

  /** Empties the log. The user's own history, so theirs to clear. */
  app.delete('/', async (request) => {
    const userId = currentUserId(request);
    const { count } = await prisma.notification.deleteMany({ where: { userId } });
    return { deleted: count };
  });
}
