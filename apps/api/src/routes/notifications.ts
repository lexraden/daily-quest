import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { MAX_PER_USER, toWire, langFor } from '../lib/notifications.js';
import { pushProblem } from '../lib/push.js';
import { telegramEnabled } from '../lib/telegram.js';
import { emailEnabled, sendEmail } from '../lib/email.js';
import { GUEST_PREFIX } from './auth.js';

const readBody = z.object({ id: z.string().min(1).max(64).optional() }).strict();

/** The test email. Short, and says which service sent it, since that is the question. */
const TEST_EMAIL = {
  ru: {
    subject: 'DailyQ: тестовое письмо',
    html: '<h2>Почта работает ✓</h2><p>Это тестовое письмо из профиля DailyQ. Если напоминание не придёт ни в Telegram, ни push-уведомлением, оно придёт сюда.</p>',
  },
  en: {
    subject: 'DailyQ: test email',
    html: '<h2>Email works ✓</h2><p>This is a test from your DailyQ profile. When a reminder cannot reach you by Telegram or push, it arrives here.</p>',
  },
} as const;

/**
 * Where the account's email would go, or null when it has nowhere real.
 *
 * Guests are minted with an `@guest.invalid` address so the unique column is
 * satisfied, and `.invalid` is reserved never to resolve: sending there is a
 * bounce, and bounces are what cost a sender domain its reputation.
 */
async function emailAddressFor(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, googleSub: true },
  });
  if (!user) throw unauthorized();
  return user.googleSub.startsWith(GUEST_PREFIX) ? null : user.email;
}

export default async function notificationRoutes(app: FastifyInstance) {
  // Only the test email is limited; `global: false` keeps the limiter off the
  // log endpoints, which the app reads on every load.
  await app.register(import('@fastify/rate-limit'), { global: false });

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

  /**
   * Which delivery channels can reach this user, and why not where one cannot.
   *
   * "Did not arrive" has a different fix on every channel, and from the app
   * they all look the same — so each one reports two things separately:
   * whether this service is configured for it at all (a job for whoever runs
   * the server), and whether it works for this account (a job for the user).
   * `reason` names the first thing standing in the way, so the profile can say
   * exactly what to do instead of showing a bare "off".
   *
   * This is what the API process was given. The reminders job is a separate
   * service with its own copy of every key, which this cannot see — so a
   * channel that works here and never delivers usually means the variable was
   * set on one service and not the other. The runbook in the README says which
   * goes where.
   */
  app.get('/channels', async (request) => {
    const userId = currentUserId(request);

    const [devices, link, address] = await Promise.all([
      prisma.pushSubscription.count({ where: { userId } }),
      prisma.telegramLink.findUnique({
        where: { userId },
        select: { chatId: true, username: true },
      }),
      emailAddressFor(userId),
    ]);

    const problem = pushProblem();
    const push = {
      configured: problem === null,
      works: problem === null && devices > 0,
      reason:
        problem === 'keys_mismatch'
          ? 'keys_mismatch'
          : problem
            ? 'not_configured'
            : devices === 0
              ? 'no_devices'
              : null,
      devices,
    };

    const telegramOn = telegramEnabled();
    const connected = Boolean(link?.chatId);
    const telegram = {
      configured: telegramOn,
      works: telegramOn && connected,
      reason: !telegramOn ? 'not_configured' : !connected ? 'not_linked' : null,
      connected,
      username: connected ? (link?.username ?? null) : null,
    };

    const emailOn = emailEnabled();
    const email = {
      configured: emailOn,
      works: emailOn && address !== null,
      reason: !emailOn ? 'not_configured' : address === null ? 'no_address' : null,
      address,
    };

    return {
      push,
      telegram,
      email,
      /**
       * Which one tonight's reminder would take, in the job's own order — one
       * channel, not all three, so this is the one worth testing. Null means
       * the in-app log is all that is left.
       */
      reminders_via: telegram.works
        ? 'telegram'
        : push.works
          ? 'push'
          : email.works
            ? 'email'
            : null,
    };
  });

  /**
   * Sends one email to the account's own address, right now.
   *
   * Email is the channel least likely to be checked and most likely to be
   * quietly broken — an unverified sender domain, a revoked key — and until
   * this existed the first sign was a reminder that never came. The address is
   * the one on the account and nothing else: taking one from the body would
   * make this a way to send mail as us to anyone.
   *
   * Rate limited because every send spends quota and a little of the sender
   * domain's reputation. Ten a minute, not five: a person checking settings
   * taps more than once, and the test suite runs twice back to back — push's
   * test send was first limited too tightly and tripped on exactly that.
   */
  app.post(
    '/email/test',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      if (!emailEnabled()) {
        throw badRequest('Email is not configured on this service', 'email_disabled');
      }

      const userId = currentUserId(request);
      const to = await emailAddressFor(userId);
      if (!to) return { sent: false, reason: 'no_address', to: null };

      const copy = TEST_EMAIL[await langFor(userId)];
      const outcome = await sendEmail({ to, subject: copy.subject, html: copy.html });

      if (outcome.sent) return { sent: true, reason: null, to };
      /**
       * Resend's own message goes back with the reason. It is its opinion of
       * our request — "the dailyq.app domain is not verified" — which is
       * exactly what whoever fixes it needs, and holds nothing secret.
       */
      return {
        sent: false,
        reason: outcome.reason,
        to,
        detail: 'detail' in outcome ? outcome.detail : null,
      };
    },
  );

  /** Empties the log. The user's own history, so theirs to clear. */
  app.delete('/', async (request) => {
    const userId = currentUserId(request);
    const { count } = await prisma.notification.deleteMany({ where: { userId } });
    return { deleted: count };
  });
}
