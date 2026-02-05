import React from 'react';
import { X, User, Flame, Trophy, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProfileModal({ 
  userName, 
  userPhoto,
  streak, 
  totalCompleted, 
  currentLevel,
  categoryLevels,
  categories,
  onClose, 
  theme = 'dark' 
}) {
  const Icon = currentLevel?.icon || "🌱";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
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
          <h2 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            Профиль
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
              theme === 'light' ? 'bg-gray-100' : 'bg-white/10'
            }`}>
              {userPhoto ? (
                <img src={userPhoto} alt="Profile" className="w-full h-full rounded-full" />
              ) : (
                <User className={`w-8 h-8 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`} />
              )}
            </div>
            <div>
              <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {userName || 'Пользователь'}
              </h3>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                {currentLevel?.name || 'Новичок'}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-4 border ${
              theme === 'light' 
                ? 'bg-gradient-to-br from-orange-50 to-white border-orange-200' 
                : 'bg-gradient-to-br from-orange-900/20 to-transparent border-orange-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                  Серия
                </span>
              </div>
              <div className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {streak}
              </div>
              <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                дней подряд
              </div>
            </div>

            <div className={`rounded-xl p-4 border ${
              theme === 'light' 
                ? 'bg-gradient-to-br from-purple-50 to-white border-purple-200' 
                : 'bg-gradient-to-br from-purple-900/20 to-transparent border-purple-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-purple-400" />
                <span className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                  Всего
                </span>
              </div>
              <div className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {totalCompleted}
              </div>
              <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                квестов выполнено
              </div>
            </div>
          </div>

          {/* Category Levels */}
          <div>
            <h3 className={`text-sm font-semibold mb-3 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
              Уровни по категориям
            </h3>
            <div className="space-y-2">
              {Object.entries(categories).map(([categoryKey, categoryInfo]) => {
                const CategoryIcon = categoryInfo.icon;
                const level = categoryLevels[categoryKey] || 1;
                
                return (
                  <div 
                    key={categoryKey}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      theme === 'light' ? 'bg-gray-50' : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${categoryInfo.bgColor}`}>
                        <CategoryIcon className={`w-4 h-4 ${categoryInfo.textColor}`} />
                      </div>
                      <span className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                        {categoryInfo.name}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${categoryInfo.textColor}`}>
                      Lvl {level}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-5 border-t ${theme === 'light' ? 'border-gray-200' : 'border-white/10'}`}>
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}