/**
 * Paying for Pro, through Telegram Stars.
 *
 * Stars is the only provider here, and it was chosen because the bot already
 * exists: Telegram is the merchant of record, so there is no merchant account,
 * no card data on our side and nothing to certify, and it works inside the iOS
 * app where a card form would not. The cost is Telegram's cut and that payouts
 * go through them.
 *
 * The flow has three moves and this module owns the first and last:
 *
 *   1. the app asks for an invoice link, which opens in Telegram;
 *   2. Telegram asks us to approve the checkout (pre_checkout_query), within
 *      ten seconds or it is cancelled;
 *   3. Telegram tells us it went through (successful_payment).
 *
 * Nothing is written until step 3. A user who opens an invoice and walks away
 * leaves no trace, which is why there is no pending-payment row to reap.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '../db.js';
import { apiEnv } from '../env.api.js';
import { call, telegramEnabled } from './telegram.js';

export const PROVIDER = 'telegram_stars';
export const CURRENCY = 'XTR';

export interface Plan {
  price: number;
  currency: string;
  days: number;
}

export const plan = (): Plan => ({
  price: apiEnv.PRO_PRICE_STARS,
  currency: CURRENCY,
  days: apiEnv.PRO_PERIOD_DAYS,
});

/** Stars payments need no provider token, and Telegram rejects a non-empty one. */
const PROVIDER_TOKEN = '';

/**
 * Who an invoice belongs to, carried through Telegram and back.
 *
 * `invoice_payload` is the only field that survives the round trip, so it has
 * to answer "which account did this buy for". It is signed rather than merely
 * written down: the string is handed to a Telegram client, and an unsigned
 * account id there would let anyone who can mint an invoice name someone else's
 * account as the beneficiary — or their own, against a payment they did not
 * make. The nonce keeps two invoices for the same user from being identical,
 * which is what makes a replayed payload distinguishable in the logs.
 *
 * Telegram caps the payload at 128 bytes, hence the truncated digest; 32 hex
 * characters is 128 bits of tag, which is far more than a scheme where forging
 * one costs a payment needs.
 */
const PAYLOAD_VERSION = 'pro1';
const TAG_CHARS = 32;

function tag(body: string): string {
  return createHmac('sha256', apiEnv.FILE_SIGNING_SECRET)
    .update(`telegram-invoice:${body}`)
    .digest('hex')
    .slice(0, TAG_CHARS);
}

export function signPayload(userId: string): string {
  const body = `${PAYLOAD_VERSION}:${userId}:${randomBytes(6).toString('hex')}`;
  return `${body}:${tag(body)}`;
}

/** The user id a payload names, or null if it does not verify. */
export function verifyPayload(payload: string): string | null {
  const parts = payload.split(':');
  if (parts.length !== 4) return null;

  const [version, userId, nonce, presented] = parts as [string, string, string, string];
  if (version !== PAYLOAD_VERSION || !userId) return null;

  const expected = tag(`${version}:${userId}:${nonce}`);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return userId;
}

export const billingEnabled = (): boolean => telegramEnabled();

/**
 * Mints the link the user taps. Telegram hosts the payment sheet; we never see
 * a card, and the link is good until it is used or the bot is stopped.
 */
export async function createInvoiceLink(
  userId: string,
  title: string,
  description: string,
): Promise<string | null> {
  const { price, days } = plan();

  const result = await call('createInvoiceLink', {
    title,
    description,
    payload: signPayload(userId),
    provider_token: PROVIDER_TOKEN,
    currency: CURRENCY,
    // Stars prices are whole stars in a single line item; Telegram rejects more
    // than one for XTR.
    prices: [{ label: `${days} days`, amount: price }],
  });

  return typeof result === 'string' ? result : null;
}

/**
 * Approve or refuse a checkout. Telegram gives us ten seconds and treats
 * silence as a refusal the user sees as a failed payment, so this answers
 * even when the payload is bad — refusing explicitly is kinder than a timeout.
 */
export async function answerPreCheckout(queryId: string, ok: boolean): Promise<void> {
  await call('answerPreCheckoutQuery', {
    pre_checkout_query_id: queryId,
    ok,
    ...(ok ? {} : { error_message: 'This invoice is no longer valid. Please start again.' }),
  });
}

export interface Charge {
  chargeId: string;
  amount: number;
  currency: string;
}

/**
 * Records a completed payment and extends the account.
 *
 * Both halves are one transaction, and the insert goes first on purpose: the
 * unique `chargeId` is what makes a redelivered webhook harmless. Telegram
 * retries anything it did not hear a 200 for, so this runs more than once for a
 * single purchase more often than one might think — and the second run has to
 * add nothing rather than a second month.
 *
 * The extension is `max(now, premium_until) + days`, so paying again halfway
 * through a month adds to the remainder instead of throwing it away, and paying
 * again long after it lapsed starts from today instead of from a date in the
 * past.
 *
 * Returns whether this call was the one that applied it.
 */
export async function applyPayment(userId: string, charge: Charge): Promise<boolean> {
  const { days } = plan();

  try {
    return await prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.createMany({
        data: [
          {
            userId,
            provider: PROVIDER,
            chargeId: charge.chargeId,
            amount: charge.amount,
            currency: charge.currency,
            days,
          },
        ],
        skipDuplicates: true,
      });

      // Already recorded: this is a redelivery, and the month it bought has
      // been granted already.
      if (count === 0) return false;

      await tx.$executeRaw`
        UPDATE users
           SET premium_until = GREATEST(COALESCE(premium_until, now()), now())
                             + make_interval(days => ${days}::int),
               updated_at = now()
         WHERE id = ${userId}`;

      return true;
    });
  } catch (err) {
    console.error(`failed to apply payment ${charge.chargeId} for ${userId}:`, err);
    return false;
  }
}
