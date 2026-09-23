import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest } from '../lib/errors.js';
import { hasPro } from '../lib/access.js';
import { billingEnabled, createInvoiceLink, plan } from '../lib/billing.js';
import { langFor } from '../lib/notifications.js';

/**
 * What Pro costs and how to buy it.
 *
 * Only two endpoints, because Telegram runs the checkout: we hand out a link
 * and hear the result on the bot's webhook, which lives in routes/telegram.ts
 * with the rest of what Telegram sends us.
 */

/**
 * What the invoice says in Telegram. It is the last thing a user reads before
 * paying and the only part of the app they see there, so it names what they get
 * rather than the product.
 */
const INVOICE_COPY = {
  ru: {
    title: 'DailyQ Pro',
    description: (days: number) =>
      `Голосовой ввод задач и распознавание еды по фото на ${days} дней.`,
  },
  en: {
    title: 'DailyQ Pro',
    description: (days: number) =>
      `Voice quest capture and photo calorie tracking for ${days} days.`,
  },
} as const;

export default async function billingRoutes(app: FastifyInstance) {
  /**
   * The price, and whether there is anything to tap. Behind auth because the
   * account's own state is part of the answer — an account that already has Pro
   * is shown when it runs out instead of a buy button.
   */
  app.get('/plan', { preHandler: requireAuth }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId(request) },
      select: { isPremium: true, premiumUntil: true },
    });

    const { price, currency, days } = plan();

    return {
      enabled: billingEnabled(),
      provider: 'telegram_stars',
      price,
      currency,
      days,
      is_pro: user ? hasPro(user) : false,
      // Null for a comped account: it has no end to show.
      premium_until: user?.premiumUntil?.toISOString() ?? null,
      lifetime: user?.isPremium === true,
    };
  });

  /**
   * Mints an invoice link for this account.
   *
   * The link is short-lived from the user's point of view and single-purpose
   * from ours; nothing is written here, so abandoning the checkout leaves no
   * row to clean up. Which account it belongs to travels inside the signed
   * payload rather than in a table keyed on a link we cannot revoke.
   */
  app.post('/invoice', { preHandler: requireAuth }, async (request) => {
    if (!billingEnabled()) {
      throw badRequest('Payments are not configured', 'billing_disabled');
    }

    const userId = currentUserId(request);
    const copy = INVOICE_COPY[await langFor(userId)];
    const { days } = plan();

    const url = await createInvoiceLink(userId, copy.title, copy.description(days));
    if (!url) throw badRequest('Could not start the payment, try again', 'invoice_failed');

    return { url };
  });
}
