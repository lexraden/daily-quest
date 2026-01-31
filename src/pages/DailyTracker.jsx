import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Flame, Trophy, Zap, Star, Target, Clock, Sparkles } from 'lucide-react';

/* ============================================
   🎨 DESIGN CUSTOMIZATION SECTION
   ============================================
   Измените эти константы для кастомизации дизайна
*/

// Названия и тексты
const APP_CONFIG = {
  title: "Daily Tracker",
  subtitle: "Твой путь к успеху",
  streakLabel: "Серия",
  levelLabel: "Уровень",
  tasksLabel: "Задачи на сегодня",
  completedText: "Выполнено",
  pendingText: "Ожидает",
  motivationTexts: [
    "Отличное начало! 🚀",
    "Ты на верном пути! 💪",
    "Невероятный прогресс! ⭐",
    "Ты — чемпион! 🏆",
    "Легенда! 👑"
  ]
};

// Система уровней (измените пороги и названия)
const LEVELS = [
  { threshold: 0, name: "Новичок", icon: "🌱", color: "#6c5ce7" },
  { threshold: 10, name: "Ученик", icon: "📚", color: "#00cec9" },
  { threshold: 25, name: "Практик", icon: "⚡", color: "#fdcb6e" },
  { threshold: 50, name: "Мастер", icon: "🔥", color: "#e17055" },
  { threshold: 100, name: "Эксперт", icon: "💎", color: "#d63031" },
  { threshold: 200, name: "Легенда", icon: "👑", color: "#ffeaa7" }
];

// Дефолтные задачи (измените под свои нужды)
const DEFAULT_TASKS = [
  { id: 1, name: "Утренняя зарядка", emoji: "🏃" },
  { id: 2, name: "Выпить 2л воды", emoji: "💧" },
  { id: 3, name: "Чтение 30 минут", emoji: "📖" },
  { id: 4, name: "Медитация", emoji: "🧘" },
  { id: 5, name: "Прогулка", emoji: "🚶" }
];

/* ============================================
   END OF CUSTOMIZATION SECTION
   ============================================ */

