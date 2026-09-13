import webpush from 'web-push';
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

export function configurePush(config: PushConfig | null): void {
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
export async function notifyUser(userId: string, notification: Notification): Promise<number> {
  if (!configured) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const payload = JSON.stringify(notification);
  const gone: string[] = [];
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
        if (status === 404 || status === 410) gone.push(sub.id);
        // Anything else — a timeout, a 5xx from the push service — is left
        // alone: the subscription is probably fine and tomorrow will retry.
      }
    }),
  );

  if (gone.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  }

  return delivered;
}
