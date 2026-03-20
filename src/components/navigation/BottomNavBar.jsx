import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Target, CalendarDays, User } from 'lucide-react';

const TABS = [
  { path: '/DailyTracker', icon: Target, label: 'Квесты' },
  { path: '/History', icon: CalendarDays, label: 'История' },
  { path: '/Profile', icon: User, label: 'Профиль' },
];

export default function BottomNavBar({ theme = 'light' }) {
  const location = useLocation();

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl select-none ${
      theme === 'light'
        ? 'bg-white/90 border-gray-200'
        : 'bg-[#0f1419]/90 border-white/10'
    }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {TABS.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || (path === '/DailyTracker' && location.pathname === '/');
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive
                  ? theme === 'light' ? 'text-purple-600' : 'text-purple-400'
                  : theme === 'light' ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}