export default function DailyTracker() {
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [completedToday, setCompletedToday] = useState({});
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tgUser, setTgUser] = useState(null);
  const [celebrationTask, setCelebrationTask] = useState(null);

  // Получить текущую дату в формате YYYY-MM-DD
  const getTodayKey = () => new Date().toISOString().split('T')[0];

  // Инициализация Telegram Web App
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Установка темы под Telegram
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
    const savedData = localStorage.getItem('dailyTrackerData');
    if (savedData) {
      const data = JSON.parse(savedData);
      setTotalCompleted(data.totalCompleted || 0);
      setStreak(data.streak || 0);
      setLastCompletedDate(data.lastCompletedDate || null);
      
      // Проверяем, сегодняшние ли данные
      const today = getTodayKey();
      if (data.completedToday && data.lastVisitDate === today) {
        setCompletedToday(data.completedToday);
      } else {
        // Новый день - сбрасываем задачи, проверяем streak
        if (data.lastVisitDate) {
          const lastVisit = new Date(data.lastVisitDate);
          const todayDate = new Date(today);
          const diffDays = Math.floor((todayDate - lastVisit) / (1000 * 60 * 60 * 24));
          
          if (diffDays > 1) {
            // Пропустили день - сбрасываем streak
            setStreak(0);
          }
        }
        setCompletedToday({});
      }
    }
    setIsLoaded(true);
  }, []);

  // Сохранение данных в localStorage
  useEffect(() => {
    if (!isLoaded) return;
    
    const data = {
      totalCompleted,
      streak,
      lastCompletedDate,
      completedToday,
      lastVisitDate: getTodayKey()
    };
    localStorage.setItem('dailyTrackerData', JSON.stringify(data));
  }, [totalCompleted, streak, lastCompletedDate, completedToday, isLoaded]);

  // Подсчёт текущего уровня
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

  // Отметка задачи
  const toggleTask = (taskId) => {
    const wasCompleted = completedToday[taskId];
    const today = getTodayKey();
    
    setCompletedToday(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));

    if (!wasCompleted) {
      // Задача выполнена
      setTotalCompleted(prev => prev + 1);
      setCelebrationTask(taskId);
      setTimeout(() => setCelebrationTask(null), 1500);
      
      // Обновляем streak если это первая задача за день
      const completedCount = Object.values(completedToday).filter(Boolean).length;
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
      
      // Telegram haptic feedback
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    } else {
      // Задача отменена
      setTotalCompleted(prev => Math.max(0, prev - 1));
    }
  };

  const completedCount = Object.values(completedToday).filter(Boolean).length;
  const progress = (completedCount / tasks.length) * 100;
  const currentLevel = getCurrentLevel();
  const levelProgress = getProgressToNextLevel();

  // Мотивационное сообщение
  const getMotivation = () => {
    const index = Math.min(
      Math.floor((completedCount / tasks.length) * APP_CONFIG.motivationTexts.length),
      APP_CONFIG.motivationTexts.length - 1
    );
    return completedCount > 0 ? APP_CONFIG.motivationTexts[index] : "";
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white pb-8">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-cyan-500/10 to-purple-600/20 blur-3xl" />
        
        <div className="relative px-5 pt-8 pb-6">
          {/* User greeting */}
          {tgUser && (
            <p className="text-gray-400 text-sm mb-2">
              Привет, {tgUser.first_name}! 👋
            </p>
          )}
          
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
            {APP_CONFIG.title}
          </h1>
          <p className="text-gray-400 mt-1">{APP_CONFIG.subtitle}</p>
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
              {/* Level Progress */}
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
                Всего: {totalCompleted} задач
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
              <span className="font-medium">{APP_CONFIG.tasksLabel}</span>
            </div>
            <span className="text-sm px-3 py-1 rounded-full bg-white/5 text-gray-400">
              {completedCount}/{tasks.length}
            </span>
          </div>
          
          {/* Progress Bar */}
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
          
          {/* Motivation */}
          {getMotivation() && (
            <p className="text-sm text-center text-gray-400 mt-3 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              {getMotivation()}
            </p>
          )}
        </div>
      </div>

      {/* Tasks List */}
      <div className="px-5 mt-6">
        <div className="space-y-3">
          {tasks.map((task, index) => {
            const isCompleted = completedToday[task.id];
            const isCelebrating = celebrationTask === task.id;
            
            return (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={`
                  relative overflow-hidden rounded-2xl p-4 cursor-pointer
                  transition-all duration-300 ease-out
                  ${isCompleted 
                    ? 'bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border-purple-500/30' 
                    : 'bg-[#1e2836] hover:bg-[#242f3d] border-white/5'
                  }
                  border
                  ${isCelebrating ? 'scale-[1.02]' : 'scale-100'}
                  active:scale-[0.98]
                `}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                {/* Celebration Effect */}
                {isCelebrating && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-purple-500/20 animate-pulse" />
                )}
                
                <div className="relative flex items-center gap-4">
                  {/* Checkbox */}
                  <div className={`
                    relative w-7 h-7 rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${isCompleted 
                      ? 'bg-gradient-to-br from-purple-500 to-cyan-500' 
                      : 'bg-white/5 border-2 border-white/10'
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <Circle className="w-5 h-5 text-transparent" />
                    )}
                  </div>
                  
                  {/* Task Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{task.emoji}</span>
                      <span className={`
                        font-medium transition-all duration-300
                        ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}
                      `}>
                        {task.name}
                      </span>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className={`
                    px-3 py-1 rounded-full text-xs font-medium
                    transition-all duration-300
                    ${isCompleted 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-white/5 text-gray-500'
                    }
                  `}>
                    {isCompleted ? APP_CONFIG.completedText : APP_CONFIG.pendingText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="px-5 mt-8">
        <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Обновится завтра</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span>{totalCompleted} всего</span>
          </div>
        </div>
      </div>

      {/* Telegram Integration Instructions (hidden comment for developers) */}
      {/* 
        ============================================
        📱 TELEGRAM WEB APP INTEGRATION
        ============================================
        
        1. Создайте бота через @BotFather
        2. Отправьте команду /newapp или /mybots -> выберите бота -> Bot Settings -> Menu Button
        3. Укажите URL вашего приложения (Vercel/Netlify)
        4. Telegram Web App API автоматически инициализируется
        
        Доступные методы Telegram:
        - window.Telegram.WebApp.ready() - сигнал о готовности
        - window.Telegram.WebApp.expand() - развернуть на весь экран
        - window.Telegram.WebApp.close() - закрыть приложение
        - window.Telegram.WebApp.MainButton - управление главной кнопкой
        - window.Telegram.WebApp.HapticFeedback - вибрация
        
        Для тестирования используйте @WebAppBot
      */}

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