import webpush from 'web-push';
import { createECDH } from 'node:crypto';
import { prisma } from '../db.js';

/**
 * Web Push, shared by the API (which stores subscriptions) and the reminders
 * job (which sends to them).
 *
 * VAPID is how a push service knows the message is from this app: the private
 * key signs each request, the public key is handed to the browser when it
 * subscribes, and the two must be the same pair for the life of every
 * subscription. Rotating them silently invalidates every device already
 * subscribed, so treat them as permanent once users exist.
 */
export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let configured: PushConfig | null = null;

/**
 * How a notification actually leaves the process.
 *
 * Injectable so the fan-out and the pruning below can be tested without a real
 * push service: what is worth checking here is that every device is tried, that
 * a subscription the service calls gone is deleted, and that a service merely
 * having a bad day keeps its rows — not that web-push can speak HTTP.
 */
export type Sender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) => Promise<unknown>;

const liveSender: Sender = (subscription, payload) =>
  webpush.sendNotification(subscription, payload, { TTL: 12 * 60 * 60 });

let sender: Sender = liveSender;

/** Swaps the transport. Pass nothing to put the real one back. */
export function setSender(next: Sender | null): void {
  sender = next ?? liveSender;
}

/**
 * Whether the two halves are actually one pair.
 *
 * They are only ever seen as two independent environment variables, so
 * regenerating one and pasting only that is an easy mistake and a completely
 * silent one: the browser subscribes against a public key the private key does
 * not match, every send is refused by the push service, and the only symptom is
 * notifications that never arrive.
 *
 * The public key of a P-256 pair is derived from the private one, so the check
 * is just that: derive it and compare.
 */
function pairMatches(publicKeyB64: string, privateKeyB64: string): boolean {
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(privateKeyB64, 'base64url'));
    return ecdh.getPublicKey().toString('base64url') === publicKeyB64;
  } catch {
    // A key that is not a key at all. Same conclusion.
    return false;
  }
}

export function configurePush(config: PushConfig | null): void {
  if (config && !pairMatches(config.publicKey, config.privateKey)) {
    /**
     * Refusing is kinder than accepting. Configured-but-broken reports itself
     * as working everywhere — the key endpoint hands out a key, the browser
     * subscribes happily, and only the send fails, hours later, invisibly.
     * Off says so on the profile switch and in the key endpoint immediately.
     */
    console.error(
      'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not a matching pair — push is disabled. ' +
        'Generate both together with `npx web-push generate-vapid-keys` and set both.',
    );
    configured = null;
    return;
  }

  configured = config;
  if (config) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  }
}

/** Push is optional: without keys the app runs, it just cannot notify. */
export const pushEnabled = (): boolean => configured !== null;

export const publicKey = (): string | null => configured?.publicKey ?? null;

export interface Notification {
  title: string;
  body: string;
  /** Where tapping it should land. Relative to the app's origin. */
  url?: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag?: string;
}

/**
 * Sends to every device a user has, and returns how many were reached.
 *
 * A subscription dies when the app is uninstalled, site data is cleared, or the
 * browser rotates it — the push service answers 404 or 410 and will do so
 * forever. Those rows are deleted here rather than retried nightly.
 */
export interface PushFailure {
  /** The push service's HTTP status, or 0 when the request never got one. */
  status: number;
  message: string;
}

export interface PushOutcome {
  /** How many subscriptions the user had when this ran. */
  devices: number;
  delivered: number;
  /** Subscriptions the service called gone; their rows are deleted. */
  expired: number;
  /** Everything else, kept and worth reading. */
  failures: PushFailure[];
}

/**
 * The same send, with the detail. `notifyUser` is the count-only wrapper the
 * reminders job uses; this is what the test endpoint needs, because "nothing
 * arrived" is only actionable once you know whether the service said 403 or
 * the request never reached it.
 */
export async function sendToUser(
  userId: string,
  notification: Notification,
): Promise<PushOutcome> {
  if (!configured) return { devices: 0, delivered: 0, expired: 0, failures: [] };

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { devices: 0, delivered: 0, expired: 0, failures: [] };

  const payload = JSON.stringify(notification);
  const gone: string[] = [];
  const failures: PushFailure[] = [];
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await sender(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          gone.push(sub.id);
          return;
        }

        /**
         * Everything else keeps its row — a timeout or a 5xx is the push
         * service having a bad day and tomorrow will retry — but it is logged
         * now, because it used to be swallowed completely and "the reminder
         * did not arrive" had no trace anywhere to explain why. 403 and 401 in
         * particular mean the VAPID details are wrong rather than the
         * subscription being stale, and no amount of resubscribing fixes that.
         */
        failures.push({ status: status ?? 0, message: String((error as Error)?.message ?? error) });
        console.error(
          `push to ${sub.endpoint.slice(0, 60)}… failed:`,
          status ?? '(no status)',
          (error as Error)?.message,
        );
      }
    }),
  );

  if (gone.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  }

  return { devices: subs.length, delivered, expired: gone.length, failures };
}

/** How many devices were reached. The reminders job cares about nothing else. */
export async function notifyUser(userId: string, notification: Notification): Promise<number> {
  const { delivered } = await sendToUser(userId, notification);
  return delivered;
}
