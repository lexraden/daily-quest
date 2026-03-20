import React from 'react';
import { X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CategoryProgressModal({ category, categoryInfo, totalCompleted, currentLevel, completionHistory, onClose, theme = 'dark' }) {
  const Icon = categoryInfo.icon;
  
  // Calculate next level threshold (every 10 quests = +1 level)
  const currentThreshold = (currentLevel - 1) * 10;
  const nextThreshold = currentLevel * 10;
  const progressInCurrentLevel = totalCompleted - currentThreshold;
  const progressPercentage = (progressInCurrentLevel / 10) * 100;

  // Calculate weekly stats (last 7 days)
  const getWeeklyStats = () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    let weeklyCount = 0;
    
    Object.entries(completionHistory || {}).forEach(([dateKey, quests]) => {
      const date = new Date(dateKey);
      if (date >= weekAgo && date <= today) {
        weeklyCount += quests.filter(q => q.category === category).length;
      }
    });
    
    return weeklyCount;
  };

  const weeklyCompleted = getWeeklyStats();

  return (
    <div 
      className={`fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4 ${
        theme === 'light' ? 'bg-black/60' : 'bg-black/80'
      }`}
      onClick={onClose}
    >
      <div 
        className={`rounded-2xl max-w-md w-full border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${
          theme === 'light' ? 'border-gray-200' : 'border-white/10'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${categoryInfo.bgColor}`}>
              <Icon className={`w-6 h-6 ${categoryInfo.textColor}`} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {categoryInfo.name}
              </h2>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Недельный отчёт
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            aria-label="Закрыть"
            className="h-11 w-11 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Current Level */}
          <div className={`rounded-xl p-5 border ${
            theme === 'light' 
              ? 'bg-gradient-to-br from-gray-50 to-white border-gray-200' 
              : 'bg-gradient-to-br from-white/5 to-transparent border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Текущий уровень
              </span>
              <div className={`px-3 py-1 rounded-lg ${categoryInfo.bgColor}`}>
                <span className={`text-2xl font-bold ${categoryInfo.textColor}`}>
                  {currentLevel}
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
                  Прогресс до Lvl {currentLevel + 1}
                </span>
                <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
                  {progressInCurrentLevel}/10
                </span>
              </div>
              <div className={`relative h-3 rounded-full overflow-hidden ${
                theme === 'light' ? 'bg-black/5' : 'bg-white/5'
              }`}>
                <div 
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${progressPercentage}%`,
                    backgroundColor: categoryInfo.color
                  }}
                />
              </div>
            </div>
          </div>

          {/* Weekly Stats */}
          <div className={`rounded-xl p-5 border ${
            theme === 'light' 
              ? 'bg-gradient-to-br from-gray-50 to-white border-gray-200' 
              : 'bg-gradient-to-br from-white/5 to-transparent border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                За последние 7 дней
              </span>
              <div className={`text-3xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {weeklyCompleted}
              </div>
            </div>
            <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              {weeklyCompleted === 0 
                ? 'Пора начать!'
                : weeklyCompleted < 7 
                  ? 'Хорошее начало! Продолжай в том же духе'
                  : 'Отлично! Ты на правильном пути 🔥'
              }
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-4 border ${
              theme === 'light' 
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className={`w-4 h-4 ${categoryInfo.textColor}`} />
                <span className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                  Всего квестов
                </span>
              </div>
              <div className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {totalCompleted}
              </div>
            </div>

            <div className={`rounded-xl p-4 border ${
              theme === 'light' 
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${categoryInfo.textColor}`} />
                <span className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                  До следующего
                </span>
              </div>
              <div className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {10 - progressInCurrentLevel}
              </div>
            </div>
          </div>

          {/* Level Milestones */}
          <div>
            <h3 className={`text-sm font-semibold mb-3 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
              Достижения
            </h3>
            <div className="space-y-2">
              {[1, 5, 10, 20, 30, 50].map((milestone) => {
                const reached = currentLevel >= milestone;
                return (
                  <div 
                    key={milestone}
                    className={`flex items-center justify-between p-2.5 rounded-lg ${
                      reached 
                        ? categoryInfo.bgColor
                        : theme === 'light' 
                          ? 'bg-gray-50' 
                          : 'bg-white/5'
                    }`}
                  >
                    <span className={`text-sm ${
                      reached 
                        ? categoryInfo.textColor 
                        : theme === 'light' 
                          ? 'text-gray-500' 
                          : 'text-gray-500'
                    }`}>
                      Уровень {milestone}
                    </span>
                    {reached && (
                      <span className="text-lg">✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-5 border-t ${theme === 'light' ? 'border-gray-200' : 'border-white/10'}`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
        >
          <Button
            onClick={onClose}
            className="w-full"
            style={{ backgroundColor: categoryInfo.color }}
          >
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}