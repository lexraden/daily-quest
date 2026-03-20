import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TAB_PATHS = ['/', '/DailyTracker', '/History', '/Profile'];

/**
 * Handles Android hardware back button and Telegram WebApp back button.
 * On child pages → navigates back to previous page or fallback tab.
 * On tab pages → does nothing (prevents closing the app accidentally).
 */
export default function useAndroidBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isTabPage = TAB_PATHS.includes(location.pathname);

    // Telegram WebApp back button
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (!isTabPage) {
        tg.BackButton?.show();
        const handleTgBack = () => {
          if (window.history.length > 2) {
            navigate(-1);
          } else {
            navigate('/DailyTracker', { replace: true });
          }
        };
        tg.BackButton?.onClick(handleTgBack);
        return () => {
          tg.BackButton?.offClick(handleTgBack);
          tg.BackButton?.hide();
        };
      } else {
        tg.BackButton?.hide();
      }
    }

    // Android hardware back button via popstate
    // We push a dummy state so that back button triggers popstate instead of leaving the app
    if (isTabPage) {
      // On tab pages, push a guard state to prevent accidental exit
      const guardKey = 'back-guard';
      if (!window.history.state?.[guardKey]) {
        window.history.pushState({ [guardKey]: true }, '');
      }

      const handlePopState = (e) => {
        // Re-push the guard to keep the user on the current tab
        if (!window.history.state?.[guardKey]) {
          window.history.pushState({ [guardKey]: true }, '');
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [location.pathname, navigate]);
}