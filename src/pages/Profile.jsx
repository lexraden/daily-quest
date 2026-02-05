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
  { threshold: 0, name: "Новичок", icon: "🌱", color: "#6c5ce7" },
  { threshold: 20, name: "Ученик", icon: "📚", color: "#00cec9" },
  { threshold: 50, name: "Практик", icon: "⚡", color: "#fdcb6e" },
  { threshold: 100, name: "Мастер", icon: "🔥", color: "#e17055" },
  { threshold: 200, name: "Эксперт", icon: "💎", color: "#d63031" },
  { threshold: 400, name: "Легенда", icon: "👑", color: "#ffeaa7" }
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
        <div className={`rounded-2xl overflow-hidden border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          {/* Gradient Background */}
          <div className="h-24 bg-gradient-to-r from-purple-600 via-cyan-600 to-purple-600 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
          </div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-10">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl border-4 ${
                theme === 'light' ? 'bg-gray-100 border-white' : 'bg-white/10 border-[#1e2836]'
              }`}>
                {tgUser?.photo_url ? (
                  <img src={tgUser.photo_url} alt="Profile" className="w-full h-full rounded-full" />
                ) : (
                  <User className={`w-10 h-10 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`} />
                )}
              </div>
              <div className="flex-1 mb-2">
                <h2 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  {tgUser?.first_name || 'Пользователь'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{stats.currentLevel.icon}</span>
                  <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    {stats.currentLevel.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Level Progress */}
            {levelProgress.nextLevel && (
              <div className={`mt-4 p-3 rounded-lg ${
                theme === 'light' ? 'bg-gray-50' : 'bg-white/5'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`w-4 h-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                      До уровня {levelProgress.nextLevel.name}
                    </span>
                  </div>
                  <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                    {levelProgress.remaining} квестов
                  </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${
                  theme === 'light' ? 'bg-gray-200' : 'bg-white/10'
                }`}>
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-cyan-600 transition-all duration-500"
                    style={{ width: `${levelProgress.progress}%` }}
                  />
                </div>
              </div>
            )}
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