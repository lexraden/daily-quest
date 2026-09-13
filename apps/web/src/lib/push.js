import { api } from '@/api/client';

/**
 * Turning reminders into notifications the phone actually shows.
 *
 * Three things have to line up: the browser must support push at all, the user
 * must grant permission, and the service worker must be registered — the
 * subscription belongs to the worker, not the page, which is what lets a
 * reminder arrive while the app is closed.
 *
 * On iOS this only works once the app has been added to the home screen.
 * Safari exposes none of it in a normal tab, so `supported()` is false there
 * and the UI says so rather than showing a button that cannot work.
 */

export function supported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** 'granted', 'denied', 'default', or 'unsupported'. */
export function permission() {
  if (!supported()) return 'unsupported';
  return Notification.permission;
}

/**
 * The VAPID public key arrives base64url-encoded and the browser wants bytes.
 */
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * Asks, subscribes, and tells the server.
 *
 * Returns the reason it could not, rather than throwing, because every failure
 * here is something the user needs explaining: a permission they denied, a
 * browser that cannot, a server with no keys configured.
 */
export async function enablePush() {
  if (!supported()) return { ok: false, reason: 'unsupported' };

  const { enabled, public_key: key } = await api.push.key();
  if (!enabled || !key) return { ok: false, reason: 'server_disabled' };

  // Asking is a one-time decision the browser remembers. A denial cannot be
  // re-prompted from script — only the user can undo it in site settings.
  const granted = await Notification.requestPermission();
  if (granted !== 'granted') return { ok: false, reason: granted === 'denied' ? 'denied' : 'dismissed' };

  const registration = await navigator.serviceWorker.ready;

  // An existing subscription is reused unless it was made for a different
  // VAPID key, in which case subscribing again would throw and the old one has
  // to go first.
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const current = subscription.options?.applicationServerKey;
    const wanted = urlBase64ToUint8Array(key);
    const sameKey =
      current && new Uint8Array(current).every((byte, index) => byte === wanted[index]);
    if (!sameKey) {
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      // Required by Chrome: a push that shows nothing to the user is not
      // allowed, which is exactly how this is used anyway.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }

  const { endpoint, keys } = subscription.toJSON();
  await api.push.subscribe({ endpoint, keys });
  return { ok: true };
}

/** Stops notifications on this device, leaving others alone. */
export async function disablePush() {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  // The server first: if unsubscribing locally succeeded and the call failed,
  // the row would linger and the push service would reject it forever.
  await api.push.unsubscribe(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}

/** Whether this browser currently holds a subscription. */
export async function isSubscribed() {
  if (!supported() || Notification.permission !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}
