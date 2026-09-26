import { useEffect } from 'react';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';
import { checkForUpdate, applyUpdate } from '@/lib/appVersion';

/** Not more often than this, however many times the app is brought back. */
const MIN_GAP_MS = 5 * 60 * 1000;
/** And this often while it stays open. */
const INTERVAL_MS = 30 * 60 * 1000;

/**
 * Notices a new deploy by itself and offers it.
 *
 * An installed app is resumed, not reloaded, so it went on running the old
 * build after a deploy until someone closed it for good or found the button
 * in the menu. This asks on start, whenever the app comes back to the
 * foreground, and every half hour, and when the server is on a different
 * build it says so with an Update button.
 *
 * It offers rather than reloads: a reload in the middle of typing to the
 * coach, or of onboarding, would throw that away.
 */
export default function useUpdateWatcher() {
  useEffect(() => {
    let lastCheck = 0;
    let offered = null;

    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastCheck < MIN_GAP_MS) return;
      lastCheck = now;

      const { status, commit } = await checkForUpdate();
      if (status !== 'update' || !commit || commit === offered) return;
      offered = commit;

      const copy = t().update || {};
      toast(copy.available || 'Update available', {
        id: 'app-update',
        description: copy.availableHint || 'A new version of the app is ready.',
        duration: Infinity,
        action: { label: copy.reload || 'Update', onClick: () => applyUpdate() },
      });
    };

    check();
    const onVisible = () => check();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);
}
