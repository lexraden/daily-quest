import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CheckCircle2, Circle, Flame, Trophy, Target, Sparkles, Heart, Brain, Briefcase, DollarSign, Users, Activity, Lock, Download, Shield, TrendingUp, Camera, Footprints, Sun, Moon, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
// CalendarView replaced by History page
import SwipeableQuestCard from '@/components/daily/SwipeableQuestCard.jsx';
import VoiceQuestInput from '@/components/daily/VoiceQuestInput.jsx';
import MotivationalBanner from '@/components/daily/MotivationalBanner.jsx';
import CaloriesIndicators from '@/components/daily/CaloriesIndicators.jsx';
import { getStreakMilestone } from '@/components/daily/StreakCelebrationModal.jsx';

// Lazy-loaded modals — only fetched when actually shown (reduces initial bundle)
const PremiumModal = React.lazy(() => import('@/components/daily/PremiumModal.jsx'));
const CategoryProgressModal = React.lazy(() => import('@/components/daily/CategoryProgressModal.jsx'));
const QuestSuggestionModal = React.lazy(() => import('@/components/daily/QuestSuggestionModal.jsx'));
const AIResponseModal = React.lazy(() => import('@/components/daily/AIResponseModal.jsx'));
const OnboardingModal = React.lazy(() => import('@/components/daily/OnboardingModal.jsx'));
const StreakCelebrationModal = React.lazy(() => import('@/components/daily/StreakCelebrationModal.jsx'));
const StreakFreezeModal = React.lazy(() => import('@/components/daily/StreakFreezeModal.jsx'));
const MealReportModal = React.lazy(() => import('@/components/daily/MealReportModal.jsx'));
const CategoryLevelUpModal = React.lazy(() => import('@/components/daily/CategoryLevelUpModal.jsx'));
import { isCategoryLevelMilestone } from '@/components/daily/CategoryLevelUpModal.jsx';

// Dynamic import for confetti — only loaded on first quest completion
let confettiModule = null;
const getConfetti = () => {
  if (!confettiModule) {
    confettiModule = import('canvas-confetti').then(m => m.default);
  }
  return confettiModule;
};
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getCachedUser, getCachedUserData, updateCachedUserData, setCachedUser, invalidateCache } from '@/components/UserDataCache';
import PullToRefresh from '@/components/navigation/PullToRefresh';
import useSaveUserData from '@/hooks/useSaveUserData';
import usePremiumStatus from '@/hooks/usePremiumStatus';
import { t, getLang } from '@/lib/i18n';
import { sanitizeQuestData } from '@/lib/sanitizeQuestData';

/* ============================================
   🎨 DESIGN CUSTOMIZATION SECTION
   ============================================ */

