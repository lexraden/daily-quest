import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '../db.js';
import { apiEnv } from '../env.api.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest, forbidden } from '../lib/errors.js';
import { botUsername, telegramEnabled, sendToChat } from '../lib/telegram.js';
import { answerPreCheckout, applyPayment, verifyPayload } from '../lib/billing.js';
import { langFor } from '../lib/notifications.js';

/**
 * Connecting a Telegram account, and hearing back from the bot.
 *
 * The flow is the only one that works without asking a user to find their own
 * numeric chat id: the app mints a one-time code, opens
 * `t.me/<bot>?start=<code>`, and the bot's webhook turns that code into the chat
 * it arrived from. The code is the whole proof — it is short-lived, single-use,
 * and stored only as a hash.
 */

/**
 * What the bot itself says.
 *
 * Distinct from the notification copy: these are answers to a command, and the
 * bot has to answer them before it knows who it is talking to. Where the user is
 * known the reply is in their language; where they are not — an unrecognised
 * code, a bare /start — it is both, because guessing from the Telegram client's
 * locale would be a guess and a reminder bot that answers in the wrong language
 * reads as someone else's bot.
 */
const BOT_COPY = {
  ru: {
    connected: {
      title: '✅ Подключено',
      body: 'Напоминания из DailyQ будут приходить сюда. /stop — отключить.',
    },
    stopped: {
      title: 'Отключено',
      body: 'Напоминания сюда больше не придут. Включить обратно — в профиле приложения.',
    },
    paid: {
      title: '⭐️ Pro активен',
      body: 'Спасибо! Голосовой ввод и распознавание еды по фото снова доступны. Срок виден в профиле.',
    },
  },
  en: {
    connected: {
      title: '✅ Connected',
      body: 'DailyQ reminders will arrive here. /stop to turn them off.',
    },
    stopped: {
      title: 'Disconnected',
      body: 'Nothing more will arrive here. You can reconnect from your profile.',
    },
    paid: {
      title: '⭐️ Pro is active',
      body: 'Thank you! Voice capture and photo calorie tracking are available again. Your profile shows the end date.',
    },
  },
} as const;

/** Both languages, for the replies sent before the user is known. */
const BILINGUAL = {
  needsCode: {
    title: 'DailyQ',
    body:
      'Открой профиль в приложении и нажми «Подключить Telegram» — оттуда придёт ссылка, которая свяжет этот чат с аккаунтом.\n\n' +
      'Open your profile in the app and tap "Connect Telegram" — the link it gives you connects this chat to your account.',
  },
  expired: {
    title: 'Ссылка больше не действует / Link expired',
    body:
      'Она живёт 15 минут. Нажми «Подключить Telegram» в профиле ещё раз.\n\n' +
      'It lasts 15 minutes. Tap "Connect Telegram" in your profile again.',
  },
  nothingToStop: {
    title: 'Здесь ничего не подключено / Nothing connected here',
    body: 'Подключить можно в профиле приложения. / You can connect from your profile in the app.',
  },
  whatIsThis: {
    title: 'DailyQ',
    body:
      'Этот бот присылает напоминания из DailyQ. Подключается в профиле приложения. /stop — отключить.\n\n' +
      'This bot delivers DailyQ reminders. Connect it from your profile in the app. /stop to turn it off.',
  },
} as const;

/** Long enough that guessing one inside its fifteen minutes is not a strategy. */
const CODE_BYTES = 24;
const CODE_TTL_MS = 15 * 60 * 1000;

const hash = (code: string) => createHash('sha256').update(code).digest('hex');

