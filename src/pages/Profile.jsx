import React, { useState, useEffect } from 'react';
import { X, User, Flame, Trophy, TrendingUp, Calendar, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

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
  money: { 
    name: "Money", 
    icon: () => <span className="text-lg">💰</span>,
    color: "#00cec9",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    textColor: "text-cyan-400"
  },
  work: { 
    name: "Work", 
    icon: () => <span className="text-lg">💼</span>,
    color: "#fdcb6e",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    textColor: "text-yellow-400"
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
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    streak: 0,
    totalCompleted: 0,
    categoryLevels: {},
    currentLevel: LEVELS[0]
  });
  const [journalEntries, setJournalEntries] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    // Load theme
    const savedTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(savedTheme);

    // Load authenticated user
    base44.auth.me().then(authUser => {
      if (authUser) {
        setUser(authUser);
        setEditedName(authUser.full_name || '');
      }
    }).catch(() => {});

    // Load Telegram user
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      setTgUser(window.Telegram.WebApp.initDataUnsafe.user);
    }

    // Load stats from database
    const loadUserData = async () => {
      try {
        const authUser = await base44.auth.me();
        if (authUser?.email) {
          const userDataList = await base44.entities.UserQuestData.filter({ created_by: authUser.email });
          
          if (userDataList.length > 0) {
            const data = userDataList[0];
            
            // Calculate current level
            const totalCompleted = data.total_completed || 0;
            let currentLevel = LEVELS[0];
            for (const level of LEVELS) {
              if (totalCompleted >= level.threshold) {
                currentLevel = level;
              }
            }

            setStats({
              streak: data.streak || 0,
              totalCompleted: totalCompleted,
              categoryLevels: data.category_levels || {},
              currentLevel: currentLevel
            });

            // Load journal entries
            if (data.journal_entries) {
              setJournalEntries(data.journal_entries);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    
    loadUserData();
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

  const filteredJournal = journalEntries.filter(entry => {
    if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
    if (filterType !== 'all' && entry.type !== filterType) return false;
    return true;
  });

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    try {
      await base44.auth.updateMe({ full_name: editedName.trim() });
      setUser(prev => ({ ...prev, full_name: editedName.trim() }));
      setIsEditingName(false);
      toast.success('Имя успешно сохранено! ✓');
    } catch (error) {
      console.error('Failed to update name:', error);
      toast.error('Не удалось сохранить имя');
    }
  };

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
      <div className="px-5 py-4 space-y-3 max-w-2xl mx-auto pb-6">
        {/* User Header Card */}
        <div className={`rounded-3xl overflow-hidden border ${
          theme === 'light' 
            ? 'bg-white border-gray-200 shadow-lg' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          {/* Hero Banner with Pattern */}
          <div className="h-24 bg-gradient-to-br from-purple-500 via-purple-600 to-cyan-500 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '40px 40px'
              }} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
          </div>
          
          {/* Profile Info */}
          <div className="px-5 pb-4">
            {/* Avatar */}
            <div className="relative -mt-12 mb-3">
              <div className={`w-20 h-20 rounded-full border-4 overflow-hidden ${
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
                    <User className={`w-10 h-10 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
                  </div>
                )}
              </div>
            </div>
            
            {/* Name and Level Badge */}
            <div className="mb-3">
              {isEditingName ? (
                <div className="space-y-2 mb-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-base font-bold ${
                      theme === 'light'
                        ? 'bg-white border-2 border-purple-300 text-gray-900'
                        : 'bg-[#0f1419] border-2 border-purple-500/50 text-white'
                    }`}
                    placeholder="Введите имя"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveName}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
                    >
                      ✓ Сохранить
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditingName(false);
                        setEditedName(user?.full_name || '');
                      }}
                      variant="outline"
                      className={theme === 'light' ? 'border-gray-300' : 'border-white/10'}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <h2 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    {user?.full_name || tgUser?.first_name || 'Пользователь'}
                  </h2>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className={`p-1 rounded-lg transition-colors ${
                      theme === 'light'
                        ? 'hover:bg-black/5 text-gray-400 hover:text-gray-600'
                        : 'hover:bg-white/10 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    ✏️
                  </button>
                </div>
              )}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-purple-100 to-cyan-100 border border-purple-200'
                  : 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30'
              }`}>
                <span className="text-lg">{stats.currentLevel.icon}</span>
                <span className={`font-bold text-xs ${
                  theme === 'light' ? 'text-purple-900' : 'text-purple-300'
                }`}>
                  {stats.currentLevel.name}
                </span>
              </div>
            </div>

            {/* Level Progress */}
            <div className={`p-3 rounded-xl ${
              theme === 'light' 
                ? 'bg-gradient-to-br from-gray-50 to-purple-50/30' 
                : 'bg-white/5'
            }`}>
              <div className="flex items-center justify-between mb-2">
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

        {/* Journal Entries */}
        {journalEntries.length > 0 && (
          <div className={`rounded-2xl p-4 border ${
            theme === 'light' 
              ? 'bg-white border-gray-200' 
              : 'bg-[#1e2836] border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className={`w-5 h-5 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`} />
                <h3 className={`text-base font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  Журнал
                </h3>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-white/5 text-gray-400'
              }`}>
                {filteredJournal.length}
              </span>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filterType === 'all'
                    ? theme === 'light'
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-white border border-purple-500/50'
                    : theme === 'light'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setFilterType('quest_completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filterType === 'quest_completed'
                    ? theme === 'light'
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-white border border-purple-500/50'
                    : theme === 'light'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                🎯 Квесты
              </button>
              <button
                onClick={() => setFilterType('journal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filterType === 'journal'
                    ? theme === 'light'
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-white border border-purple-500/50'
                    : theme === 'light'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                📝 Заметки
              </button>
            </div>

            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filterCategory === 'all'
                    ? theme === 'light'
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-white border border-purple-500/50'
                    : theme === 'light'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Все категории
              </button>
              {Object.entries(CATEGORIES).map(([key, info]) => {
                const Icon = info.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterCategory(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      filterCategory === key
                        ? `${info.bgColor} ${info.textColor} border ${info.borderColor}`
                        : theme === 'light'
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <Icon />
                    {info.name}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredJournal.length === 0 ? (
                <div className={`text-center py-8 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Нет записей</p>
                </div>
              ) : (
                filteredJournal.slice(0, 50).map((entry) => {
                  const categoryInfo = CATEGORIES[entry.category];
                  const isQuest = entry.type === 'quest_completed';
                  
                  return (
                    <div 
                      key={entry.id}
                      className={`p-3 rounded-xl transition-all border ${
                        isQuest
                          ? theme === 'light'
                            ? 'bg-gradient-to-br from-purple-50 to-cyan-50 border-purple-200'
                            : 'bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30'
                          : theme === 'light' 
                            ? 'bg-gray-50 border-gray-200' 
                            : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{entry.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                              {entry.text}
                            </p>
                            {isQuest && (
                              <span className={`text-xs px-2 py-1 rounded-full font-bold flex-shrink-0 ${
                                theme === 'light'
                                  ? 'bg-gradient-to-r from-purple-100 to-cyan-100 text-purple-700'
                                  : 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-300'
                              }`}>
                                +1 XP
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${categoryInfo?.bgColor} ${categoryInfo?.textColor}`}>
                              {categoryInfo?.name || entry.category}
                            </span>
                            <span className={`text-xs ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
                              {new Date(entry.timestamp).toLocaleString('ru-RU', { 
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Category Levels */}
        <div className={`rounded-2xl p-4 border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          <div className="flex items-center gap-2 mb-3">
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
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
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
            className="w-full h-11 text-sm bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            Вернуться к квестам
          </Button>
        </Link>

        {/* Logout Button */}
        <Button
          onClick={() => base44.auth.logout()}
          variant="outline"
          className={`w-full h-11 text-sm ${
            theme === 'light'
              ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
              : 'border-white/10 text-gray-300 hover:bg-white/5'
          }`}
        >
          Выйти из аккаунта
        </Button>
        </div>
        </div>
        );
        }