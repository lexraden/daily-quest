import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Flame, Trophy, Snowflake, HeartCrack, Clock } from 'lucide-react';
import { api } from '@/api/client';
import { t } from '@/lib/i18n';

/**
 * Everything the app has tried to tell this user, in one list.
 *
 * Push is the only channel that reaches a closed app, and it is also the one
 * most likely to have failed silently — permission never granted, phone off,
 * subscription dropped when the browser cleared site data. So the server writes
 * every notification to a log as well, and this is that log. Nothing here is
 * generated in the browser: the text is what was sent, in the language it was
 * sent in.
 *
 * Opening it marks everything read, which is what the badge means — "there is
 * something you have not seen" — rather than making the user tap each line.
 */

/** One icon per kind, so the list is scannable without reading it. */
const ICONS = {
  reminder: Clock,
  streak_warning: Flame,
  streak_milestone: Flame,
  level_up: Trophy,
  freeze_used: Snowflake,
  streak_lost: HeartCrack,
};

const TINTS = {
  reminder: 'text-blue-400',
  streak_warning: 'text-orange-500',
  streak_milestone: 'text-orange-500',
  level_up: 'text-purple-400',
  freeze_used: 'text-cyan-400',
  streak_lost: 'text-gray-500',
};

/**
 * "2 h", "yesterday", "12 Sep" — relative while it is still recent, absolute
 * once "14 days ago" stops being a useful way to say when.
 */
function whenLabel(iso, copy) {
  const then = new Date(iso);
  const minutes = Math.floor((Date.now() - then.getTime()) / 60000);

  if (minutes < 1) return copy.now || 'now';
  if (minutes < 60) return (copy.minutesAgo || '{n} min').replace('{n}', minutes);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return (copy.hoursAgo || '{n} h').replace('{n}', hours);

  const days = Math.floor(hours / 24);
  if (days === 1) return copy.yesterday || 'yesterday';
  if (days < 7) return (copy.daysAgo || '{n} d').replace('{n}', days);

  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function NotificationCenter({ onClose, onUnreadChange, theme = 'dark' }) {
  const i = t();
  const copy = i.inbox || {};
  const light = theme === 'light';

  const [items, setItems] = useState(null); // null while loading
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { notifications } = await api.notifications.list();
        if (!alive) return;
        setItems(notifications || []);

        /**
         * Read on open, not on tap. The badge answers "is there anything new",
         * and opening the list is the answer; marking each line individually
         * would be work the user gets nothing for. The unread state the list
         * renders is the one from before this call, so an entry that arrived
         * while the app was closed is still visibly new this once.
         */
        if ((notifications || []).some((n) => !n.read)) {
          const { unread } = await api.notifications.read();
          if (alive) onUnreadChange?.(unread);
        }
      } catch {
        // An unreachable log is an empty list, not an error screen — there is
        // nothing here the user needs to act on.
        if (alive) setItems([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [onUnreadChange]);

  const clear = async () => {
    setClearing(true);
    try {
      await api.notifications.clear();
      setItems([]);
      onUnreadChange?.(0);
    } catch {
      // Leave the list as it is; the button can be tried again.
    } finally {
      setClearing(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title || 'Notifications'}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          /* A fixed fraction of the viewport rather than a fixed height: the
             list has to fit a phone in landscape as well as a tall one. */
          className={`relative flex max-h-[78vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border ${
            light ? 'bg-white border-gray-200 shadow-2xl' : 'bg-[#1b2433] border-white/10'
          }`}
        >
          <div
            className={`flex shrink-0 items-center gap-2.5 border-b px-5 py-4 ${
              light ? 'border-gray-100' : 'border-white/10'
            }`}
          >
            <Bell className={`h-5 w-5 ${light ? 'text-purple-600' : 'text-purple-400'}`} />
            <h2 className={`flex-1 text-base font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
              {copy.title || 'Notifications'}
            </h2>
            <button
              onClick={onClose}
              aria-label={i.common?.close || 'Close'}
              className={`-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center ${
                light ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {items === null ? (
              <div className="px-5 py-10 text-center text-sm text-gray-500">{copy.loading || '…'}</div>
            ) : items.length === 0 ? (
              <div className="px-8 py-12 text-center">
                <Bell className={`mx-auto h-9 w-9 ${light ? 'text-gray-300' : 'text-gray-600'}`} />
                <p className={`mt-3 text-sm font-semibold ${light ? 'text-gray-700' : 'text-gray-300'}`}>
                  {copy.emptyTitle || 'Nothing yet'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {copy.emptyHint || 'Reminders and milestones will show up here.'}
                </p>
              </div>
            ) : (
              <ul>
                {items.map((item) => {
                  const Icon = ICONS[item.kind] || Bell;
                  return (
                    <li
                      key={item.id}
                      className={`flex gap-3 px-5 py-3.5 border-b last:border-b-0 ${
                        light ? 'border-gray-100' : 'border-white/[0.06]'
                      } ${item.read ? '' : light ? 'bg-purple-50/60' : 'bg-purple-500/[0.07]'}`}
                    >
                      <Icon
                        className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${TINTS[item.kind] || 'text-gray-400'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`min-w-0 flex-1 text-sm font-semibold ${
                              light ? 'text-gray-900' : 'text-white'
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-gray-500">
                            {whenLabel(item.created_at, copy)}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs leading-relaxed ${light ? 'text-gray-600' : 'text-gray-400'}`}>
                          {item.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {items !== null && items.length > 0 && (
            <div className={`shrink-0 border-t px-5 py-3 ${light ? 'border-gray-100' : 'border-white/10'}`}>
              <button
                onClick={clear}
                disabled={clearing}
                className={`w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 ${
                  light ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                {copy.clear || 'Clear all'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
