import React, { useCallback, useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { t } from '@/lib/i18n';

/**
 * Connecting a Telegram account to receive reminders.
 *
 * The connection is not made here and cannot be: the app opens a t.me link
 * carrying a one-time code, and the bot's webhook is what turns that code into
 * a chat. So this waits rather than confirms — when the user comes back from
 * Telegram the page is visible again, and that is the moment to ask the server
 * whether it worked.
 *
 * Renders nothing at all when no bot is configured. A switch that cannot do
 * anything is worse than an absent one.
 */
export default function TelegramChannel({ theme = 'light', onState }) {
  const i = t();
  const copy = i.telegram || {};
  const light = theme === 'light';

  const [state, setState] = useState(null); // null while loading
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api.telegram.link();
      setState(next);
      onState?.(next);
      return next;
    } catch {
      // Treat an unreachable API as "not available" rather than drawing a
      // control that will fail when tapped.
      const dead = { enabled: false, connected: false };
      setState(dead);
      onState?.(dead);
      return null;
    }
  }, [onState]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Coming back from Telegram. Only while a connection is pending, so the app
   * is not re-asking on every tab switch for the rest of the session.
   */
  useEffect(() => {
    if (!waiting) return;

    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const next = await refresh();
      if (next?.connected) {
        setWaiting(false);
        toast.success(copy.connected || 'Telegram connected');
      }
    };

    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [waiting, refresh, copy.connected]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api.telegram.connect();
      setWaiting(true);
      /**
       * A new tab rather than a redirect: on a phone this hands off to the
       * Telegram app and the PWA stays where it was, so coming back is the
       * app-switcher rather than a cold reload that loses the page.
       */
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(copy.failed || 'Could not start that — try again');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.telegram.disconnect();
      setWaiting(false);
      await refresh();
    } catch {
      toast.error(copy.failed || 'Could not start that — try again');
    } finally {
      setBusy(false);
    }
  };

  // Still loading, or there is no bot to connect to.
  if (!state?.enabled) return null;

  const labelClass = light ? 'text-gray-900' : 'text-white';
  const subClass = light ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <div className="flex min-w-0 items-center gap-2">
        <Send className="h-4 w-4 shrink-0 text-sky-500" />
        <div className="min-w-0">
          <span className={`text-sm ${labelClass}`}>{copy.title || 'Telegram'}</span>
          <p className={`truncate text-xs ${subClass}`}>
            {state.connected
              ? state.username
                ? `@${state.username}`
                : copy.connectedNoName || 'Connected'
              : waiting
                ? copy.waiting || 'Waiting for the bot…'
                : copy.hint || 'Reminders arrive in Telegram instead'}
          </p>
        </div>
      </div>

      <Button
        onClick={state.connected ? disconnect : connect}
        disabled={busy}
        variant={state.connected ? 'ghost' : 'default'}
        className={`h-9 shrink-0 rounded-xl px-3.5 text-xs font-semibold ${
          state.connected
            ? light
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-400 hover:bg-white/5'
            : 'bg-sky-500 text-white hover:bg-sky-600'
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state.connected ? (
          copy.disconnect || 'Disconnect'
        ) : (
          copy.connect || 'Connect'
        )}
      </Button>
    </div>
  );
}
