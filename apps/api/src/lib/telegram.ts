/**
 * Telegram as a notification channel, shared by the API (which links accounts)
 * and the reminders job (which sends to them).
 *
 * A bot token is all the authentication there is: whoever holds it is the bot,
 * so it lives only in environment variables and never reaches the browser. The
 * browser is told the bot's username and nothing else.
 *
 * Optional throughout, like push. Without a token the endpoints report that it
 * is not configured and the job skips the channel, rather than the app refusing
 * to boot over a feature added after it was already running.
 */

import { prisma } from '../db.js';

export interface TelegramConfig {
  token: string;
  /** Without the @. Only needed to build the t.me link the user taps. */
  username: string;
  /**
   * Where the Bot API lives. Overridable so the tests can point a running API
   * at a local stub and assert on what the bot actually replied, instead of
   * either mocking nothing and reaching Telegram or asserting only on database
   * rows. Defaults to the real thing.
   */
  apiBase?: string;
}

const DEFAULT_API_BASE = 'https://api.telegram.org';

let configured: TelegramConfig | null = null;
let apiBase = DEFAULT_API_BASE;

export function configureTelegram(config: TelegramConfig | null): void {
  configured = config && config.token && config.username ? config : null;
  apiBase = config?.apiBase?.replace(/\/$/, '') || DEFAULT_API_BASE;
}

export const telegramEnabled = (): boolean => configured !== null;

export const botUsername = (): string | null => configured?.username ?? null;

/**
 * What Telegram says went wrong, as far as this code cares.
 *
 * `gone` is the important one: a user who blocks the bot or deletes the chat
 * produces a 403, and a chat id that no longer exists a 400 — both permanent,
 * both meaning the row should go rather than be retried every evening.
 */
export type SendOutcome = 'sent' | 'gone' | 'failed';

export interface SendResult {
  ok: boolean;
  status: number;
  description?: string;
  /**
   * Whatever the method returned. Most of them return `true` and nothing here
   * reads it, but createInvoiceLink returns the link itself, which is the
   * entire point of calling it.
   */
  result?: unknown;
}

export type Sender = (token: string, method: string, payload: unknown) => Promise<SendResult>;

const liveSender: Sender = async (token, method, payload) => {
  const res = await fetch(`${apiBase}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // A cron job must not hang on a slow API for the rest of the run.
    signal: AbortSignal.timeout(10_000),
  });

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: unknown;
  };
  return {
    ok: res.ok && body.ok === true,
    status: res.status,
    description: body.description,
    result: body.result,
  };
};

let sender: Sender = liveSender;

/** Swaps the transport. Pass nothing to put the real one back. */
export function setSender(next: Sender | null): void {
  sender = next ?? liveSender;
}

/**
 * Telegram renders a small subset of HTML, and rejects the whole message if the
 * markup does not parse. The copy is written by us but interpolates a user's
 * own name and quest titles, so anything that looks like a tag has to be
 * neutralised — otherwise a quest called "<b>gym" silently costs someone their
 * reminder.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Any Bot API method, for callers that need its return value rather than
 * whether a chat received something. Returns `result` on success and null on
 * anything else, so a caller cannot mistake a failure for a reply.
 *
 * Errors are swallowed for the same reason they are in sendToChat: Telegram
 * being unreachable is not a reason for the request that triggered this to
 * fail differently from Telegram saying no.
 */
export async function call(method: string, payload: unknown): Promise<unknown | null> {
  if (!configured) return null;

  try {
    const result = await sender(configured.token, method, payload);
    if (!result.ok) {
      console.error(`telegram ${method} failed:`, result.status, result.description);
      return null;
    }
    return result.result ?? null;
  } catch (err) {
    console.error(`telegram ${method} threw:`, err);
    return null;
  }
}

export interface Message {
  title: string;
  body: string;
  /** Absolute URL for the "open the app" button, if there should be one. */
  url?: string;
}

/** Sends one message to one chat. */
export async function sendToChat(chatId: string, message: Message): Promise<SendOutcome> {
  if (!configured) return 'failed';

  try {
    const result = await sender(configured.token, 'sendMessage', {
      chat_id: chatId,
      text: `<b>${escapeHtml(message.title)}</b>\n${escapeHtml(message.body)}`,
      parse_mode: 'HTML',
      // The preview of our own origin adds nothing and takes half the screen.
      link_preview_options: { is_disabled: true },
      ...(message.url
        ? {
            reply_markup: {
              inline_keyboard: [[{ text: 'DailyQ', url: message.url }]],
            },
          }
        : {}),
    });

    if (result.ok) return 'sent';

    /**
     * 403 is "bot was blocked by the user" or "user is deactivated"; 400 covers
     * "chat not found". Both are final. Anything else — 429, a 5xx, a timeout —
     * is Telegram having a bad day and the chat is probably fine.
     */
    if (result.status === 403 || result.status === 400) return 'gone';
    return 'failed';
  } catch {
    // Network error or the 10-second timeout above.
    return 'failed';
  }
}

/**
 * Sends to a user's linked chat, if they have one, and returns whether it
 * arrived.
 *
 * A chat Telegram calls gone is unlinked here rather than retried nightly, the
 * same way a dead push subscription is deleted. The row is kept — only the chat
 * is cleared — so the user can reconnect without anything else changing.
 */
export async function notifyUser(userId: string, message: Message): Promise<boolean> {
  if (!configured) return false;

  const link = await prisma.telegramLink.findUnique({
    where: { userId },
    select: { chatId: true },
  });
  if (!link?.chatId) return false;

  const outcome = await sendToChat(link.chatId, message);

  if (outcome === 'gone') {
    await prisma.telegramLink
      .updateMany({
        where: { userId, chatId: link.chatId },
        data: { chatId: null, username: null, linkedAt: null },
      })
      .catch(() => {
        // Failing to tidy up costs one wasted send tomorrow, not a reminder.
      });
  }

  return outcome === 'sent';
}
