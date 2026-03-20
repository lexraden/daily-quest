import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNavBar from './BottomNavBar';
import BackButton from './BackButton';
import useAndroidBackButton from '@/hooks/useAndroidBackButton';

const DailyTracker = React.lazy(() => import('@/pages/DailyTracker'));
const History = React.lazy(() => import('@/pages/History'));
const Profile = React.lazy(() => import('@/pages/Profile'));

const TAB_ORDER = { '/': 0, '/DailyTracker': 0, '/History': 1, '/Profile': 2 };
const NAV_PATHS = new Set(['/', '/DailyTracker', '/History', '/Profile']);
const TAB_KEY_MAP = { '/': 'tracker', '/DailyTracker': 'tracker', '/History': 'history', '/Profile': 'profile' };

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
  </div>
);

const TAB_COMPONENTS = {
  tracker: DailyTracker,
  history: History,
  profile: Profile,
};

// GPU-accelerated slide variants for child pages
const childVariants = {
  enter: (dir) => ({
    x: dir > 0 ? '100%' : '-30%',
    opacity: dir > 0 ? 1 : 0.6,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir) => ({
    x: dir < 0 ? '100%' : '-30%',
    opacity: dir < 0 ? 1 : 0.6,
  }),
};

const childTransition = {
  type: 'tween',
  ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
  duration: 0.28,
};

export default function AnimatedRoutes({ children, fallback }) {
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('dailyQuestsTheme') || 'light');
  const [prevIndex, setPrevIndex] = useState(0);
  const prevPathRef = useRef(location.pathname);

  useAndroidBackButton();

  // Track visited tabs for lazy mounting
  const [visitedTabs, setVisitedTabs] = useState(() => {
    const key = TAB_KEY_MAP[location.pathname];
    return key ? new Set([key]) : new Set(['tracker']);
  });

  // Scroll positions per tab
  const scrollPositions = useRef({});

  // Theme sync
  useEffect(() => {
    const interval = setInterval(() => {
      const t = localStorage.getItem('dailyQuestsTheme') || 'light';
      setTheme(prev => prev !== t ? t : prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const currentTabKey = TAB_KEY_MAP[location.pathname];
  const isTabPage = NAV_PATHS.has(location.pathname);
  const currentIndex = TAB_ORDER[location.pathname] ?? -1;

  // Slide direction: 1 = push forward, -1 = pop back
  const wasChildPage = !NAV_PATHS.has(prevPathRef.current);
  let direction;
  if (wasChildPage && isTabPage) {
    direction = -1; // returning to tab from child
  } else if (!isTabPage) {
    direction = 1; // entering child page
  } else {
    direction = currentIndex >= prevIndex ? 1 : -1;
  }

  // On navigation: save/restore scroll, track visited tabs
  useEffect(() => {
    const prevTabKey = TAB_KEY_MAP[prevPathRef.current];

    if (prevTabKey && prevTabKey !== currentTabKey) {
      scrollPositions.current[prevTabKey] = window.scrollY;
    }

    if (currentTabKey && !visitedTabs.has(currentTabKey)) {
      setVisitedTabs(prev => new Set([...prev, currentTabKey]));
    }

    if (currentTabKey) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositions.current[currentTabKey] || 0);
      });
    } else {
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }

    if (currentIndex >= 0) setPrevIndex(currentIndex);
    prevPathRef.current = location.pathname;
  }, [location.pathname, currentIndex, currentTabKey]);

  const showNav = isTabPage;

  return (
    <>
      {/* Back button for child pages */}
      {!isTabPage && (
        <div className="fixed top-3 left-3 z-50" style={{ top: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
          <BackButton theme={theme} />
        </div>
      )}

      {/* 
        PERSISTENT TAB LAYER
        Always rendered. Uses display:none to hide inactive tabs.
        Stays mounted even on child pages.
      */}
      <div className={showNav ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+8px)]' : ''}>
        <Suspense fallback={<RouteFallback />}>
          {Object.entries(TAB_COMPONENTS).map(([key, Component]) => {
            if (!visitedTabs.has(key)) return null;
            const isActive = isTabPage && key === currentTabKey;
            return (
              <div
                key={key}
                className="min-h-screen"
                style={{ display: isActive ? 'block' : 'none' }}
              >
                <Component />
              </div>
            );
          })}
        </Suspense>

        {/* Child (non-tab) pages — hardware-accelerated slide transitions */}
        {!isTabPage && (
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={location.pathname}
              custom={direction}
              variants={childVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={childTransition}
              className="min-h-screen"
              style={{ willChange: 'transform, opacity' }}
            >
              <Suspense fallback={<RouteFallback />}>
                <Routes location={location}>
                  {children}
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {showNav && <BottomNavBar theme={theme} />}
    </>
  );
}