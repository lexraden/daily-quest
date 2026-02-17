import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Flame, Trophy, Calendar as CalendarIcon, Target, Sparkles, Heart, Brain, Briefcase, DollarSign, Users, Activity, User, Lock, Download, Shield, TrendingUp, Camera, Footprints, Sun, Moon, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
// CalendarView replaced by History page
import PremiumModal from '@/components/daily/PremiumModal.jsx';
import SwipeableQuestCard from '@/components/daily/SwipeableQuestCard.jsx';
import CategoryProgressModal from '@/components/daily/CategoryProgressModal.jsx';
import VoiceQuestInput from '@/components/daily/VoiceQuestInput.jsx';
import QuestSuggestionModal from '@/components/daily/QuestSuggestionModal.jsx';
import MotivationalBanner from '@/components/daily/MotivationalBanner.jsx';
import AIResponseModal from '@/components/daily/AIResponseModal.jsx';
import OnboardingModal from '@/components/daily/OnboardingModal.jsx';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { getCachedUser, getCachedUserData, updateCachedUserData, setCachedUser } from '@/components/UserDataCache';

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
  money: { 
    name: "Money", 
    icon: DollarSign, 
    color: "#00cec9",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    textColor: "text-cyan-400"
  },
  work: { 
    name: "Work", 
    icon: Briefcase, 
    color: "#fdcb6e",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    textColor: "text-yellow-400"
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
  money: [
    { level: 1, name: "Проверить расходы", emoji: "💳" },
    { level: 2, name: "Отложить 10%", emoji: "💰" },
    { level: 3, name: "Инвестировать", emoji: "📈" }
  ],
  work: [
    { level: 1, name: "План на день", emoji: "📝" },
    { level: 2, name: "Фокус-сессия 1 час", emoji: "⏰" },
    { level: 3, name: "Завершить проект", emoji: "🎯" }
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
  // showCalendar removed - using History page now
  const [streakFreezes, setStreakFreezes] = useState(1);
  const [showPremium, setShowPremium] = useState(false);
  const [theme, setTheme] = useState('light');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [questSuggestion, setQuestSuggestion] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [aiResponse, setAiResponse] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [user, setUser] = useState(null);
  const [userDataId, setUserDataId] = useState(null);

  const getTodayKey = () => new Date().toISOString().split('T')[0];

  // Инициализация Telegram Web App и темы
  useEffect(() => {
    // Загрузка темы из localStorage (по умолчанию 'light')
    const savedTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(savedTheme);

    // Load authenticated user and save name on first login
    // Initialize Telegram WebApp FIRST (before async code)
        if (window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          tg.ready();
          tg.expand();

          if (tg.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
          }
        }

        const loadUser = async () => {
          try {
            const isAuth = await base44.auth.isAuthenticated();
            if (!isAuth) {
              setIsLoaded(true);
              return;
            }
            const authUser = await getCachedUser();
            if (authUser) {
              setCachedUser(authUser);
              setUser(authUser);

              // Auto-save user name on first login if not set
              if (!authUser.full_name) {
                const name = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || authUser.email?.split('@')[0] || 'Пользователь';
                await base44.auth.updateMe({ full_name: name }).catch(err => {
                  console.log('Failed to save user name:', err);
                });
              }

              // Save telegram chat ID for notifications
              if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
                const tgUserId = String(window.Telegram.WebApp.initDataUnsafe.user.id);
                const savedChatId = authUser.telegram_chat_id;
                if (!savedChatId || savedChatId !== tgUserId) {
                  localStorage.setItem('telegram_chat_id', tgUserId);
                  await base44.auth.updateMe({ telegram_chat_id: tgUserId }).catch(err => {
                    console.log('Failed to save telegram_chat_id:', err);
                  });
                }
              }
            }
          } catch (error) {
            console.error('Auth error:', error);
            setIsLoaded(true);
          }
        };

        loadUser();

        // Reload user on focus to get updated name
        const handleFocus = () => loadUser();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
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
    // Показать модал с AI ответом
    setAiResponse(suggestion);
  };

  const handleAcceptAiResponse = () => {
    const { intent, category, emoji, name, description, action, level } = aiResponse;

    if (intent === 'DELETE_QUEST') {
          // Найти квест по имени
          const categoryQuests = questData[category] || [];
          const questName = (name || '').toLowerCase().trim();

          // Ищем по точному совпадению имени сначала
          let questIndex = categoryQuests.findIndex(q => 
            q.name.toLowerCase().trim() === questName
          );

          // Если не нашли точно — ищем по частичному совпадению (но только один)
          if (questIndex === -1 && questName) {
            const matches = categoryQuests
              .map((q, i) => ({ q, i }))
              .filter(({ q }) => 
                q.name.toLowerCase().includes(questName) || questName.includes(q.name.toLowerCase())
              );
            if (matches.length === 1) {
              questIndex = matches[0].i;
            }
          }

          // Если не нашли по имени — по уровню
          if (questIndex === -1 && level) {
            questIndex = categoryQuests.findIndex(q => q.level === level);
          }

          if (questIndex !== -1) {
            setQuestData(prev => ({
              ...prev,
              [category]: prev[category].filter((_, i) => i !== questIndex)
            }));
            toast.success(aiResponse.message || 'Квест удалён! 🗑️');
          } else {
            toast.error('Квест не найден');
          }
        } else if (intent === 'COMPLETED_QUEST') {
      // Найти подходящий квест в текущей категории
      const categoryQuests = questData[category] || [];
      const currentQuest = getCurrentQuest(category);
      const userInput = (aiResponse.userInput || '').toLowerCase();
      
      // Попробовать найти квест по тексту пользователя
      let foundQuest = null;
      for (const quest of categoryQuests) {
        const questKey = `${category}_${quest.level}`;
        const questName = quest.name.toLowerCase();
        const isCompleted = completedToday[questKey];
        
        // Проверяем совпадение с пользовательским вводом и что квест еще не выполнен
        if (!isCompleted && (
          userInput.includes(questName) || 
          questName.includes(userInput) ||
          quest.level === currentQuest.level
        )) {
          foundQuest = quest;
          break;
        }
      }
      
      // Отметить найденный квест или текущий
      const questToComplete = foundQuest || currentQuest;
      toggleQuest(category, questToComplete.level);
      
      // Добавить в журнал
      const today = getTodayKey();
      const newEntry = {
        id: Date.now(),
        date: today,
        category,
        emoji,
        text: description || name,
        rawText: aiResponse.userInput || '',
        type: 'quest_completed',
        questLevel: questToComplete.level,
        timestamp: new Date().toISOString()
      };
      setJournalEntries(prev => [newEntry, ...prev]);
      
      toast.success(aiResponse.message || 'Квест выполнен! 🎉');
    } else if (intent === 'ADD_QUEST') {
      // Добавить новый квест
      setQuestSuggestion(aiResponse);
    } else if (intent === 'JOURNAL') {
      // Добавить заметку в журнал
      const today = getTodayKey();
      const newEntry = {
        id: Date.now(),
        date: today,
        category,
        emoji,
        text: description || name,
        rawText: aiResponse.userInput || '',
        type: 'journal',
        timestamp: new Date().toISOString()
      };
      setJournalEntries(prev => [newEntry, ...prev]);
      
      toast.success(aiResponse.message || 'Заметка добавлена! 📝');
    }

    setAiResponse(null);
  };

  const handleRejectAiResponse = () => {
    setAiResponse(null);
  };

  const handleOnboardingComplete = async (answers) => {
    try {
      // Send welcome message to Telegram
      const telegram_chat_id = localStorage.getItem('telegram_chat_id');
      if (telegram_chat_id) {
        try {
          await base44.functions.invoke('sendDailyReminder', {
            telegram_chat_id,
            message: `
  🎉 <b>Great job!</b>

  You now have your personalized daily quests to level up your life! 💪

  ✅ Health, Mind, Work, Money, Love, Friends
  🔥 Build your streak every day
  📈 Track your progress and grow

  Let's start your journey! 🚀
            `.trim()
          });
        } catch (error) {
          console.log('Failed to send Telegram message:', error);
        }
      }

      // Generate personalized quests using AI
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Ты - эксперт по персональному развитию. На основе ответов пользователя создай персонализированные ЕЖЕДНЕВНЫЕ квесты для daily tracker.

Ответы пользователя:
${Object.entries(answers).map(([cat, answer]) => `${cat}: ${answer}`).join('\n')}

ВАЖНО: Квесты должны быть ЕЖЕДНЕВНЫМИ действиями, которые можно выполнять каждый день, а НЕ долгосрочными целями!
❌ Неправильно: "Сбросить 5кг", "Получить повышение", "Купить квартиру"
✅ Правильно: "Пробежать 3км", "Выполнить задачу на работе", "Отложить 500₽"

Для каждой категории создай РОВНО 3 ЕЖЕДНЕВНЫХ квеста, СТРОГО отсортированных по уровню сложности:
- Level 1 (самый лёгкий, +1 XP): простое базовое действие на каждый день
- Level 2 (средний, +2 XP): требует больше усилий, но выполнимо ежедневно
- Level 3 (самый сложный, +3 XP): амбициозное ежедневное действие

ВАЖНО: Квесты ОБЯЗАТЕЛЬНО должны идти в порядке level=1, level=2, level=3 по возрастанию сложности!

Категории:
- health: физическая активность, спорт, здоровье
- mind: обучение, медитация, чтение
- work: рабочие задачи, проекты
- money: финансовые привычки, накопления
- love: романтические отношения, время с партнером/любимым человеком
- friends: общение с друзьями, социализация

Квесты должны быть:
- ЕЖЕДНЕВНЫМИ действиями
- Конкретными и измеримыми
- Подходящими под ситуацию пользователя
- Реалистичными для ежедневного выполнения
- Мотивирующими
- Короткими (до 30 символов)
- БЕЗ эмодзи в названии (эмодзи только в поле emoji)

ВАЖНО для категории money:
- НЕ указывай конкретные суммы или валюты (₽, $, 500₽, 10%)
- Используй общие формулировки ("отложить часть дохода", "проверить бюджет")

Подбери подходящие эмодзи для каждого квеста (эмодзи отдельно, не в названии).`,
        response_json_schema: {
          type: "object",
          properties: {
            health: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "number" },
                  emoji: { type: "string" },
                  name: { type: "string" }
                },
                required: ["level", "emoji", "name"]
              }
            },
            mind: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "number" },
                  emoji: { type: "string" },
                  name: { type: "string" }
                },
                required: ["level", "emoji", "name"]
              }
            },
            work: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "number" },
                  emoji: { type: "string" },
                  name: { type: "string" }
                },
                required: ["level", "emoji", "name"]
              }
            },
            money: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "number" },
                  emoji: { type: "string" },
                  name: { type: "string" }
                },
                required: ["level", "emoji", "name"]
              }
            },
            love: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "number" },
                  emoji: { type: "string" },
                  name: { type: "string" }
                },
                required: ["level", "emoji", "name"]
              }
            },
            friends: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "number" },
                  emoji: { type: "string" },
                  name: { type: "string" }
                },
                required: ["level", "emoji", "name"]
              }
            }
          },
          required: ["health", "mind", "work", "money", "love", "friends"]
        }
        });

        // Update quests with AI-generated ones
        setQuestData(result);

        // Check if we need to delete old data (reset scenario)
        const userDataList = await base44.entities.UserQuestData.filter({ created_by: user?.email });
        if (userDataList.length > 0) {
        await base44.asServiceRole.entities.UserQuestData.delete(userDataList[0].id);
        }

        // Create new user data record after onboarding
        const newUserData = await base44.entities.UserQuestData.create({
        quest_data: result,
        onboarding_answers: answers,
        category_levels: Object.keys(CATEGORIES).reduce((acc, cat) => ({ ...acc, [cat]: 1 }), {}),
        category_total_completed: Object.keys(CATEGORIES).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {}),
        total_completed: 0,
        streak: 0,
        completion_history: {},
        streak_freezes: 1,
        journal_entries: [],
        last_visit_date: getTodayKey()
        });
        setUserDataId(newUserData.id);

        setShowOnboarding(false);
        toast.success('Ваши персональные квесты готовы! 🎉');
        } catch (error) {
        console.error('Error generating quests:', error);
        toast.error('Ошибка при создании квестов. Используем стандартные.');
        setShowOnboarding(false);
        }
        };

  const handleAcceptSuggestion = (suggestion) => {
    const { category, emoji, name, level, action } = suggestion;

    if (action === 'add' || action === 'replace') {
      // Generate a unique level that doesn't conflict with existing quests
      const existingLevels = questData[category].map(q => q.level);
      let newLevel = level || (Math.max(...existingLevels, 0) + 1);
      while (existingLevels.includes(newLevel)) {
        newLevel++;
      }

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

  // Загрузка данных из базы данных
  useEffect(() => {
    const loadUserData = async () => {
      const today = getTodayKey();
      
      try {
        // Загрузить данные пользователя из БД
        if (!user?.email) {
          throw new Error('User email not available');
        }
        
        const { data: cachedData, id: cachedId } = await getCachedUserData(user.email);
        
        // Проверяем флаг ресета из localStorage
        const shouldResetOnboarding = localStorage.getItem('dailyQuestsResetOnboarding');
        
        if (cachedData && !shouldResetOnboarding) {
          const data = cachedData;
          setUserDataId(cachedId);
          
          // Загрузка кастомных квестов
          if (data.quest_data) {
            setQuestData(data.quest_data);
          }

          // Загрузка заметок
          if (data.journal_entries) {
            setJournalEntries(data.journal_entries);
          }
          
          // Инициализация уровней категорий
          const levels = {};
          const totals = {};
          Object.keys(CATEGORIES).forEach(cat => {
            levels[cat] = data.category_levels?.[cat] || 1;
            totals[cat] = data.category_total_completed?.[cat] || 0;
          });
          setCategoryLevels(levels);
          setCategoryTotalCompleted(totals);
          
          setTotalCompleted(data.total_completed || 0);
          setCompletionHistory(data.completion_history || {});
          setStreakFreezes(data.streak_freezes ?? 1);
          
          // Проверка нового дня
          if (data.last_visit_date !== today) {
            // Новый день начался!
            const lastVisit = new Date(data.last_visit_date);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate - lastVisit) / (1000 * 60 * 60 * 24));
            
            // Проверяем был ли прогресс вчера
            const yesterdayKey = new Date(todayDate - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const hadProgressYesterday = data.completion_history?.[yesterdayKey]?.length > 0;
            
            if (diffDays === 1 && hadProgressYesterday) {
              // Продолжаем streak
              setStreak(data.streak + 1);
            } else if (diffDays === 1 && !hadProgressYesterday) {
              // Пропустили день
              if (data.streak_freezes > 0) {
                // Используем freeze
                setStreak(data.streak);
                setStreakFreezes(data.streak_freezes - 1);
              } else {
                setStreak(0);
              }
            } else if (diffDays > 1) {
              // Пропустили больше дня - сбрасываем
              setStreak(0);
            } else {
              setStreak(data.streak || 0);
            }
            
            setLastCompletedDate(data.last_completed_date || null);
            setCompletedToday({});
          } else {
            // Тот же день
            setStreak(data.streak || 0);
            setLastCompletedDate(data.last_completed_date || null);
            
            // Восстановить completedToday из истории сегодняшнего дня
            const todayHistory = data.completion_history?.[today] || [];
            const todayCompleted = {};
            todayHistory.forEach(quest => {
              todayCompleted[`${quest.category}_${quest.level}`] = true;
            });
            setCompletedToday(todayCompleted);
          }
          } else if (!cachedData || shouldResetOnboarding) {
          // Новый пользователь или ресет онбординга - показать онбординг
          localStorage.removeItem('dailyQuestsResetOnboarding');
          localStorage.removeItem('dailyQuestsOnboardingCompleted');
          setShowOnboarding(true);
          setIsLoaded(true);
          return; // Не создаем запись до завершения онбординга
          }
      } catch (error) {
        console.error('Error loading user data:', error);
        toast.error('Ошибка загрузки данных');
      }

      setIsLoaded(true);
      };

      if (user?.email) {
      loadUserData();
      }
      }, [user]);

  // Сохранение данных в БД
  useEffect(() => {
    if (!isLoaded || !userDataId) return;
    
    const saveData = async () => {
      try {
        const dataToSave = {
          quest_data: questData,
          category_levels: categoryLevels,
          category_total_completed: categoryTotalCompleted,
          total_completed: totalCompleted,
          streak,
          last_completed_date: lastCompletedDate,
          completion_history: completionHistory,
          streak_freezes: streakFreezes,
          journal_entries: journalEntries,
          last_visit_date: getTodayKey()
        };
        updateCachedUserData(userDataId, dataToSave);
        await base44.entities.UserQuestData.update(userDataId, dataToSave);
      } catch (error) {
        console.error('Error saving user data:', error);
      }
    };
    
    saveData();
  }, [questData, categoryLevels, categoryTotalCompleted, totalCompleted, streak, lastCompletedDate, completedToday, completionHistory, streakFreezes, journalEntries, isLoaded, userDataId]);

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
      const xpToRemove = currentQuest.level || 1;
      setCompletedToday(prev => {
        const newState = { ...prev };
        delete newState[questKey];
        return newState;
      });
      setTotalCompleted(prev => Math.max(0, prev - xpToRemove));
      
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
        [category]: Math.max((prev[category] || 0) - xpToRemove, 0)
      }));
      
      // Пересчитать уровень категории
      const newTotal = Math.max((categoryTotalCompleted[category] || 0) - xpToRemove, 0);
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
      
      const xpToAdd = currentQuest.level || 1;
      setTotalCompleted(prev => prev + xpToAdd);
      
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

      // Звук
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const celebrationSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      };
      try { celebrationSound(); } catch (e) {}

      // Вибрация
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      } else if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Повысить счетчик категории
      setCategoryTotalCompleted(prev => ({
        ...prev,
        [category]: (prev[category] || 0) + xpToAdd
      }));
      
      // Пересчитать уровень категории
      const newTotal = (categoryTotalCompleted[category] || 0) + xpToAdd;
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
    const loadingTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        loadingTheme === 'light'
          ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50'
          : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419]'
      }`}>
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Calendar view removed - History page is used instead

  const bgClass = theme === 'light' 
    ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
    : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white';

  // Show onboarding first
  if (showOnboarding) {
    return <OnboardingModal onComplete={handleOnboardingComplete} theme={theme} />;
  }

  return (
    <div className={`min-h-screen ${bgClass} pb-8`}>
      {/* Compact Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {user?.full_name || tgUser?.first_name || 'Daily Quests'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('Profile')}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-11 w-11 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <User className="w-5 h-5" />
              </Button>
            </Link>
            <Link to={createPageUrl('History')}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-11 w-11 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <CalendarIcon className="w-5 h-5" />
              </Button>
            </Link>
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className={`h-11 w-11 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
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
          {Object.entries(CATEGORIES).map(([categoryKey, categoryInfo]) => {
            // Сортируем квесты: невыполненные отображаются первыми
            const sortedQuests = [...questData[categoryKey]].sort((a, b) => {
              const aCompleted = completedToday[`${categoryKey}_${a.level}`];
              const bCompleted = completedToday[`${categoryKey}_${b.level}`];
              if (!aCompleted && bCompleted) return -1;
              if (aCompleted && !bCompleted) return 1;
              return 0;
            });

            return (
              <SwipeableQuestCard
                key={categoryKey}
                categoryKey={categoryKey}
                categoryInfo={categoryInfo}
                quests={sortedQuests}
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
            );
          })}
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
        <PremiumModal onClose={() => setShowPremium(false)} theme={theme} />
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

      {/* AI Response Modal */}
      {aiResponse && (
        <AIResponseModal
          userInput={aiResponse.userInput}
          aiResponse={aiResponse}
          onClose={handleRejectAiResponse}
          onAccept={handleAcceptAiResponse}
          onReject={handleRejectAiResponse}
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

      <style>{`
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