const APP_CONFIG = {
  title: "Daily Quests",
  completedText: "✓",
  pendingText: "○",
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

// Default quest data loaded from i18n
const DEFAULT_QUEST_DATA = t().defaultQuests;

// Level system with i18n names
const LEVEL_DEFS = [
  { level: 1, threshold: 0, icon: "🌱", color: "#6c5ce7" },
  { level: 2, threshold: 10, icon: "📚", color: "#00cec9" },
  { level: 3, threshold: 25, icon: "⚡", color: "#fdcb6e" },
  { level: 4, threshold: 50, icon: "🔥", color: "#e17055" },
  { level: 5, threshold: 100, icon: "💎", color: "#d63031" },
  { level: 6, threshold: 200, icon: "⚔️", color: "#fd79a8" },
  { level: 7, threshold: 350, icon: "🏆", color: "#fdcb6e" },
  { level: 8, threshold: 550, icon: "👑", color: "#ffeaa7" },
  { level: 9, threshold: 800, icon: "⚡", color: "#a29bfe" },
  { level: 10, threshold: 1100, icon: "✨", color: "#ffffff" }
];
const LEVELS = LEVEL_DEFS.map(l => ({ ...l, name: t().levels[l.level] }));

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
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [showStreakFreeze, setShowStreakFreeze] = useState(false);
  const [pendingFreezeData, setPendingFreezeData] = useState(null);
  const [mealHistory, setMealHistory] = useState([]);
  const [pendingMeal, setPendingMeal] = useState(null);
  const [categoryLevelUp, setCategoryLevelUp] = useState(null); // { category, level }
  const [caloriesBurned, setCaloriesBurned] = useState({}); // { "YYYY-MM-DD": number }
  const [trialStartedAt, setTrialStartedAt] = useState(null);
  const [isPremium, setIsPremium] = useState(false);

  const premiumStatus = usePremiumStatus({ isPremium, trialStartedAt });
  const location = useLocation();
  const skipNextSaveRef = useRef(false);

  const getTodayKey = () => new Date().toISOString().split('T')[0];

  // Инициализация Telegram Web App и темы
  useEffect(() => {
    // Загрузка темы из localStorage (по умолчанию 'light')
    const savedTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(savedTheme);

    // Load authenticated user and save name on first login
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
                const name = authUser.email?.split('@')[0] || t().profilePage.user;
                await base44.auth.updateMe({ full_name: name }).catch(err => {
                  console.log('Failed to save user name:', err);
                });
              }
            } else {
              // No user returned but no error — unblock the UI
              setIsLoaded(true);
            }
          } catch (error) {
            console.error('Auth error:', error);
            setIsLoaded(true);
          }
        };

        loadUser();

        // Safety net: never leave the user on an infinite spinner.
        // If after 8 seconds nothing has finished loading, unblock the UI.
        const loadTimeout = setTimeout(() => {
          setIsLoaded((prev) => prev || true);
        }, 8000);

        // Reload user on focus to get updated name
        const handleFocus = () => loadUser();
        window.addEventListener('focus', handleFocus);
        return () => {
          window.removeEventListener('focus', handleFocus);
          clearTimeout(loadTimeout);
        };
      }, []);

  // Сохранение темы + обновление meta theme-color для Android status bar
  useEffect(() => {
    localStorage.setItem('dailyQuestsTheme', theme);
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#f9fafb' : '#0f1419');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const handleSaveQuest = (categoryKey, questLevel, updatedData) => {
    setQuestData(prev => ({
      ...prev,
      [categoryKey]: prev[categoryKey].map(q => 
        q.level === questLevel ? { ...q, ...updatedData } : q
      )
    }));
  };

  const handleQuestSuggestion = useCallback((suggestion) => {
    // Показать модал с AI ответом
    setAiResponse(suggestion);
  }, []);

  const handleAcceptAiResponse = () => {
    const { intent, category, emoji, name, description, action, level } = aiResponse;

    if (intent === 'EDIT_QUEST') {
          const categoryQuests = questData[category] || [];
          const oldName = (aiResponse.old_name || '').toLowerCase().trim();

          // Find quest by old name
          let questIndex = categoryQuests.findIndex(q => 
            q.name.toLowerCase().trim() === oldName
          );

          // Partial match
          if (questIndex === -1 && oldName) {
            const matches = categoryQuests
              .map((q, i) => ({ q, i }))
              .filter(({ q }) => 
                q.name.toLowerCase().includes(oldName) || oldName.includes(q.name.toLowerCase())
              );
            if (matches.length === 1) {
              questIndex = matches[0].i;
            }
          }

          // By level
          if (questIndex === -1 && level) {
            questIndex = categoryQuests.findIndex(q => q.level === level);
          }

          if (questIndex !== -1) {
            setQuestData(prev => ({
              ...prev,
              [category]: prev[category].map((q, i) => 
                i === questIndex ? { ...q, name: name, emoji: emoji } : q
              )
            }));
            toast.success(aiResponse.message || '✏️');
          } else {
            toast.error(t().common.error);
          }
        } else if (intent === 'DELETE_QUEST') {
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
            const deletedQuest = categoryQuests[questIndex];
            const deletedKey = `${category}_${deletedQuest.level}`;
            
            // Remove quest from data
            setQuestData(prev => ({
              ...prev,
              [category]: prev[category].filter((_, i) => i !== questIndex)
            }));
            
            // Clean up completedToday for the deleted quest
            setCompletedToday(prev => {
              const newState = { ...prev };
              delete newState[deletedKey];
              return newState;
            });
            
            // Clean up today's completion history
            const today = getTodayKey();
            setCompletionHistory(prev => {
              const newHistory = { ...prev };
              if (newHistory[today]) {
                newHistory[today] = newHistory[today].filter(
                  c => !(c.category === category && c.level === deletedQuest.level)
                );
                if (newHistory[today].length === 0) delete newHistory[today];
              }
              return newHistory;
            });
            
            toast.success(aiResponse.message || '🗑️');
          } else {
            toast.error(t().common.error);
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
      
      toast.success(aiResponse.message || '🎉');
    } else if (intent === 'ADD_QUEST') {
      // Добавить новый квест напрямую
      const existingLevels = (questData[category] || []).map(q => q.level);
      let newLevel = level || (Math.max(...existingLevels, 0) + 1);
      while (existingLevels.includes(newLevel)) {
        newLevel++;
      }
      setQuestData(prev => ({
        ...prev,
        [category]: [...(prev[category] || []), { level: newLevel, name, emoji }]
      }));
      toast.success(aiResponse.message || '✅');
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
      
      toast.success(aiResponse.message || '📝');
    }

    setAiResponse(null);
  };

  const handleRejectAiResponse = useCallback(() => {
    setAiResponse(null);
  }, []);

  const handleOnboardingComplete = async (answers) => {
    try {
      const lang = getLang();
      const isRu = lang === 'ru';
      // Generate personalized quests using AI
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: isRu
          ? `Ты - эксперт по персональному развитию. На основе ответов пользователя создай персонализированные ЕЖЕДНЕВНЫЕ квесты для daily tracker.

Ответы пользователя:
${Object.entries(answers).map(([cat, answer]) => `${cat}: ${answer}`).join('\n')}

ВАЖНО: Квесты должны быть ЕЖЕДНЕВНЫМИ действиями, которые можно выполнять каждый день, а НЕ долгосрочными целями!
❌ Неправильно: "Сбросить 5кг", "Получить повышение", "Купить квартиру"
✅ Правильно: "Пробежать 3км", "Выполнить задачу на работе", "Отложить деньги"

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
- НА РУССКОМ ЯЗЫКЕ
- БЕЗ эмодзи в названии (эмодзи только в поле emoji)

ВАЖНО для категории money:
- НЕ указывай конкретные суммы или валюты (₽, $, 500₽, 10%)
- Используй общие формулировки ("отложить часть дохода", "проверить бюджет")

Подбери подходящие эмодзи для каждого квеста (эмодзи отдельно, не в названии).`
          : `You are a personal development expert. Based on the user's answers, create personalized DAILY quests for a daily tracker.

User's answers:
${Object.entries(answers).map(([cat, answer]) => `${cat}: ${answer}`).join('\n')}

IMPORTANT: Quests must be DAILY actions that can be done every day, NOT long-term goals!
❌ Wrong: "Lose 5kg", "Get promoted", "Buy a house"
✅ Right: "Run 3km", "Complete a work task", "Save some money"

For each category create EXACTLY 3 DAILY quests, STRICTLY sorted by difficulty:
- Level 1 (easiest, +1 XP): simple basic daily action
- Level 2 (medium, +2 XP): requires more effort but doable daily
- Level 3 (hardest, +3 XP): ambitious daily action

IMPORTANT: Quests MUST go in order level=1, level=2, level=3 by increasing difficulty!

Categories:
- health: physical activity, sports, wellness
- mind: learning, meditation, reading
- work: work tasks, projects
- money: financial habits, savings
- love: romantic relationships, quality time with partner
- friends: socializing, friendships

Quests must be:
- DAILY actions
- Specific and measurable
- Tailored to the user's situation
- Realistic for daily completion
- Motivating
- Short (up to 30 characters)
- IN ENGLISH
- NO emoji in the name (emoji only in the emoji field)

IMPORTANT for money category:
- Do NOT specify exact amounts or currencies ($, €, $500, 10%)
- Use general phrasing ("save part of income", "review budget")

Pick appropriate emojis for each quest (emoji separate, not in the name).`,
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

        // Update quests with AI-generated ones (sanitized to avoid broken entries)
        const sanitizedResult = sanitizeQuestData(result, DEFAULT_QUEST_DATA);
        setQuestData(sanitizedResult);

        // Check if we need to delete old data (reset scenario)
        const userDataList = await base44.entities.UserQuestData.filter({ created_by: user?.email });
        if (userDataList.length > 0) {
        await base44.asServiceRole.entities.UserQuestData.delete(userDataList[0].id);
        }

        // Create new user data record after onboarding — start 3-day free trial
        const trialStart = new Date().toISOString();
        const newUserData = await base44.entities.UserQuestData.create({
        quest_data: sanitizedResult,
        onboarding_answers: answers,
        category_levels: Object.keys(CATEGORIES).reduce((acc, cat) => ({ ...acc, [cat]: 1 }), {}),
        category_total_completed: Object.keys(CATEGORIES).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {}),
        total_completed: 0,
        streak: 0,
        completion_history: {},
        streak_freezes: 1,
        journal_entries: [],
        last_visit_date: getTodayKey(),
        trial_started_at: trialStart,
        is_premium: false
        });
        setUserDataId(newUserData.id);
        setTrialStartedAt(trialStart);
        setIsPremium(false);

        setShowOnboarding(false);
        toast.success(t().onboarding.questsReady);
        } catch (error) {
        console.error('Error generating quests:', error);
        toast.error(t().onboarding.questsError);
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

  const handleRejectSuggestion = useCallback(() => {
    setQuestSuggestion(null);
  }, []);

  const handleUseFreeze = useCallback(() => {
    // Сохраняем streak, тратим freeze
    setStreakFreezes(prev => Math.max(prev - 1, 0));
    setShowStreakFreeze(false);
    setPendingFreezeData(null);
    toast.success(t().streakFreeze.freezeUsed);
  }, []);

  const handleLoseStreak = useCallback(() => {
    setStreak(0);
    setShowStreakFreeze(false);
    setPendingFreezeData(null);
    toast(t().streakFreeze.streakReset);
  }, []);

  const handleMealAnalyzed = useCallback((meal) => {
    setPendingMeal(meal);
  }, []);

  const handleDiscardMeal = useCallback(() => {
    setPendingMeal(null);
  }, []);

  const handleEditMeal = (index, updatedMeal) => {
    setMealHistory(prev => prev.map((m, i) => i === index ? updatedMeal : m));
  };

  const handleDeleteMeal = (index) => {
    setMealHistory(prev => prev.filter((_, i) => i !== index));
  };

  const handleCaloriesOutChange = useCallback((value) => {
    const today = getTodayKey();
    setCaloriesBurned(prev => ({ ...prev, [today]: value }));
  }, []);

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
          
          // Загрузка кастомных квестов (с санитизацией от битых данных)
          if (data.quest_data) {
            setQuestData(sanitizeQuestData(data.quest_data, DEFAULT_QUEST_DATA));
          }

          // Загрузка заметок
          if (data.journal_entries) {
            setJournalEntries(data.journal_entries);
          }
          
          // Загрузка истории еды
          if (data.meal_history) {
            setMealHistory(data.meal_history);
          }

          // Загрузка сожжённых калорий
          if (data.calories_burned) {
            setCaloriesBurned(data.calories_burned);
          }

          // Trial / Premium status
          setTrialStartedAt(data.trial_started_at || null);
          setIsPremium(!!data.is_premium);
          
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
            const lastVisit = new Date(data.last_visit_date + 'T12:00:00');
            const todayDate = new Date(today + 'T12:00:00');
            const diffDays = Math.round((todayDate - lastVisit) / (1000 * 60 * 60 * 24));
            
            // Проверяем был ли прогресс в последний день визита
            const lastVisitKey = data.last_visit_date;
            const hadProgressLastVisit = data.completion_history?.[lastVisitKey]?.length > 0;
            
            if (diffDays === 1 && hadProgressLastVisit) {
              // Вчера был прогресс — streak продолжится когда выполнит квест сегодня
              setStreak(data.streak || 0);
            } else if (diffDays === 2 && hadProgressLastVisit && data.streak > 0) {
              // Пропущен ровно 1 день — предлагаем freeze
              if ((data.streak_freezes ?? 0) > 0) {
                setPendingFreezeData({ streak: data.streak, freezes: data.streak_freezes });
                setShowStreakFreeze(true);
                // Временно ставим streak как было, решение примет юзер
                setStreak(data.streak);
              } else {
                // Нет freezes — сбрасываем
                setStreak(0);
              }
            } else if (diffDays >= 2) {
              // Пропустили больше 1 дня или не было прогресса — сбрасываем
              setStreak(0);
            } else if (diffDays === 1 && !hadProgressLastVisit) {
              // Вчера заходил, но ничего не сделал
              if ((data.streak_freezes ?? 0) > 0 && data.streak > 0) {
                setPendingFreezeData({ streak: data.streak, freezes: data.streak_freezes });
                setShowStreakFreeze(true);
                setStreak(data.streak);
              } else {
                setStreak(0);
              }
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
        toast.error(t().onboarding.dataLoadError);
      }

      setIsLoaded(true);
      };

      if (user?.email) {
      loadUserData();
      }
      }, [user]);

  // React Query optimistic save with debounce and rollback
  const getStateSnapshot = useCallback(() => ({
    quest_data: questData,
    category_levels: categoryLevels,
    category_total_completed: categoryTotalCompleted,
    total_completed: totalCompleted,
    streak,
    last_completed_date: lastCompletedDate,
    completion_history: completionHistory,
    streak_freezes: streakFreezes,
    journal_entries: journalEntries,
    meal_history: mealHistory,
    calories_burned: caloriesBurned,
    trial_started_at: trialStartedAt,
    is_premium: isPremium,
    last_visit_date: getTodayKey()
  }), [questData, categoryLevels, categoryTotalCompleted, totalCompleted, streak, lastCompletedDate, completionHistory, streakFreezes, journalEntries, mealHistory, caloriesBurned, trialStartedAt, isPremium]);

  const restoreSnapshot = useCallback((snapshot) => {
    setQuestData(snapshot.quest_data);
    setCategoryLevels(snapshot.category_levels);
    setCategoryTotalCompleted(snapshot.category_total_completed);
    setTotalCompleted(snapshot.total_completed);
    setStreak(snapshot.streak);
    setLastCompletedDate(snapshot.last_completed_date);
    setCompletionHistory(snapshot.completion_history);
    setStreakFreezes(snapshot.streak_freezes);
    setJournalEntries(snapshot.journal_entries);
    setMealHistory(snapshot.meal_history);
    setCaloriesBurned(snapshot.calories_burned || {});
    const today = getTodayKey();
    const todayHistory = snapshot.completion_history?.[today] || [];
    const reverted = {};
    todayHistory.forEach(q => { reverted[`${q.category}_${q.level}`] = true; });
    setCompletedToday(reverted);
  }, []);

  const { save: saveUserData, cancelPendingSave, hasPendingWrite } = useSaveUserData({
    userDataId,
    isLoaded,
    getStateSnapshot,
    restoreSnapshot,
  });

  // Stable refs so the re-sync effect doesn't re-run when these identities change
  const cancelPendingSaveRef = useRef(cancelPendingSave);
  const hasPendingWriteRef = useRef(hasPendingWrite);
  useEffect(() => { cancelPendingSaveRef.current = cancelPendingSave; }, [cancelPendingSave]);
  useEffect(() => { hasPendingWriteRef.current = hasPendingWrite; }, [hasPendingWrite]);

  // Listen for meal updates broadcasted from Profile/History — apply immediately
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.meal_history) {
        cancelPendingSaveRef.current?.();
        skipNextSaveRef.current = true;
        setMealHistory(e.detail.meal_history);
      }
    };
    window.addEventListener('meal-history-updated', handler);
    return () => window.removeEventListener('meal-history-updated', handler);
  }, []);

  // Trigger debounced save whenever data changes
  useEffect(() => {
    if (!isLoaded || !userDataId) return;
    if (skipNextSaveRef.current) {
      // This change originated from a re-sync (cache → state), not a user action.
      // Don't write the same data back to the DB.
      skipNextSaveRef.current = false;
      return;
    }
    saveUserData();
  }, [questData, categoryLevels, categoryTotalCompleted, totalCompleted, streak, lastCompletedDate, completedToday, completionHistory, streakFreezes, journalEntries, mealHistory, caloriesBurned, isLoaded, userDataId, saveUserData]);

  // Экспорт данных
  const exportData = useCallback(() => {
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
  }, [questData, categoryLevels, categoryTotalCompleted, totalCompleted, streak, streakFreezes, completionHistory]);

  // Получить текущий квест для категории
  const getCurrentQuest = (category) => {
    const level = categoryLevels[category] || 1;
    const quests = questData[category];
    const quest = quests.find(q => q.level === level) || quests[quests.length - 1];
    return { ...quest, category };
  };

  // Конфетти (dynamically loaded)
  const fireConfetti = async () => {
    const confetti = await getConfetti();
    const count = 200;
    const defaults = { origin: { y: 0.7 } };

    const fire = (particleRatio, opts) => {
      confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
    };

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
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
  const toggleQuest = useCallback((category, level = null) => {
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
            emoji: currentQuest.emoji,
            timestamp: new Date().toISOString()
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
      if (navigator.vibrate) {
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
      const oldLevel = categoryLevels[category] || 1;
      setCategoryLevels(prev => ({
        ...prev,
        [category]: newLevel
      }));

      // Триггерим Achievement при достижении milestone уровня категории
      if (newLevel > oldLevel && isCategoryLevelMilestone(newLevel)) {
        setTimeout(() => {
          setCategoryLevelUp({ category, level: newLevel });
          fireConfetti();
        }, 800);
      }

      // Streak теперь засчитывается только при загрузке фото еды (см. handleMealAnalyzed → onSave)
    }
  }, [questData, completedToday, categoryLevels, categoryTotalCompleted, completionHistory, lastCompletedDate, streak]);

  // Stable callback refs for SwipeableQuestCard memo
  const handleSaveQuestCb = useCallback((categoryKey, questLevel, updatedData) => {
    setQuestData(prev => ({
      ...prev,
      [categoryKey]: prev[categoryKey].map(q => 
        q.level === questLevel ? { ...q, ...updatedData } : q
      )
    }));
  }, []);

  const handleCategoryClick = useCallback((categoryKey) => {
    setSelectedCategory(categoryKey);
  }, []);

  // Memoize category entries to avoid re-sorting on unrelated renders
  const categoryEntries = useMemo(() => Object.entries(CATEGORIES), []);

  const completedCount = Object.keys(completedToday).length;
  const totalQuests = Object.keys(CATEGORIES).length;
  const progress = (completedCount / totalQuests) * 100;
  const currentLevel = getCurrentLevel();
  const levelProgress = getProgressToNextLevel();

  const i = t();
  const getMotivation = () => {
    if (completedCount === 0) return "";
    const motivations = i.tracker.motivations;
    const index = Math.min(
      Math.floor((completedCount / totalQuests) * motivations.length),
      motivations.length - 1
    );
    return motivations[index];
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
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500" /></div>}>
        <OnboardingModal onComplete={handleOnboardingComplete} theme={theme} />
      </React.Suspense>
    );
  }

  const handlePullRefresh = async () => {
    invalidateCache();
    if (user?.email) {
      const { data, id } = await getCachedUserData(user.email);
      if (data) {
        if (data.quest_data) setQuestData(data.quest_data);
        setTotalCompleted(data.total_completed || 0);
        setStreak(data.streak || 0);
        setMealHistory(data.meal_history || []);
        setJournalEntries(data.journal_entries || []);
        setCaloriesBurned(data.calories_burned || {});
        setUserDataId(id);
      }
    }
  };

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className={`min-h-screen ${bgClass} pb-4`}>
      {/* Compact Header */}
      <div className="px-5 pb-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {user?.full_name || 'Daily Quests'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              aria-label={theme === 'light' ? i.tracker.darkTheme : i.tracker.lightTheme}
              className={`h-11 w-11 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-2 mb-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{currentLevel.icon}</span>
            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>{i.levels[currentLevel.level] || currentLevel.name}</span>
          </div>
          <div className={`w-px h-4 ${theme === 'light' ? 'bg-black/10' : 'bg-white/10'}`} />
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-500" fill="currentColor" />
            <span className={`font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{streak}</span>
          </div>
          <CaloriesIndicators
            mealHistory={mealHistory}
            caloriesOut={caloriesBurned[getTodayKey()] || 0}
            onCaloriesOutChange={handleCaloriesOutChange}
            theme={theme}
          />

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
                  {levelProgress.remaining} {i.tracker.xpTo}
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
          userName={user?.full_name}
          completedCount={completedCount}
          theme={theme}
        />

        {/* Voice Quest Input + Calorie Photo */}
        <VoiceQuestInput 
          onQuestSuggestion={handleQuestSuggestion}
          onMealAnalyzed={handleMealAnalyzed}
          theme={theme}
          questData={questData}
          hasAccess={true}
          onLocked={() => setShowPremium(true)}
        />

        {/* Quest Categories */}
        <div className="px-5 mt-1">
        <div className="space-y-0">
          {categoryEntries.map(([categoryKey, categoryInfo]) => {
            const quests = questData[categoryKey] || [];
            return (
              <SwipeableQuestCard
                key={categoryKey}
                categoryKey={categoryKey}
                categoryInfo={categoryInfo}
                quests={quests}
                completedToday={completedToday}
                onToggleQuest={toggleQuest}
                celebrationQuest={celebrationQuest}
                completedText={APP_CONFIG.completedText}
                pendingText={APP_CONFIG.pendingText}
                theme={theme}
                categoryLevel={categoryLevels[categoryKey] || 1}
                onCategoryClick={handleCategoryClick}
                onSaveQuest={handleSaveQuestCb}
              />
            );
          })}
        </div>
      </div>

      {/* Lazy-loaded Modals wrapped in Suspense */}
      <React.Suspense fallback={null}>
      {/* Premium Modal */}
      {showPremium && (
        <PremiumModal onClose={() => setShowPremium(false)} theme={theme} premiumStatus={premiumStatus} />
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

      {/* Streak Celebration Modal */}
      {showStreakCelebration && (
        <StreakCelebrationModal
          streak={streak}
          onClose={() => setShowStreakCelebration(false)}
          theme={theme}
        />
      )}

      {/* Meal Report Modal */}
      {pendingMeal && (
        <MealReportModal
          meal={pendingMeal}
          onSave={() => {
            setMealHistory(prev => [pendingMeal, ...prev]);
            setPendingMeal(null);
            toast.success(i.calories.mealSaved);

            // Streak засчитывается только при загрузке фото еды, один раз в день
            const today = getTodayKey();
            if (lastCompletedDate !== today) {
              setLastCompletedDate(today);
              const newStreak = streak + 1;
              setStreak(newStreak);
              if (getStreakMilestone(newStreak)) {
                setTimeout(() => {
                  setShowStreakCelebration(true);
                  fireConfetti();
                }, 1000);
              }
            }
          }}
          onDiscard={handleDiscardMeal}
          theme={theme}
        />
      )}

      {/* Streak Freeze Modal */}
      {showStreakFreeze && pendingFreezeData && (
        <StreakFreezeModal
          streak={pendingFreezeData.streak}
          freezesLeft={pendingFreezeData.freezes}
          onUseFreeze={handleUseFreeze}
          onLoseStreak={handleLoseStreak}
          theme={theme}
        />
      )}

      {/* Category Level Up Modal */}
      {categoryLevelUp && (
        <CategoryLevelUpModal
          category={categoryLevelUp.category}
          level={categoryLevelUp.level}
          onClose={() => setCategoryLevelUp(null)}
          theme={theme}
        />
      )}
      </React.Suspense>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </PullToRefresh>
  );
}