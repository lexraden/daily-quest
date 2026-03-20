import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TAB_PATHS = ['/', '/DailyTracker', '/History', '/Profile'];
const GUARD_KEY = '__back_guard';

/**
 * Robust Android hardware back button handler.
 * 
 * Strategy:
 * - On tab pages: pushes a history guard entry. When user presses back,
 *   the guard is consumed and re-pushed, preventing the app from closing.
 * - On child pages: lets the browser handle popstate naturally (React Router
 *   picks it up). If somehow there's no history, navigates to fallback tab.
 */
export default function useAndroidBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const isTabPage = TAB_PATHS.includes(location.pathname);
  const guardPushedRef = useRef(false);

  useEffect(() => {
    if (!isTabPage) {
      // Child pages don't need a guard — normal back navigation works.
      // But we need a fallback in case history is empty (deep link entry).
      guardPushedRef.current = false;

      const handlePopState = () => {
        // If we somehow ended up with no more history entries,
        // navigate to fallback tab
        if (!document.referrer && window.history.length <= 2) {
          navigate('/DailyTracker', { replace: true });
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }

    // On tab pages: push guard state to catch hardware back
    if (!guardPushedRef.current) {
      window.history.pushState({ [GUARD_KEY]: true }, '');
      guardPushedRef.current = true;
    }

    const handlePopState = () => {
      // The guard was consumed. Re-push it to prevent exit.
      if (!window.history.state?.[GUARD_KEY]) {
        window.history.pushState({ [GUARD_KEY]: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isTabPage, navigate, location.pathname]);
}