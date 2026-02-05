import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Flame, Trophy, Calendar as CalendarIcon, Target, Sparkles, Heart, Brain, Briefcase, DollarSign, Users, Activity, User, Lock, Download, Shield, TrendingUp, Camera, Footprints, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CalendarView from '@/components/daily/CalendarView.jsx';
import PremiumModal from '@/components/daily/PremiumModal.jsx';
import SwipeableQuestCard from '@/components/daily/SwipeableQuestCard.jsx';
import CategoryProgressModal from '@/components/daily/CategoryProgressModal.jsx';
import VoiceQuestInput from '@/components/daily/VoiceQuestInput.jsx';
import QuestSuggestionModal from '@/components/daily/QuestSuggestionModal.jsx';
import MotivationalBanner from '@/components/daily/MotivationalBanner.jsx';
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

// Система уровней (прогрессивная как в RPG)
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

/* ============================================
   END OF CUSTOMIZATION SECTION
   ============================================ */

export default function DailyTracker() {
  const [questData, setQuestData] = useState(DEFAULT_QUEST_DATA);
  const [categoryLevels, setCategoryLevels] = useState({});
  const [categoryTotalCompleted, setCategoryTotalCompleted] = useState({});
  const [completedToday, setCompletedToday] = useState({});
  const [completionHistory, setCompletionHistory] = useState({});
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tgUser, setTgUser] = useState(null);
  const [celebrationQuest, setCelebrationQuest] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [streakFreezes, setStreakFreezes] = useState(1);
  const [showPremium, setShowPremium] = useState(false);
  const [theme, setTheme] = useState('light');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [questSuggestion, setQuestSuggestion] = useState(null);

  const getTodayKey = () => new Date().toISOString().split('T')[0];

  // Инициализация Telegram Web App и темы
  useEffect(() => {
    // Загрузка темы из localStorage (по умолчанию 'light')
    const savedTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(savedTheme);
    
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user);
      }
    }
  }, []);

  // Сохранение темы
  useEffect(() => {
    localStorage.setItem('dailyQuestsTheme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleSaveQuest = (categoryKey, questLevel, updatedData) => {
    setQuestData(prev => ({
      ...prev,
      [categoryKey]: prev[categoryKey].map(q => 
        q.level === questLevel ? { ...q, ...updatedData } : q
      )
    }));
  };

  const handleQuestSuggestion = (suggestion) => {
    setQuestSuggestion(suggestion);
  };

  const handleAcceptSuggestion = (suggestion) => {
    const { category, emoji, name, level, action } = suggestion;

    if (action === 'add' || action === 'replace') {
      // Find the highest level and add new quest
      const highestLevel = Math.max(...questData[category].map(q => q.level));
      const newLevel = level || highestLevel + 1;

      setQuestData(prev => ({
        ...prev,
        [category]: [...prev[category], { level: newLevel, name, emoji }]
      }));
    } else if (action === 'edit') {
      // Edit existing quest
      const targetLevel = level || categoryLevels[category] || 1;
      handleSaveQuest(category, targetLevel, { emoji, name });
    }

    setQuestSuggestion(null);
  };

  const handleRejectSuggestion = () => {
    setQuestSuggestion(null);
  };

  // Загрузка данных из localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('dailyQuestsData');
    const today = getTodayKey();
    
    if (savedData) {
      const data = JSON.parse(savedData);
      
      // Загрузка кастомных квестов
      if (data.questData) {
        setQuestData(data.questData);
      }
      
      // Инициализация уровней категорий
      const levels = {};
      const totals = {};
      Object.keys(CATEGORIES).forEach(cat => {
        levels[cat] = data.categoryLevels?.[cat] || 1;
        totals[cat] = data.categoryTotalCompleted?.[cat] || 0;
      });
      setCategoryLevels(levels);
      setCategoryTotalCompleted(totals);
      
      setTotalCompleted(data.totalCompleted || 0);
      setCompletionHistory(data.completionHistory || {});
      setStreakFreezes(data.streakFreezes ?? 1);
      
      // Проверка нового дня
      if (data.lastVisitDate !== today) {
        // Новый день начался!
        const lastVisit = new Date(data.lastVisitDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate - lastVisit) / (1000 * 60 * 60 * 24));
        
        // Проверяем был ли прогресс вчера
        const yesterdayKey = new Date(todayDate - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const hadProgressYesterday = data.completionHistory?.[yesterdayKey]?.length > 0;
        
        if (diffDays === 1 && hadProgressYesterday) {
          // Продолжаем streak
          setStreak(data.streak + 1);
        } else if (diffDays === 1 && !hadProgressYesterday) {
          // Пропустили день
          if (data.streakFreezes > 0) {
            // Используем freeze
            setStreak(data.streak);
            setStreakFreezes(data.streakFreezes - 1);
          } else {
            setStreak(0);
          }
        } else if (diffDays > 1) {
          // Пропустили больше дня - сбрасываем
          setStreak(0);
        } else {
          setStreak(data.streak || 0);
        }
        
        setLastCompletedDate(data.lastCompletedDate || null);
        setCompletedToday({});
      } else {
        // Тот же день
        setStreak(data.streak || 0);
        setLastCompletedDate(data.lastCompletedDate || null);
        setCompletedToday(data.completedToday || {});
      }
    } else {
      // Инициализация для новых пользователей
      const levels = {};
      const totals = {};
      Object.keys(CATEGORIES).forEach(cat => {
        levels[cat] = 1;
        totals[cat] = 0;
      });
      setCategoryLevels(levels);
      setCategoryTotalCompleted(totals);
    }
    setIsLoaded(true);
  }, []);

  // Сохранение данных
  useEffect(() => {
    if (!isLoaded) return;
    
    const data = {
      questData,
      categoryLevels,
      categoryTotalCompleted,
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
      categoryTotalCompleted,
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
  const toggleQuest = (category, level = null) => {
    const currentQuest = level ? questData[category].find(q => q.level === level) : getCurrentQuest(category);
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
      
      // Понизить счетчик категории
      setCategoryTotalCompleted(prev => ({
        ...prev,
        [category]: Math.max((prev[category] || 0) - 1, 0)
      }));
      
      // Пересчитать уровень категории
      const newTotal = Math.max((categoryTotalCompleted[category] || 0) - 1, 0);
      const newLevel = Math.floor(newTotal / 10) + 1; // Каждые 10 квестов = +1 уровень
      setCategoryLevels(prev => ({
        ...prev,
        [category]: Math.max(newLevel, 1)
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
      
      // Повысить счетчик категории
      setCategoryTotalCompleted(prev => ({
        ...prev,
        [category]: (prev[category] || 0) + 1
      }));
      
      // Пересчитать уровень категории
      const newTotal = (categoryTotalCompleted[category] || 0) + 1;
      const newLevel = Math.floor(newTotal / 10) + 1; // Каждые 10 квестов = +1 уровень
      setCategoryLevels(prev => ({
        ...prev,
        [category]: newLevel
      }));
      
      // Обновить streak
      // Обновляем lastCompletedDate при первом выполнении за день
      if (lastCompletedDate !== today) {
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
        theme={theme}
      />
    );
  }

  const bgClass = theme === 'light' 
    ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
    : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white';

  return (
    <div className={`min-h-screen ${bgClass} pb-8`}>
      {/* Compact Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Daily Quests</h1>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('Profile')}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <User className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              onClick={() => setShowCalendar(true)}
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 mb-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{currentLevel.icon}</span>
            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>{currentLevel.name}</span>
          </div>
          <div className={`w-px h-4 ${theme === 'light' ? 'bg-black/10' : 'bg-white/10'}`} />
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className={`font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{streak}</span>
            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>дней</span>
          </div>
          {streakFreezes > 0 && (
            <>
              <div className={`w-px h-4 ${theme === 'light' ? 'bg-black/10' : 'bg-white/10'}`} />
              <div className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs text-cyan-400">{streakFreezes}</span>
              </div>
            </>
          )}
        </div>

        {/* Level Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`font-semibold ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>
                Level {currentLevel.level}
              </span>
              <span className={theme === 'light' ? 'text-gray-500' : 'text-gray-500'}>
                {totalCompleted} XP
              </span>
            </div>
            {levelProgress.nextLevel && (
              <div className="flex items-center gap-1.5">
                <span className={theme === 'light' ? 'text-gray-500' : 'text-gray-500'}>
                  {levelProgress.remaining} до
                </span>
                <span className={`font-semibold ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}>
                  Level {levelProgress.nextLevel.level}
                </span>
              </div>
            )}
          </div>
          <div className={`relative h-3 rounded-full overflow-hidden ${theme === 'light' ? 'bg-black/5' : 'bg-white/5'}`}>
            <div 
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{ 
                width: `${levelProgress.progress}%`,
                background: levelProgress.progress === 100
                  ? 'linear-gradient(90deg, #6c5ce7, #00cec9, #fdcb6e)'
                  : 'linear-gradient(90deg, #6c5ce7, #a29bfe, #00cec9)'
              }}
            />
            {levelProgress.progress === 100 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {/* Daily Progress */}
        <div className={`space-y-2 mt-3 pt-3 border-t ${theme === 'light' ? 'border-black/5' : 'border-white/5'}`}>
          <div className="flex items-center justify-between text-xs">
            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Прогресс дня</span>
            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>{completedCount}/{totalQuests}</span>
          </div>
          <div className={`relative h-2 rounded-full overflow-hidden ${theme === 'light' ? 'bg-black/5' : 'bg-white/5'}`}>
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

        {/* Motivational Banner */}
        <MotivationalBanner 
          userName={tgUser?.first_name}
          completedCount={completedCount}
          theme={theme}
        />

        {/* Voice Quest Input */}
        <VoiceQuestInput 
          onQuestSuggestion={handleQuestSuggestion}
          theme={theme}
        />

        {/* Quest Categories */}
        <div className="px-5 mt-1">
        <div className="space-y-3">
          {Object.entries(CATEGORIES).map(([categoryKey, categoryInfo]) => (
            <SwipeableQuestCard
              key={categoryKey}
              categoryKey={categoryKey}
              categoryInfo={categoryInfo}
              quests={questData[categoryKey]}
              completedToday={completedToday}
              onToggleQuest={toggleQuest}
              celebrationQuest={celebrationQuest}
              completedText={APP_CONFIG.completedText}
              pendingText={APP_CONFIG.pendingText}
              theme={theme}
              categoryLevel={categoryLevels[categoryKey] || 1}
              onCategoryClick={() => setSelectedCategory(categoryKey)}
              onSaveQuest={handleSaveQuest}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-5 mt-6 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={exportData}
            variant="outline"
            className={theme === 'light' 
              ? 'border-gray-200 hover:bg-gray-50 text-gray-700'
              : 'border-white/10 hover:bg-white/5 text-gray-300'
            }
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

      {/* Premium Modal */}
      {showPremium && (
        <PremiumModal onClose={() => setShowPremium(false)} />
      )}

      {/* Category Progress Modal */}
      {selectedCategory && (
        <CategoryProgressModal
          category={selectedCategory}
          categoryInfo={CATEGORIES[selectedCategory]}
          totalCompleted={categoryTotalCompleted[selectedCategory] || 0}
          currentLevel={categoryLevels[selectedCategory] || 1}
          completionHistory={completionHistory}
          onClose={() => setSelectedCategory(null)}
          theme={theme}
        />
      )}

      {/* Quest Suggestion Modal */}
      {questSuggestion && (
        <QuestSuggestionModal
          suggestion={questSuggestion}
          categories={CATEGORIES}
          onAccept={handleAcceptSuggestion}
          onReject={handleRejectSuggestion}
          theme={theme}
        />
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