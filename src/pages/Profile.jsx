import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';
import OnboardingModal from '@/components/daily/OnboardingModal';
import ProfileHeader from '@/components/profile/ProfileHeader';
import NotificationSettings from '@/components/profile/NotificationSettings';
import { getCachedUser, getCachedUserData, invalidateCache, updateCachedUserData } from '@/components/UserDataCache';
import DailyCaloriesCard from '@/components/profile/DailyCaloriesCard';
import CategoryLevelsCard from '@/components/profile/CategoryLevelsCard';
import PullToRefresh from '@/components/navigation/PullToRefresh';
import DeleteAccountSheet from '@/components/profile/DeleteAccountSheet';

const CATEGORIES_KEYS = ['health', 'mind', 'work', 'money', 'love', 'friends'];

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

export default function Profile() {
  const i = t();
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    streak: 0,
    totalCompleted: 0,
    categoryLevels: {},
    categoryTotalCompleted: {},
    completionHistory: {},
    currentLevel: LEVELS[0]
  });
  const [journalEntries, setJournalEntries] = useState([]);
  const [mealHistory, setMealHistory] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [userDataId, setUserDataId] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(savedTheme);

    const loadData = async () => {
      try {
        const authUser = await getCachedUser();
        if (!authUser) {
          await base44.auth.redirectToLogin(window.location.href);
          return;
        }
        setUser(authUser);

        const { data, id } = await getCachedUserData(authUser.email);
        if (data) {
          const totalCompleted = data.total_completed || 0;
          let currentLevel = LEVELS[0];
          for (const level of LEVELS) {
            if (totalCompleted >= level.threshold) currentLevel = level;
          }

          setStats({
            streak: data.streak || 0,
            totalCompleted,
            categoryLevels: data.category_levels || {},
            categoryTotalCompleted: data.category_total_completed || {},
            completionHistory: data.completion_history || {},
            currentLevel
          });

          setJournalEntries(data.journal_entries || []);
          setMealHistory(data.meal_history || []);
          setNotificationSettings(data.notification_settings || null);
          setUserDataId(id);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  const getLevelProgress = () => {
    const idx = LEVELS.findIndex(l => l === stats.currentLevel);
    const next = LEVELS[idx + 1];
    if (!next) return { progress: 100, remaining: 0, nextLevel: null };
    const curr = stats.currentLevel.threshold;
    const progress = ((stats.totalCompleted - curr) / (next.threshold - curr)) * 100;
    return { progress: Math.min(progress, 100), remaining: next.threshold - stats.totalCompleted, nextLevel: next };
  };

  const levelProgress = getLevelProgress();
  const bgClass = theme === 'light'
    ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
    : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white';

  const handlePullRefresh = async () => {
    invalidateCache();
    const authUser = await getCachedUser();
    if (!authUser) return;
    setUser(authUser);
    const { data, id } = await getCachedUserData(authUser.email);
    if (data) {
      const tc = data.total_completed || 0;
      let cl = LEVELS[0];
      for (const level of LEVELS) { if (tc >= level.threshold) cl = level; }
      setStats({
        streak: data.streak || 0, totalCompleted: tc,
        categoryLevels: data.category_levels || {}, categoryTotalCompleted: data.category_total_completed || {},
        completionHistory: data.completion_history || {}, currentLevel: cl
      });
      setJournalEntries(data.journal_entries || []);
      setMealHistory(data.meal_history || []);
      setNotificationSettings(data.notification_settings || null);
      setUserDataId(id);
    }
  };

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className={`min-h-screen ${bgClass}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' ? 'bg-white/80 border-gray-200' : 'bg-[#0f1419]/80 border-white/10'
      }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="px-5 py-3 flex items-center justify-between">
          <h1 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{i.profilePage.title}</h1>
        </div>
      </div>

      <div className="px-5 py-3 space-y-3 max-w-2xl mx-auto pb-6">
        {/* Profile header - compact */}
        <ProfileHeader user={user} stats={stats} levelProgress={levelProgress} theme={theme} />

        {/* Daily Calories */}
        <DailyCaloriesCard
          mealHistory={mealHistory}
          onEditMeal={(idx, updated) => {
            const newHistory = [...mealHistory];
            newHistory[idx] = updated;
            setMealHistory(newHistory);
            getCachedUserData(user.email).then(({ id }) => {
              if (id) {
                updateCachedUserData(id, { meal_history: newHistory });
                base44.entities.UserQuestData.update(id, { meal_history: newHistory });
              }
            });
          }}
          onDeleteMeal={(idx) => {
            const newHistory = mealHistory.filter((_, i) => i !== idx);
            setMealHistory(newHistory);
            getCachedUserData(user.email).then(({ id }) => {
              if (id) {
                updateCachedUserData(id, { meal_history: newHistory });
                base44.entities.UserQuestData.update(id, { meal_history: newHistory });
              }
            });
          }}
          theme={theme}
        />

        {/* Category levels (moved up under Calories) */}
        <CategoryLevelsCard
          completionHistory={stats.completionHistory}
          journalEntries={journalEntries}
          categoryLevels={stats.categoryLevels}
          theme={theme}
        />

        {/* Notification Settings */}
        <NotificationSettings
          settings={notificationSettings}
          onSave={async (newSettings) => {
            setNotificationSettings(newSettings);
            if (userDataId) {
              updateCachedUserData(userDataId, { notification_settings: newSettings });
              await base44.entities.UserQuestData.update(userDataId, { notification_settings: newSettings });
              toast.success(i.notifications?.saved || 'Saved!');
            }
          }}
          theme={theme}
        />

        {/* Update quests button */}
        <Button
          onClick={() => setShowResetConfirm(true)}
          aria-label={i.profilePage.updateQuests}
          className="w-full h-11 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {i.profilePage.updateQuests}
        </Button>

        {/* Reset Confirmation */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className={`rounded-2xl p-6 max-w-sm w-full ${theme === 'light' ? 'bg-white shadow-xl' : 'bg-[#1e2836]'}`}>
              <h2 className={`text-xl font-bold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{i.profilePage.updateQuestsQ}</h2>
              <p className={`text-sm mb-6 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                {i.profilePage.updateQuestsDesc}
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setShowResetConfirm(false)} variant="outline" aria-label={i.common.cancel} className={`min-h-[44px] ${theme === 'light' ? 'border-gray-300' : 'border-white/10'}`}>{i.common.cancel}</Button>
                <Button onClick={() => { setShowResetConfirm(false); setShowOnboarding(true); }} aria-label={i.profilePage.yesUpdate} className="flex-1 min-h-[44px] bg-gradient-to-r from-blue-600 to-cyan-600">{i.profilePage.yesUpdate}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Account */}
        <Button
          onClick={() => setShowDeleteSheet(true)}
          variant="ghost"
          aria-label={i.profilePage.deleteAccount}
          className={`w-full h-11 text-sm ${
            theme === 'light' ? 'text-red-500 hover:bg-red-50' : 'text-red-400 hover:bg-red-500/10'
          }`}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {i.profilePage.deleteAccount}
        </Button>

        {/* Delete Account Bottom Sheet */}
        <DeleteAccountSheet
          open={showDeleteSheet}
          onClose={() => setShowDeleteSheet(false)}
          user={user}
          theme={theme}
        />

        {/* Onboarding Modal */}
        {showOnboarding && (
          <OnboardingModal
            onComplete={async (answers) => {
              try {
                const result = await base44.integrations.Core.InvokeLLM({
                  prompt: `Ты - эксперт по персональному развитию. На основе ответов пользователя создай персонализированные ЕЖЕДНЕВНЫЕ квесты.

Ответы пользователя:
${Object.entries(answers).map(([cat, answer]) => `${cat}: ${answer}`).join('\n')}

ВАЖНО: Квесты должны быть ЕЖЕДНЕВНЫМИ действиями!
Для каждой категории создай РОВНО 3 квеста, СТРОГО отсортированных по сложности:
- Level 1 (самый лёгкий, +1 XP): простое базовое действие
- Level 2 (средний, +2 XP): требует больше усилий
- Level 3 (самый сложный, +3 XP): амбициозное действие
Категории: health, mind, work, money, love, friends.
ВАЖНО: Квесты должны идти в порядке level=1, level=2, level=3 по возрастанию сложности!
Короткие (до 30 символов), БЕЗ эмодзи в названии, БЕЗ сумм/валют в money.`,
                  response_json_schema: {
                    type: "object",
                    properties: Object.fromEntries(CATEGORIES_KEYS.map(cat => [cat, {
                      type: "array",
                      items: { type: "object", properties: { level: { type: "number" }, emoji: { type: "string" }, name: { type: "string" } }, required: ["level", "emoji", "name"] }
                    }])),
                    required: CATEGORIES_KEYS
                  }
                });

                const authUser = await base44.auth.me();
                const userDataList = await base44.entities.UserQuestData.filter({ created_by: authUser?.email });
                if (userDataList.length > 0) await base44.asServiceRole.entities.UserQuestData.delete(userDataList[0].id);

                await base44.entities.UserQuestData.create({
                  quest_data: result,
                  onboarding_answers: answers,
                  category_levels: CATEGORIES_KEYS.reduce((acc, cat) => ({ ...acc, [cat]: 1 }), {}),
                  category_total_completed: CATEGORIES_KEYS.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {}),
                  total_completed: 0, streak: 0, completion_history: {}, streak_freezes: 1, journal_entries: [],
                  last_visit_date: new Date().toISOString().split('T')[0]
                });

                setShowOnboarding(false);
                toast.success(i.profilePage.questsUpdated);
                setTimeout(() => { window.location.href = '/DailyTracker'; }, 500);
              } catch (error) {
                console.error('Error:', error);
                toast.error(i.profilePage.questsUpdateError);
                setShowOnboarding(false);
              }
            }}
            theme={theme}
          />
        )}
      </div>
    </PullToRefresh>
  );
}