export default async function telegramRoutes(app: FastifyInstance) {
  // Only the webhook is rate limited; the rest is behind auth. `global: false`
  // keeps the limiter off every other route in this plugin.
  await app.register(import('@fastify/rate-limit'), { global: false });

  /**
   * Whether the feature exists at all, and the bot to open. Public: the SPA
   * needs it before it can draw the button, and a bot username is public by
   * definition.
   */
  app.get('/config', async () => ({
    enabled: telegramEnabled(),
    bot_username: botUsername(),
  }));

  /** Whether this account has a chat connected. */
  app.get('/link', { preHandler: requireAuth }, async (request) => {
    const link = await prisma.telegramLink.findUnique({
      where: { userId: currentUserId(request) },
      select: { chatId: true, username: true, linkedAt: true },
    });

    return {
      enabled: telegramEnabled(),
      connected: Boolean(link?.chatId),
      username: link?.username ?? null,
      linked_at: link?.linkedAt?.toISOString() ?? null,
    };
  });

  /**
   * Mints a fresh code and returns the link to open.
   *
   * Each call replaces the previous code rather than adding one, so a user who
   * taps the button twice cannot leave a second invitation live. An already
   * connected account gets the link anyway — re-running it is how someone moves
   * the notifications to a different Telegram account.
   */
  app.post('/link', { preHandler: requireAuth }, async (request) => {
    if (!telegramEnabled()) throw badRequest('Telegram is not configured', 'telegram_disabled');

    const userId = currentUserId(request);
    const code = randomBytes(CODE_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await prisma.telegramLink.upsert({
      where: { userId },
      create: { userId, codeHash: hash(code), codeExpiresAt: expiresAt },
      update: { codeHash: hash(code), codeExpiresAt: expiresAt },
    });

    return {
      url: `https://t.me/${botUsername()}?start=${code}`,
      expires_at: expiresAt.toISOString(),
    };
  });

  /**
   * Disconnects. The row is deleted outright rather than blanked: there is
   * nothing worth keeping about a chat the user has asked to be rid of, and a
   * later reconnect makes a new one.
   */
  app.delete('/link', { preHandler: requireAuth }, async (request) => {
    const { count } = await prisma.telegramLink.deleteMany({
      where: { userId: currentUserId(request) },
    });
    return { disconnected: count > 0 };
  });

  /**
   * Telegram calling us.
   *
   * Unauthenticated by necessity — Telegram has no bearer token to present — so
   * the shared secret set at setWebhook time is the whole door. Without a secret
   * configured the route refuses everything rather than trusting its caller:
   * a webhook anyone can post to would let a stranger link their own chat to
   * someone else's account by replaying a code.
   *
   * Every answer is 200. Telegram retries a non-2xx with backoff and eventually
   * drops the webhook, and none of the failures here are ones a retry fixes.
   */
  app.post(
    '/webhook',
    {
      /**
       * The cap is per IP, and every update arrives from Telegram, so this is
       * a ceiling on the bot as a whole rather than on one caller. Sixty a
       * minute was one: a burst of traffic would have Telegram collecting 429s,
       * backing off, and eventually dropping the webhook — which now costs
       * payments, not just reminders, because a successful_payment Telegram
       * gives up on is a month someone paid for and did not get.
       *
       * Five a second still stops an unauthenticated flood dead, and the secret
       * check below is cheap enough that the ones it rejects cost nothing.
       */
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const expected = apiEnv.TELEGRAM_WEBHOOK_SECRET;
      if (!expected) {
        request.log.warn('telegram webhook called with no TELEGRAM_WEBHOOK_SECRET set');
        throw forbidden('Telegram webhook is not configured');
      }

      const presented = request.headers['x-telegram-bot-api-secret-token'];
      if (typeof presented !== 'string' || !sameSecret(presented, expected)) {
        throw forbidden('Not Telegram');
      }

      const update = updateSchema.safeParse(request.body);
      // A kind of update we do not handle — a photo, a channel post, an edit.
      // Telegram must not retry it, so this is a 200 with nothing done.
      if (!update.success) return reply.send({ ok: true });

      /**
       * Checkout approval comes first and answers fastest, because the ten
       * seconds Telegram allows are counted from here. The only thing worth
       * refusing on is a payload that does not verify — if it does, the price
       * and the account are both ours and already agreed.
       */
      const preCheckout = update.data.pre_checkout_query;
      if (preCheckout) {
        await answerPreCheckout(preCheckout.id, verifyPayload(preCheckout.invoice_payload) !== null);
        return reply.send({ ok: true });
      }

      const { message } = update.data;
      if (!message) return reply.send({ ok: true });

      const chatId = String(message.chat.id);
      const text = (message.text ?? '').trim();

      // A completed purchase. Handled before the command parsing below, which
      // would otherwise fall through to "what is this bot" on a message that
      // carries no text.
      if (message.successful_payment) {
        await handlePayment(chatId, message.successful_payment);
        return reply.send({ ok: true });
      }

      if (text === '/stop') {
        await handleStop(chatId);
        return reply.send({ ok: true });
      }

      const start = /^\/start(?:\s+(\S+))?$/.exec(text);
      if (start) {
        await handleStart(chatId, start[1], message.from?.username ?? message.chat.username ?? null);
        return reply.send({ ok: true });
      }

      // Anything else in a private chat: say what the bot is for rather than
      // going silent, which reads as broken.
      await sendToChat(chatId, BILINGUAL.whatIsThis);
      return reply.send({ ok: true });
    },
  );
}

/**
 * Constant-time comparison. The secret is fixed-length and ours, so a length
 * mismatch is answered before the compare — timingSafeEqual throws on unequal
 * lengths, and the length of a secret someone is guessing is not worth leaking
 * through an exception either.
 */
function sameSecret(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Only what this bot acts on. Telegram sends dozens of update shapes and the
 * schema failing is how they get ignored, so nothing here is optional that
 * matters.
 */
const successfulPaymentSchema = z.object({
  currency: z.string(),
  total_amount: z.number(),
  invoice_payload: z.string(),
  telegram_payment_charge_id: z.string(),
});

const updateSchema = z.object({
  /**
   * Optional now that this is not the only kind of update handled. Everything
   * downstream checks before reading it, and an update with neither field is a
   * 200 with nothing done.
   */
  message: z
    .object({
      chat: z.object({
        id: z.number(),
        // Group chats are not refused outright — a user may well add the bot to
        // a group — but the username is only read for display.
        username: z.string().optional(),
      }),
      from: z.object({ username: z.string().optional() }).optional(),
      text: z.string().optional(),
      successful_payment: successfulPaymentSchema.optional(),
    })
    .optional(),

  /**
   * Telegram asking whether to let a payment through. It gives ten seconds and
   * treats anything else as a refusal the user sees as a failure.
   */
  pre_checkout_query: z
    .object({
      id: z.string(),
      invoice_payload: z.string(),
    })
    .optional(),
});

/**
 * `/start <code>`: the moment the link is made.
 *
 * The code is consumed by the same statement that claims it — `updateMany`
 * filtered on the hash, the expiry, and the code still being present — so a
 * code cannot be spent twice by two messages arriving together, and an expired
 * one matches nothing.
 */
async function handleStart(
  chatId: string,
  code: string | undefined,
  username: string | null,
): Promise<void> {
  if (!code) {
    await sendToChat(chatId, BILINGUAL.needsCode);
    return;
  }

  /**
   * One chat, one account. If this chat is already linked elsewhere, that link
   * goes first — otherwise the unique constraint on chatId would reject the
   * claim below and the user would see a silent failure they cannot explain.
   */
  await prisma.telegramLink.updateMany({
    where: { chatId },
    data: { chatId: null, username: null, linkedAt: null },
  });

  const { count } = await prisma.telegramLink.updateMany({
    where: {
      codeHash: hash(code),
      codeExpiresAt: { gt: new Date() },
    },
    data: {
      chatId,
      username,
      linkedAt: new Date(),
      // Spent. A second /start with the same code now matches nothing.
      codeHash: null,
      codeExpiresAt: null,
    },
  });

  if (count === 0) {
    await sendToChat(chatId, BILINGUAL.expired);
    return;
  }

  // Linked, so there is now an account to ask which language to speak.
  const link = await prisma.telegramLink.findUnique({
    where: { chatId },
    select: { userId: true },
  });
  const lang = link ? await langFor(link.userId) : 'ru';
  await sendToChat(chatId, BOT_COPY[lang].connected);
}

/**
 * `successful_payment`: the money has moved and Telegram is telling us so.
 *
 * Which account it was for comes from the signed payload, not from the chat —
 * paying does not require having linked Telegram to the account, and the chat
 * this arrives in may belong to nobody we know. The signature is re-checked
 * here rather than trusted from the pre-checkout step, because the two updates
 * are separate HTTP requests and only this one is authorisation to grant
 * anything.
 *
 * The confirmation is sent only when this call was the one that applied the
 * payment. Telegram redelivers what it did not hear a 200 for, and a user who
 * paid once should be told once.
 */
async function handlePayment(
  chatId: string,
  payment: {
    currency: string;
    total_amount: number;
    invoice_payload: string;
    telegram_payment_charge_id: string;
  },
): Promise<void> {
  const userId = verifyPayload(payment.invoice_payload);
  if (!userId) {
    // Nothing to do but say so: refusing is not an option once the money has
    // moved, and a retry will not make the payload verify.
    console.error('telegram payment with an unverifiable payload', {
      chargeId: payment.telegram_payment_charge_id,
    });
    return;
  }

  const applied = await applyPayment(userId, {
    chargeId: payment.telegram_payment_charge_id,
    amount: payment.total_amount,
    currency: payment.currency,
  });
  if (!applied) return;

  await sendToChat(chatId, BOT_COPY[await langFor(userId)].paid);
}

/** `/stop`: unlinking from Telegram's side, which the platform expects to work. */
async function handleStop(chatId: string): Promise<void> {
  // The language has to be read before the row is cleared, since the chat id is
  // the only way back to the account.
  const link = await prisma.telegramLink.findUnique({
    where: { chatId },
    select: { userId: true },
  });

  const { count } = await prisma.telegramLink.updateMany({
    where: { chatId },
    data: { chatId: null, username: null, linkedAt: null },
  });

  if (count === 0) {
    await sendToChat(chatId, BILINGUAL.nothingToStop);
    return;
  }

  const lang = link ? await langFor(link.userId) : 'ru';
  await sendToChat(chatId, BOT_COPY[lang].stopped);
}
