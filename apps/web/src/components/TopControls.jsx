import React, { useState, Suspense } from 'react';
import { Sun, Moon, Bell, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setTheme, getTheme } from '@/lib/theme';
import { t, getLang, setLang } from '@/lib/i18n';
import useUnread from '@/lib/useUnread';

const NotificationCenter = React.lazy(() => import('@/components/daily/NotificationCenter.jsx'));

/**
 * The three controls that belong to the app rather than to a page: what
 * happened, how it looks, and what language it is in.
 *
 * They live in one component because they now sit in the header of every tab.
 * The bell used to be the tracker's alone, which meant a reminder that arrived
 * while someone was reading their history was invisible until they navigated
 * back — and the theme toggle had the same problem in reverse, reachable only
 * from the one screen.
 *
 * Order is left to right: what happened, how it looks, what it says.
 */
export default function TopControls({ theme, className = '' }) {
  const i = t();
  const light = theme === 'light';
  const { unread, setUnread } = useUnread();
  const [showInbox, setShowInbox] = useState(false);

  const round = `h-10 w-10 shrink-0 rounded-full ${
    light ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'
  }`;

  const lang = getLang();

  /**
   * Two languages, so this is a toggle rather than a menu. A third would make
   * it a menu, and that is the moment to change it — not before.
   */
  const switchLanguage = () => {
    // setLang returns false when there is nothing to do, or when the choice
    // could not be stored and so would not survive the reload.
    if (setLang(lang === 'ru' ? 'en' : 'ru')) window.location.reload();
  };

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
            className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      <Button
        onClick={() => setTheme(getTheme() === 'light' ? 'dark' : 'light')}
        variant="ghost"
        size="icon"
        aria-label={light ? i.tracker?.darkTheme : i.tracker?.lightTheme}
        className={round}
      >
        {light ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </Button>

      <Button
        onClick={switchLanguage}
        variant="ghost"
        size="icon"
        aria-label={i.language?.switchTo?.replace('{lang}', lang === 'ru' ? 'English' : 'Русский')}
        className={`relative ${round}`}
      >
        <Languages className="w-5 h-5" />
        {/* The code, not a flag: a language is not a country, and RU/EN is
            legible at this size where a flag is a smudge. */}
        <span className="absolute -bottom-0.5 -right-0.5 rounded bg-black/60 px-1 text-[9px] font-bold leading-[13px] text-white">
          {lang.toUpperCase()}
        </span>
      </Button>

      {showInbox && (
        <Suspense fallback={null}>
          <NotificationCenter
            onClose={() => setShowInbox(false)}
            onUnreadChange={setUnread}
            theme={theme}
          />
        </Suspense>
      )}
    </div>
  );
}
