import React, { useState, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import useUnread from '@/lib/useUnread';
import AppMenu from '@/components/AppMenu';

const NotificationCenter = React.lazy(() => import('@/components/daily/NotificationCenter.jsx'));

/**
 * The header's right-hand side, the same on every tab: the bell, then the menu.
 *
 * The bell is on its own because it carries a live count — a reminder that
 * arrives while someone is reading their history should be visible there, not
 * one tap away. Everything else that belongs to the app rather than to a page
 * (theme, language, sound, the version) is in the menu: settings changed
 * rarely, which a button each on every screen was too much width for.
 */
export default function TopControls({ theme, className = '' }) {
  const i = t();
  const light = theme === 'light';
  const { unread, setUnread } = useUnread();
  const [showInbox, setShowInbox] = useState(false);

  // 48px, the same on every tab. The icon size is set on the button because
  // the shared Button forces `size-4` onto any svg inside it.
  const round = `h-12 w-12 shrink-0 rounded-full [&_svg]:size-6 ${
    light ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'
  }`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        onClick={() => setShowInbox(true)}
        variant="ghost"
        size="icon"
        aria-label={`${i.inbox?.title || 'Notifications'}${unread > 0 ? ` (${unread})` : ''}`}
        className={`relative ${round}`}
      >
        <Bell className="w-5 h-5" />
        {/* A count up to nine and a plus after that — the exact number past
            that point is not information anyone acts on. */}
        {unread > 0 && (
          <span
            className="absolute top-0 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      <AppMenu theme={theme} />

      {/* Kept mounted through its exit, so closing fades instead of vanishing. */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showInbox && (
            <NotificationCenter
              key="inbox"
              onClose={() => setShowInbox(false)}
              onUnreadChange={setUnread}
              theme={theme}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
