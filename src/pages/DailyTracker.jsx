import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Flame, Trophy, Calendar as CalendarIcon, Target, Sparkles, Heart, Brain, Briefcase, DollarSign, Users, Activity, Edit, Lock, Download, Shield, TrendingUp, Camera, Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CalendarView from '@/components/daily/CalendarView.jsx';
import QuestEditor from '@/components/daily/QuestEditor.jsx';
import PremiumModal from '@/components/daily/PremiumModal.jsx';
import confetti from 'canvas-confetti';

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

// Квесты по умолчанию (будут загружены из localStorage или использованы эти)
const DEFAULT_QUEST_DATA = {
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
  const [questData, setQuestData] = useState(DEFAULT_QUEST_DATA);
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
  const [showEditor, setShowEditor] = useState(false);
  const [streakFreezes, setStreakFreezes] = useState(1);
  const [showPremium, setShowPremium] = useState(false);

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
      
      // Загрузка кастомных квестов
      if (data.questData) {
        setQuestData(data.questData);
      }
      
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
      setStreakFreezes(data.streakFreezes ?? 1);
      
      const today = getTodayKey();
      if (data.completedToday && data.lastVisitDate === today) {
        setCompletedToday(data.completedToday);
      } else {
        if (data.lastVisitDate) {
          const lastVisit = new Date(data.lastVisitDate);
          const todayDate = new Date(today);
          const diffDays = Math.floor((todayDate - lastVisit) / (1000 * 60 * 60 * 24));
          
          if (diffDays > 1) {
            // Защита стрика - используем freeze если есть
            if (data.streakFreezes > 0 && diffDays === 2) {
              setStreakFreezes(prev => prev - 1);
            } else if (diffDays > 2 || data.streakFreezes === 0) {
              setStreak(0);
            }
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
      questData,
      categoryLevels,
      totalCompleted,
      streak,
      lastCompletedDate,
      completedToday,
      completionHistory,
      streakFreezes,
      lastVisitDate: getTodayKey()
    };
    localStorage.setItem('dailyQuestsData', JSON.stringify(data));
  }, [questData, categoryLevels, totalCompleted, streak, lastCompletedDate, completedToday, completionHistory, streakFreezes, isLoaded]);

  // Экспорт данных
  const exportData = () => {
    const data = {
      questData,
      categoryLevels,
      totalCompleted,
      streak,
      streakFreezes,
      completionHistory,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-quests-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Получить текущий квест для категории
  const getCurrentQuest = (category) => {
    const level = categoryLevels[category] || 1;
    const quests = questData[category];
    const quest = quests.find(q => q.level === level) || quests[quests.length - 1];
    return { ...quest, category };
  };

  // Конфетти
  const fireConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 }
    };

    function fire(particleRatio, opts) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
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
      
      // Конфетти
      fireConfetti();
      
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
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e2836] to-[#151c28] p-3 border border-white/5">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">{APP_CONFIG.levelLabel}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl">{currentLevel.icon}</span>
                <span className="text-base font-semibold" style={{ color: currentLevel.color }}>
                  {currentLevel.name}
                </span>
              </div>
            </div>
          </div>

          {/* Streak Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e2836] to-[#151c28] p-3 border border-white/5">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">{APP_CONFIG.streakLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-orange-400">{streak}</span>
                  <span className="text-sm text-gray-500">дней</span>
                </div>
                {streakFreezes > 0 && (
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-cyan-400" />
                    <span className="text-xs text-cyan-400">{streakFreezes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Progress */}
      <div className="px-5 mt-4">
        <div className="rounded-xl bg-gradient-to-br from-[#1e2836] to-[#151c28] p-4 border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium">Прогресс</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-gray-400">
              {completedCount}/{totalQuests}
            </span>
          </div>
          
          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
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
        </div>
      </div>

      {/* Quest Categories */}
      <div className="px-5 mt-4">
        <div className="space-y-3">
          {Object.entries(CATEGORIES).map(([categoryKey, categoryInfo]) => {
            const quest = getCurrentQuest(categoryKey);
            const questKey = `${categoryKey}_${quest.level}`;
            const isCompleted = completedToday[questKey];
            const isCelebrating = celebrationQuest === categoryKey;
            const Icon = categoryInfo.icon;
            
            return (
              <div key={categoryKey} className="space-y-2">
                {/* Category Header */}
                <div className="flex items-center gap-2 px-1">
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
                    relative overflow-hidden rounded-2xl p-5 cursor-pointer
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
                      relative w-9 h-9 rounded-full flex items-center justify-center
                      transition-all duration-300 flex-shrink-0
                      ${isCompleted 
                        ? categoryInfo.bgColor
                        : 'bg-white/5 border-2 border-white/10'
                      }
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className={`w-6 h-6 ${categoryInfo.textColor}`} />
                      ) : (
                        <Circle className="w-6 h-6 text-transparent" />
                      )}
                    </div>
                    
                    {/* Quest Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{quest.emoji}</span>
                        <span className={`
                          text-base font-medium transition-all duration-300
                          ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}
                        `}>
                          {quest.name}
                        </span>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className={`
                      w-7 h-7 rounded-full flex items-center justify-center text-base font-medium flex-shrink-0
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

      {/* Action Buttons */}
      <div className="px-5 mt-6 space-y-3 pb-4">
        <Button
          onClick={() => setShowEditor(true)}
          variant="outline"
          className="w-full border-white/10 hover:bg-white/5 text-gray-300"
        >
          <Edit className="w-4 h-4 mr-2" />
          Редактировать квесты
        </Button>
        
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={exportData}
            variant="outline"
            className="border-white/10 hover:bg-white/5 text-gray-300"
          >
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
          <Button
            onClick={() => setShowPremium(true)}
            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            <Lock className="w-4 h-4 mr-2" />
            Premium
          </Button>
        </div>
      </div>

      {/* Quest Editor Modal */}
      {showEditor && (
        <QuestEditor
          questData={questData}
          categories={CATEGORIES}
          onSave={setQuestData}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Premium Modal */}
      {showPremium && (
        <PremiumModal onClose={() => setShowPremium(false)} />
      )}

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