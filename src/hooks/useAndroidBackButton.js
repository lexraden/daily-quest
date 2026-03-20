import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const TAB_PATHS = ['/', '/DailyTracker', '/History', '/Profile'];
const GUARD_KEY = '__back_guard';

/**
 * Minimal Android hardware back button handler.
 * Only prevents the app from closing when on a tab page by
 * pushing a guard history entry and re-pushing it when consumed.
 * Child pages rely on native React Router popstate handling.
 */
export default function useAndroidBackButton() {
  const location = useLocation();
  const isTabPage = TAB_PATHS.includes(location.pathname);
  const guardPushedRef = useRef(false);

  useEffect(() => {
    if (!isTabPage) {
      guardPushedRef.current = false;
      return;
    }

    if (!guardPushedRef.current) {
      window.history.pushState({ [GUARD_KEY]: true }, '');
      guardPushedRef.current = true;
    }

    const handlePopState = () => {
      if (!window.history.state?.[GUARD_KEY]) {
        window.history.pushState({ [GUARD_KEY]: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isTabPage, location.pathname]);
}