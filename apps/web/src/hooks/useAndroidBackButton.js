import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const TAB_PATHS = ['/', '/DailyTracker', '/History', '/Profile'];
const GUARD_KEY = '__back_guard';

/**
 * Android hardware back button handler.
 * Prevents the app from closing when on a tab page by maintaining
 * a guard history entry. Uses a cooldown to avoid re-pushing the guard
 * during programmatic tab switches (which fire popstate events).
 */
export default function useAndroidBackButton() {
  const location = useLocation();
  const isTabPage = TAB_PATHS.includes(location.pathname);
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (!isTabPage) return;

    // Always ensure a guard entry exists when landing on a tab page.
    // Use a microtask to avoid interfering with React Router's own
    // history manipulations during the same tick.
    const timer = setTimeout(() => {
      if (!window.history.state?.[GUARD_KEY]) {
        window.history.pushState({ [GUARD_KEY]: true }, '');
      }
    }, 0);

    const handlePopState = () => {
      // Skip if we're in a cooldown (programmatic navigation between tabs)
      if (cooldownRef.current) return;

      // The guard was consumed — re-push it to prevent app close
      if (!window.history.state?.[GUARD_KEY]) {
        window.history.pushState({ [GUARD_KEY]: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isTabPage]);

  // Brief cooldown on every pathname change so we don't re-push guard
  // when React Router navigates between tabs (which fires popstate).
  useEffect(() => {
    cooldownRef.current = true;
    const id = setTimeout(() => { cooldownRef.current = false; }, 100);
    return () => clearTimeout(id);
  }, [location.pathname]);
}