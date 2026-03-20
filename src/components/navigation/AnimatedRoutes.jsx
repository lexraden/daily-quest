import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNavBar from './BottomNavBar';
import BackButton from './BackButton';

// Route-level code splitting via React.lazy
const DailyTracker = React.lazy(() => import('@/pages/DailyTracker'));
const History = React.lazy(() => import('@/pages/History'));
const Profile = React.lazy(() => import('@/pages/Profile'));

// Tab indices for determining slide direction
const TAB_ORDER = { '/': 0, '/DailyTracker': 0, '/History': 1, '/Profile': 2 };

// Pages that should show the bottom nav
const NAV_PATHS = ['/', '/DailyTracker', '/History', '/Profile'];

// Map paths to canonical tab keys (/ and /DailyTracker both map to 'tracker')
const TAB_KEY = { '/': 'tracker', '/DailyTracker': 'tracker', '/History': 'history', '/Profile': 'profile' };

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
  </div>
);

export default function AnimatedRoutes({ children, fallback }) {
  const location = useLocation();
  const [theme, setTheme] = useState('light');
  const [prevIndex, setPrevIndex] = useState(0);
  const prevPathRef = useRef(location.pathname);

  // Track which tabs have been visited so we mount them lazily
  const [visitedTabs, setVisitedTabs] = useState(() => {
    const key = TAB_KEY[location.pathname];
    return key ? new Set([key]) : new Set();
  });

  // Scroll position preservation per tab
  const scrollPositions = useRef({});

  useEffect(() => {
    const saved = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(saved);
    const interval = setInterval(() => {
      const t = localStorage.getItem('dailyQuestsTheme') || 'light';
      if (t !== theme) setTheme(t);
    }, 500);
    return () => clearInterval(interval);
  }, [theme]);

  const currentTabKey = TAB_KEY[location.pathname];
  const isTabPage = !!currentTabKey;
  const currentIndex = TAB_ORDER[location.pathname] ?? -1;
  const wasChildPage = !NAV_PATHS.includes(prevPathRef.current);
  const isNowRootPage = NAV_PATHS.includes(location.pathname);

  // Child → root = always slide back (-1); root ↔ root = tab direction; root → child = forward (1)
  let direction;
  if (wasChildPage && isNowRootPage) {
    direction = -1;
  } else if (currentIndex >= 0) {
    direction = currentIndex > prevIndex ? 1 : (currentIndex < prevIndex ? -1 : 1);
  } else {
    direction = 1;
  }

  // Save scroll position of previous tab, restore scroll of new tab
  useEffect(() => {
    const prevTabKey = TAB_KEY[prevPathRef.current];

    // Save previous tab's scroll
    if (prevTabKey && prevTabKey !== currentTabKey) {
      scrollPositions.current[prevTabKey] = window.scrollY;
    }

    // Mark current tab as visited
    if (currentTabKey && !visitedTabs.has(currentTabKey)) {
      setVisitedTabs(prev => new Set([...prev, currentTabKey]));
    }

    // Restore scroll position for current tab
    if (currentTabKey) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositions.current[currentTabKey] || 0);
      });
    }

    if (currentIndex >= 0) {
      setPrevIndex(currentIndex);
    }
    prevPathRef.current = location.pathname;
  }, [currentIndex, location.pathname, currentTabKey]);

  const showNav = NAV_PATHS.includes(location.pathname);
  const isChildPage = !showNav;

  const variants = {
    enter: (dir) => ({
      x: dir > 0 ? '30%' : '-30%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir) => ({
      x: dir < 0 ? '30%' : '-30%',
      opacity: 0,
    }),
  };

  // Tab components mapped by key — kept mounted via CSS visibility
  const tabComponents = {
    tracker: <DailyTracker />,
    history: <History />,
    profile: <Profile />,
  };

  return (
    <>
      {/* Floating back button for child (non-tab) pages */}
      {isChildPage && (
        <div className="fixed top-3 left-3 z-50" style={{ top: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
          <BackButton theme={theme} />
        </div>
      )}

      {/* Persistent tab views — hidden via CSS, never unmounted */}
      <div className={showNav ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+8px)]' : ''}>
        {isTabPage && (
          <Suspense fallback={<RouteFallback />}>
            {Object.entries(tabComponents).map(([key, component]) => {
              if (!visitedTabs.has(key)) return null;
              const isActive = key === currentTabKey;
              return (
                <div
                  key={key}
                  className="min-h-screen"
                  style={{
                    display: isActive ? 'block' : 'none',
                  }}
                >
                  {component}
                </div>
              );
            })}
          </Suspense>
        )}

        {/* Non-tab (child) pages still use animated transitions */}
        {!isTabPage && (
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={location.pathname}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="min-h-screen"
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