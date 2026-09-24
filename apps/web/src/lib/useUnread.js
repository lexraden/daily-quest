import { useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client';

/**
 * The unread count behind the bell, and everything that can change it.
 *
 * Lifted out of the tracker because the bell now lives in a header shared by
 * every tab — three copies of this effect would mean three polls and three
 * answers that could disagree.
 *
 * The event is how a page tells the badge to re-check without being wired to
 * it: the tracker's pull-to-refresh dispatches it, and anything else that
 * knows the log has changed can too.
 */
export const NOTIFICATIONS_CHANGED = 'dailyq:notifications-changed';

/** Ask the badge to re-check, from anywhere. */
export const notificationsChanged = () =>
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED));

export default function useUnread(enabled = true) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { unread: count } = await api.notifications.unread();
      setUnread(count || 0);
    } catch {
      // A badge is not worth a toast. Leave the last known count alone.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    refresh();

    /**
     * A reminder can arrive while the app is closed, so the count that was
     * right at load is stale by the time someone taps the notification and
     * lands here. `visibilitychange` covers both a background tab and an
     * installed PWA being resumed.
     */
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    // A push delivered to a tab that is merely in the background: the service
    // worker says so, because visibilitychange never fires for that.
    const onWorkerMessage = (event) => {
      if (event.data?.type === 'notification-arrived') refresh();
    };
    navigator.serviceWorker?.addEventListener?.('message', onWorkerMessage);

    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener?.('message', onWorkerMessage);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [enabled, refresh]);

  return { unread, setUnread, refresh };
}
