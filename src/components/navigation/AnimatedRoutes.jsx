import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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

  useEffect(() => {
    const saved = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(saved);
    const interval = setInterval(() => {
      const t = localStorage.getItem('dailyQuestsTheme') || 'light';
      if (t !== theme) setTheme(t);
    }, 500);
    return () => clearInterval(interval);
  }, [theme]);

  const currentIndex = TAB_ORDER[location.pathname] ?? -1;
  const wasChildPage = !NAV_PATHS.includes(prevPathRef.current);
  const isNowRootPage = NAV_PATHS.includes(location.pathname);

  // Child → root = always slide back (-1); root ↔ root = tab direction; root → child = forward (1)
  let direction;
  if (wasChildPage && isNowRootPage) {
    direction = -1; // back transition
  } else if (currentIndex >= 0) {
    direction = currentIndex > prevIndex ? 1 : (currentIndex < prevIndex ? -1 : 1);
  } else {
    direction = 1; // forward into child
  }

  useEffect(() => {
    if (currentIndex >= 0) {
      setPrevIndex(currentIndex);
    }
    prevPathRef.current = location.pathname;
  }, [currentIndex, location.pathname]);

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

  return (
    <>
      {/* Floating back button for child (non-tab) pages */}
      {isChildPage && (
        <div className="fixed top-3 left-3 z-50" style={{ top: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
          <BackButton theme={theme} />
        </div>
      )}
      <div className={showNav ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+8px)]' : ''}>
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
                <Route path="/" element={<DailyTracker />} />
                <Route path="/DailyTracker" element={<DailyTracker />} />
                <Route path="/History" element={<History />} />
                <Route path="/Profile" element={<Profile />} />
                {/* Render remaining pages from pagesConfig loop */}
                {children}
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
      {showNav && <BottomNavBar theme={theme} />}
    </>
  );
}