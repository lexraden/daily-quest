import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Flame, Trophy, Calendar as CalendarIcon, Target, Sparkles, Heart, Brain, Briefcase, DollarSign, Users, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CalendarView from '@/components/daily/CalendarView.jsx';

/* ============================================
   🎨 DESIGN CUSTOMIZATION SECTION
   ============================================ */

const APP_CONFIG = {
  title: "Daily Quests",
  subtitle: "Твой путь к успеху",
  streakLabel: "Серия",
  levelLabel: "Уровень",
  completedText: "✓",
  pendingText: "○",
  motivationTexts: [
    "Отличное начало! 🚀",
    "Ты на верном пути! 💪",
    "Невероятный прогресс! ⭐",
    "Ты — чемпион! 🏆",
    "Легенда! 👑"
  ]
};

// Категории с иконками и цветами
const CATEGORIES = {
  health: { 
    name: "Health", 
    icon: Activity, 
    color: "#00b894",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    textColor: "text-green-400"
  },
  mind: { 
    name: "Mind", 
    icon: Brain, 
    color: "#a29bfe",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    textColor: "text-purple-400"
  },
  work: { 
    name: "Work", 
    icon: Briefcase, 
    color: "#fdcb6e",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    textColor: "text-yellow-400"
  },
  money: { 
    name: "Money", 
    icon: DollarSign, 
    color: "#00cec9",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    textColor: "text-cyan-400"
  },
  love: { 
    name: "Love", 
    icon: Heart, 
    color: "#ff7675",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    textColor: "text-red-400"
  },
  friends: { 
    name: "Friends", 
    icon: Users, 
    color: "#fd79a8",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
    textColor: "text-pink-400"
  }
};

// Квесты с уровнями сложности (измените под свои нужды)
const QUEST_DATA = {
  health: [
    { level: 1, name: "Прогулка 15 мин", emoji: "🚶" },
    { level: 2, name: "Зарядка 20 мин", emoji: "🏃" },
    { level: 3, name: "Тренировка 45 мин", emoji: "💪" }
  ],
  mind: [
    { level: 1, name: "Медитация 5 мин", emoji: "🧘" },
    { level: 2, name: "Чтение 20 мин", emoji: "📖" },
    { level: 3, name: "Изучение нового 1 час", emoji: "🎓" }
  ],
  work: [
    { level: 1, name: "План на день", emoji: "📝" },
    { level: 2, name: "Фокус-сессия 1 час", emoji: "⏰" },
    { level: 3, name: "Завершить проект", emoji: "🎯" }
  ],
  money: [
    { level: 1, name: "Проверить расходы", emoji: "💳" },
    { level: 2, name: "Отложить 10%", emoji: "💰" },
    { level: 3, name: "Инвестировать", emoji: "📈" }
  ],
  love: [
    { level: 1, name: "Позвонить близким", emoji: "☎️" },
    { level: 2, name: "Провести вечер вместе", emoji: "🌟" },
    { level: 3, name: "Сюрприз для любимых", emoji: "🎁" }
  ],
  friends: [
    { level: 1, name: "Написать другу", emoji: "💬" },
    { level: 2, name: "Встретиться с другом", emoji: "🤝" },
    { level: 3, name: "Организовать встречу", emoji: "🎉" }
  ]
};

// Система уровней
const LEVELS = [
  { threshold: 0, name: "Новичок", icon: "🌱", color: "#6c5ce7" },
  { threshold: 20, name: "Ученик", icon: "📚", color: "#00cec9" },
  { threshold: 50, name: "Практик", icon: "⚡", color: "#fdcb6e" },
  { threshold: 100, name: "Мастер", icon: "🔥", color: "#e17055" },
  { threshold: 200, name: "Эксперт", icon: "💎", color: "#d63031" },
  { threshold: 400, name: "Легенда", icon: "👑", color: "#ffeaa7" }
];

