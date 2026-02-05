import React, { useState, useEffect } from 'react';
import { X, User, Flame, Trophy, TrendingUp, Calendar, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

const CATEGORIES = {
  health: { 
    name: "Health", 
    icon: () => <span className="text-lg">💪</span>,
    color: "#00b894",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    textColor: "text-green-400"
  },
  mind: { 
    name: "Mind", 
    icon: () => <span className="text-lg">🧠</span>,
    color: "#a29bfe",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    textColor: "text-purple-400"
  },
  work: { 
    name: "Work", 
    icon: () => <span className="text-lg">💼</span>,
    color: "#fdcb6e",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    textColor: "text-yellow-400"
  },
  money: { 
    name: "Money", 
    icon: () => <span className="text-lg">💰</span>,
    color: "#00cec9",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    textColor: "text-cyan-400"
  },
  love: { 
    name: "Love", 
    icon: () => <span className="text-lg">❤️</span>,
    color: "#ff7675",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    textColor: "text-red-400"
  },
  friends: { 
    name: "Friends", 
    icon: () => <span className="text-lg">👥</span>,
    color: "#fd79a8",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
    textColor: "text-pink-400"
  }
};

const LEVELS = [
  { level: 1, threshold: 0, name: "Новичок", icon: "🌱", color: "#6c5ce7" },
  { level: 2, threshold: 10, name: "Ученик", icon: "📚", color: "#00cec9" },
  { level: 3, threshold: 25, name: "Практик", icon: "⚡", color: "#fdcb6e" },
  { level: 4, threshold: 50, name: "Мастер", icon: "🔥", color: "#e17055" },
  { level: 5, threshold: 100, name: "Эксперт", icon: "💎", color: "#d63031" },
  { level: 6, threshold: 200, name: "Герой", icon: "⚔️", color: "#fd79a8" },
  { level: 7, threshold: 350, name: "Чемпион", icon: "🏆", color: "#fdcb6e" },
  { level: 8, threshold: 550, name: "Легенда", icon: "👑", color: "#ffeaa7" },
  { level: 9, threshold: 800, name: "Титан", icon: "⚡", color: "#a29bfe" },
  { level: 10, threshold: 1100, name: "Бог", icon: "✨", color: "#ffffff" }
];

export default function Profile() {
  const [theme, setTheme] = useState('light');
  const [tgUser, setTgUser] = useState(null);
  const [stats, setStats] = useState({
    streak: 0,
    totalCompleted: 0,
    categoryLevels: {},
    currentLevel: LEVELS[0]
  });

  useEffect(() => {
    // Load theme
    const savedTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(savedTheme);

    // Load Telegram user
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      setTgUser(window.Telegram.WebApp.initDataUnsafe.user);
    }

    // Load stats from localStorage
    const savedData = localStorage.getItem('dailyQuestsData');
    if (savedData) {
      const data = JSON.parse(savedData);
      
      // Calculate current level
      const totalCompleted = data.totalCompleted || 0;
      let currentLevel = LEVELS[0];
      for (const level of LEVELS) {
        if (totalCompleted >= level.threshold) {
          currentLevel = level;
        }
      }

      setStats({
        streak: data.streak || 0,
        totalCompleted: totalCompleted,
        categoryLevels: data.categoryLevels || {},
        currentLevel: currentLevel
      });
    }
  }, []);

  const bgClass = theme === 'light' 
    ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
    : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white';

  // Calculate next level progress
  const getNextLevelProgress = () => {
    const currentLevelIndex = LEVELS.findIndex(l => l === stats.currentLevel);
    const nextLevel = LEVELS[currentLevelIndex + 1];
    
    if (!nextLevel) return { progress: 100, remaining: 0, nextLevel: null };
    
    const currentThreshold = stats.currentLevel.threshold;
    const nextThreshold = nextLevel.threshold;
    const progress = ((stats.totalCompleted - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    const remaining = nextThreshold - stats.totalCompleted;
    
    return { progress: Math.min(progress, 100), remaining, nextLevel };
  };

  const levelProgress = getNextLevelProgress();

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' 
          ? 'bg-white/80 border-gray-200' 
          : 'bg-[#0f1419]/80 border-white/10'
      }`}>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <h1 className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              Профиль
            </h1>
            <Link to={createPageUrl('DailyTracker')}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-10 w-10 rounded-full ${
                  theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'
                }`}
              >
                <X className="w-6 h-6" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-6 space-y-4 max-w-2xl mx-auto pb-20">
        {/* User Header Card */}
        <div className={`rounded-3xl overflow-hidden border ${
          theme === 'light' 
            ? 'bg-white border-gray-200 shadow-lg' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          {/* Hero Banner with Pattern */}
          <div className="h-32 bg-gradient-to-br from-purple-500 via-purple-600 to-cyan-500 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '40px 40px'
              }} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
          </div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="relative -mt-16 mb-4">
              <div className={`w-28 h-28 rounded-full border-4 overflow-hidden ${
                theme === 'light' ? 'bg-white border-white shadow-xl' : 'bg-[#0f1419] border-[#1e2836] shadow-2xl'
              }`}>
                {tgUser?.photo_url ? (
                  <img src={tgUser.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    theme === 'light'
                      ? 'bg-gradient-to-br from-purple-100 to-cyan-100'
                      : 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20'
                  }`}>
                    <User className={`w-14 h-14 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
                  </div>
                )}
              </div>
            </div>
            
            {/* Name and Level Badge */}
            <div className="mb-4">
              <h2 className={`text-2xl font-bold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {tgUser?.first_name || 'Пользователь'}
              </h2>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-purple-100 to-cyan-100 border border-purple-200'
                  : 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30'
              }`}>
                <span className="text-2xl">{stats.currentLevel.icon}</span>
                <span className={`font-bold text-sm ${
                  theme === 'light' ? 'text-purple-900' : 'text-purple-300'
                }`}>
                  {stats.currentLevel.name}
                </span>
              </div>
            </div>

            {/* Level Progress */}
            <div className={`p-4 rounded-xl ${
              theme === 'light' 
                ? 'bg-gradient-to-br from-gray-50 to-purple-50/30' 
                : 'bg-white/5'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className={`w-4 h-4 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
                  <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    {stats.totalCompleted} / {levelProgress.nextLevel ? levelProgress.nextLevel.threshold : 'MAX'} XP
                  </span>
                </div>
                {levelProgress.nextLevel && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {levelProgress.remaining} до Level {levelProgress.nextLevel.level}
                  </span>
                )}
              </div>
              
              {/* Progress Bar with Level Labels */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className={theme === 'light' ? 'text-purple-600' : 'text-purple-400'}>
                    Level {stats.currentLevel.level}
                  </span>
                  {levelProgress.nextLevel && (
                    <span className={theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}>
                      Level {levelProgress.nextLevel.level}
                    </span>
                  )}
                </div>
                <div className={`h-3 rounded-full overflow-hidden ${
                  theme === 'light' ? 'bg-gray-200' : 'bg-white/10'
                }`}>
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-cyan-500 transition-all duration-700 relative overflow-hidden"
                    style={{ width: `${levelProgress.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-5 border ${
            theme === 'light' 
              ? 'bg-gradient-to-br from-orange-50 to-white border-orange-200' 
              : 'bg-gradient-to-br from-orange-900/20 to-transparent border-orange-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Серия
              </span>
            </div>
            <div className={`text-3xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              {stats.streak}
            </div>
            <div className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              дней подряд
            </div>
          </div>

          <div className={`rounded-2xl p-5 border ${
            theme === 'light' 
              ? 'bg-gradient-to-br from-purple-50 to-white border-purple-200' 
              : 'bg-gradient-to-br from-purple-900/20 to-transparent border-purple-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Trophy className="w-5 h-5 text-purple-400" />
              </div>
              <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Всего
              </span>
            </div>
            <div className={`text-3xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              {stats.totalCompleted}
            </div>
            <div className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              квестов
            </div>
          </div>
        </div>

        {/* Category Levels */}
        <div className={`rounded-2xl p-5 border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <Award className={`w-5 h-5 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h3 className={`text-base font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              Уровни категорий
            </h3>
          </div>
          <div className="space-y-2">
            {Object.entries(CATEGORIES).map(([categoryKey, categoryInfo]) => {
              const CategoryIcon = categoryInfo.icon;
              const level = stats.categoryLevels[categoryKey] || 1;
              
              return (
                <div 
                  key={categoryKey}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                    theme === 'light' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${categoryInfo.bgColor}`}>
                      <CategoryIcon />
                    </div>
                    <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                      {categoryInfo.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${categoryInfo.bgColor} ${categoryInfo.textColor}`}>
                      LVL {level}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Back Button */}
        <Link to={createPageUrl('DailyTracker')}>
          <Button
            className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            Вернуться к квестам
          </Button>
        </Link>
      </div>
    </div>
  );
}