/* ============================================
   END OF CUSTOMIZATION SECTION
   ============================================ */

export default function DailyTracker() {
  const [categoryLevels, setCategoryLevels] = useState({});
  const [completedToday, setCompletedToday] = useState({});
  const [completionHistory, setCompletionHistory] = useState({});
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tgUser, setTgUser] = useState(null);
  const [celebrationQuest, setCelebrationQuest] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const getTodayKey = () => new Date().toISOString().split('T')[0];

  // Инициализация Telegram Web App
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      if (tg.colorScheme === 'dark') {
        document.documentElement.style.setProperty('--bg-primary', '#0f1419');
      }
      
      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user);
      }
    }
  }, []);

  // Загрузка данных из localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('dailyQuestsData');
    if (savedData) {
      const data = JSON.parse(savedData);
      
      // Инициализация уровней категорий
      const levels = {};
      Object.keys(CATEGORIES).forEach(cat => {
        levels[cat] = data.categoryLevels?.[cat] || 1;
      });
      setCategoryLevels(levels);
      
      setTotalCompleted(data.totalCompleted || 0);
      setStreak(data.streak || 0);
      setLastCompletedDate(data.lastCompletedDate || null);
      setCompletionHistory(data.completionHistory || {});
      
      const today = getTodayKey();
      if (data.completedToday && data.lastVisitDate === today) {
        setCompletedToday(data.completedToday);
      } else {
        if (data.lastVisitDate) {
          const lastVisit = new Date(data.lastVisitDate);
          const todayDate = new Date(today);
          const diffDays = Math.floor((todayDate - lastVisit) / (1000 * 60 * 60 * 24));
          
          if (diffDays > 1) {
            setStreak(0);
          }
        }
        setCompletedToday({});
      }
    } else {
      // Инициализация для новых пользователей
      const levels = {};
      Object.keys(CATEGORIES).forEach(cat => {
        levels[cat] = 1;
      });
      setCategoryLevels(levels);
    }
    setIsLoaded(true);
  }, []);

  // Сохранение данных
  useEffect(() => {
    if (!isLoaded) return;
    
    const data = {
      categoryLevels,
      totalCompleted,
      streak,
      lastCompletedDate,
      completedToday,
      completionHistory,
      lastVisitDate: getTodayKey()
    };
    localStorage.setItem('dailyQuestsData', JSON.stringify(data));
  }, [categoryLevels, totalCompleted, streak, lastCompletedDate, completedToday, completionHistory, isLoaded]);

  // Получить текущий квест для категории
  const getCurrentQuest = (category) => {
    const level = categoryLevels[category] || 1;
    const quests = QUEST_DATA[category];
    const quest = quests.find(q => q.level === level) || quests[quests.length - 1];
    return { ...quest, category };
  };

  // Подсчёт текущего уровня игрока
  const getCurrentLevel = useCallback(() => {
    let currentLevel = LEVELS[0];
    for (const level of LEVELS) {
      if (totalCompleted >= level.threshold) {
        currentLevel = level;
      }
    }
    return currentLevel;
  }, [totalCompleted]);

  // Прогресс до следующего уровня
  const getProgressToNextLevel = useCallback(() => {
    const currentLevelIndex = LEVELS.findIndex(l => l === getCurrentLevel());
    const nextLevel = LEVELS[currentLevelIndex + 1];
    
    if (!nextLevel) return { progress: 100, remaining: 0, nextLevel: null };
    
    const currentThreshold = getCurrentLevel().threshold;
    const nextThreshold = nextLevel.threshold;
    const progress = ((totalCompleted - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    const remaining = nextThreshold - totalCompleted;
    
    return { progress: Math.min(progress, 100), remaining, nextLevel };
  }, [totalCompleted, getCurrentLevel]);

  // Отметка квеста
  const toggleQuest = (category) => {
    const currentQuest = getCurrentQuest(category);
    const questKey = `${category}_${currentQuest.level}`;
    const wasCompleted = completedToday[questKey];
    const today = getTodayKey();
    
    if (wasCompleted) {
      // Отменить выполнение
      setCompletedToday(prev => {
        const newState = { ...prev };
        delete newState[questKey];
        return newState;
      });
      setTotalCompleted(prev => Math.max(0, prev - 1));
      
      // Удалить из истории
      setCompletionHistory(prev => {
        const newHistory = { ...prev };
        if (newHistory[today]) {
          newHistory[today] = newHistory[today].filter(c => !(c.category === category && c.level === currentQuest.level));
          if (newHistory[today].length === 0) {
            delete newHistory[today];
          }
        }
        return newHistory;
      });
      
      // Понизить уровень обратно
      setCategoryLevels(prev => ({
        ...prev,
        [category]: Math.max((prev[category] || 1) - 1, 1)
      }));
    } else {
      // Выполнить квест
      setCompletedToday(prev => ({
        ...prev,
        [questKey]: true
      }));
      
      setTotalCompleted(prev => prev + 1);
      
      // Добавить в историю
      setCompletionHistory(prev => ({
        ...prev,
        [today]: [
          ...(prev[today] || []),
          {
            category,
            questName: currentQuest.name,
            level: currentQuest.level,
            emoji: currentQuest.emoji
          }
        ]
      }));
      
      // Анимация
      setCelebrationQuest(category);
      setTimeout(() => setCelebrationQuest(null), 1500);
      
      // Вибрация
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      } else if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Повысить уровень квеста категории
      setCategoryLevels(prev => ({
        ...prev,
        [category]: Math.min((prev[category] || 1) + 1, 3)
      }));
      
      // Обновить streak
      const completedCount = Object.keys(completedToday).length;
      if (completedCount === 0 && lastCompletedDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toISOString().split('T')[0];
        
        if (lastCompletedDate === yesterdayKey) {
          setStreak(prev => prev + 1);
        } else if (!lastCompletedDate) {
          setStreak(1);
        }
        setLastCompletedDate(today);
      }
    }
  };

  const completedCount = Object.keys(completedToday).length;
  const totalQuests = Object.keys(CATEGORIES).length;
  const progress = (completedCount / totalQuests) * 100;
  const currentLevel = getCurrentLevel();
  const levelProgress = getProgressToNextLevel();

  const getMotivation = () => {
    if (completedCount === 0) return "";
    const index = Math.min(
      Math.floor((completedCount / totalQuests) * APP_CONFIG.motivationTexts.length),
      APP_CONFIG.motivationTexts.length - 1
    );
    return APP_CONFIG.motivationTexts[index];
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (showCalendar) {
    return (
      <CalendarView 
        completionHistory={completionHistory}
        onClose={() => setShowCalendar(false)}
        categories={CATEGORIES}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white pb-8">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-cyan-500/10 to-purple-600/20 blur-3xl" />
        
        <div className="relative px-5 pt-8 pb-6">
          {tgUser && (
            <p className="text-gray-400 text-sm mb-2">
              Привет, {tgUser.first_name}! 👋
            </p>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                {APP_CONFIG.title}
              </h1>
              <p className="text-gray-400 mt-1">{APP_CONFIG.subtitle}</p>
            </div>
            <Button
              onClick={() => setShowCalendar(true)}
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10"
            >
              <CalendarIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-5 -mt-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Level Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e2836] to-[#151c28] p-4 border border-white/5">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">{APP_CONFIG.levelLabel}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl">{currentLevel.icon}</span>
                <span className="text-lg font-semibold" style={{ color: currentLevel.color }}>
                  {currentLevel.name}
                </span>
              </div>
              <div className="mt-3">
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${levelProgress.progress}%`,
                      background: `linear-gradient(90deg, ${currentLevel.color}, ${levelProgress.nextLevel?.color || currentLevel.color})`
                    }}
                  />
                </div>
                {levelProgress.nextLevel && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    {levelProgress.remaining} до {levelProgress.nextLevel.icon}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Streak Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e2836] to-[#151c28] p-4 border border-white/5">
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">{APP_CONFIG.streakLabel}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-orange-400">{streak}</span>
                <span className="text-sm text-gray-500">дней</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Всего: {totalCompleted} квестов
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Progress */}
      <div className="px-5 mt-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#1e2836] to-[#151c28] p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" />
              <span className="font-medium">Квесты на сегодня</span>
            </div>
            <span className="text-sm px-3 py-1 rounded-full bg-white/5 text-gray-400">
              {completedCount}/{totalQuests}
            </span>
          </div>
          
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden mb-2">
            <div 
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{ 
                width: `${progress}%`,
                background: progress === 100 
                  ? 'linear-gradient(90deg, #6c5ce7, #00cec9, #fdcb6e)'
                  : 'linear-gradient(90deg, #6c5ce7, #00cec9)'
              }}
            />
            {progress === 100 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            )}
          </div>
          
          {getMotivation() && (
            <p className="text-sm text-center text-gray-400 mt-3 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              {getMotivation()}
            </p>
          )}
        </div>
      </div>

      {/* Quest Categories */}
      <div className="px-5 mt-6">
        <div className="space-y-4">
          {Object.entries(CATEGORIES).map(([categoryKey, categoryInfo]) => {
            const quest = getCurrentQuest(categoryKey);
            const isCompleted = completedToday[categoryKey];
            const isCelebrating = celebrationQuest === categoryKey;
            const Icon = categoryInfo.icon;
            
            return (
              <div key={categoryKey} className="space-y-2">
                {/* Category Header */}
                <div className="flex items-center gap-2 px-2">
                  <div className={`p-1.5 rounded-lg ${categoryInfo.bgColor}`}>
                    <Icon className={`w-4 h-4 ${categoryInfo.textColor}`} />
                  </div>
                  <span className={`text-sm font-medium ${categoryInfo.textColor}`}>
                    {categoryInfo.name}
                  </span>
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-xs text-gray-500">
                    Lvl {quest.level}
                  </span>
                </div>

                {/* Quest Card */}
                <div
                  onClick={() => toggleQuest(categoryKey)}
                  className={`
                    relative overflow-hidden rounded-2xl p-4 cursor-pointer
                    transition-all duration-300 ease-out border
                    ${isCompleted 
                      ? `${categoryInfo.bgColor} ${categoryInfo.borderColor}` 
                      : 'bg-[#1e2836] hover:bg-[#242f3d] border-white/5'
                    }
                    ${isCelebrating ? 'scale-[1.02]' : 'scale-100'}
                    active:scale-[0.98]
                  `}
                >
                  {isCelebrating && (
                    <div className={`absolute inset-0 ${categoryInfo.bgColor} animate-pulse`} />
                  )}
                  
                  <div className="relative flex items-center gap-4">
                    {/* Checkbox */}
                    <div className={`
                      relative w-7 h-7 rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${isCompleted 
                        ? categoryInfo.bgColor
                        : 'bg-white/5 border-2 border-white/10'
                      }
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className={`w-5 h-5 ${categoryInfo.textColor}`} />
                      ) : (
                        <Circle className="w-5 h-5 text-transparent" />
                      )}
                    </div>
                    
                    {/* Quest Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{quest.emoji}</span>
                        <span className={`
                          font-medium transition-all duration-300
                          ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}
                        `}>
                          {quest.name}
                        </span>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-sm
                      transition-all duration-300
                      ${isCompleted 
                        ? `${categoryInfo.bgColor} ${categoryInfo.textColor}` 
                        : 'bg-white/5 text-gray-500'
                      }
                    `}>
                      {isCompleted ? APP_CONFIG.completedText : APP_CONFIG.pendingText}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}