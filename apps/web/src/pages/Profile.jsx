import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RotateCcw, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { api } from '@/api/client';
import { toast } from 'sonner';
import { t, getLang } from '@/lib/i18n';
import { LEVEL_DEFS } from '@/lib/levels';
import { todayKey } from '@/lib/dates';
import { mealKey } from '@/lib/meals';
import OnboardingModal from '@/components/daily/OnboardingModal';
import ProfileHeader from '@/components/profile/ProfileHeader';
import NotificationSettings from '@/components/profile/NotificationSettings';
import SoundSettings from '@/components/profile/SoundSettings';
import { getCachedUser, getCachedUserData, invalidateCache, updateCachedUserData, setCachedUser } from '@/components/UserDataCache';

import DailyCaloriesCard from '@/components/profile/DailyCaloriesCard';
import CategoryLevelsCard from '@/components/profile/CategoryLevelsCard';
import PullToRefresh from '@/components/navigation/PullToRefresh';
import DeleteAccountSheet from '@/components/profile/DeleteAccountSheet';
import { aiErrorMessage } from '@/lib/aiErrors';
import { canInstall, promptInstall, onInstallAvailability } from '@/lib/installPrompt';
import { useTheme } from '@/lib/useTheme';


const LEVELS = LEVEL_DEFS.map((l) => ({ ...l, name: t().levels[l.level] }));

/**
 * The level the server says the user is on. The thresholds are only consulted
 * for a payload written before `overall_level` existed — the tracker and this
 * page have to agree, and the server is what both of them ask.
 */
function levelOf(data, totalCompleted) {
  if (data?.overall_level) return LEVELS[Math.min(data.overall_level, LEVELS.length) - 1];
  let found = LEVELS[0];
  for (const level of LEVELS) if (totalCompleted >= level.threshold) found = level;
  return found;
}

export default function Profile() {
  const i = t();
  const theme = useTheme();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // The shared cache has to move with the profile, not just this page's state:
  // DailyTracker re-checks the cached user on every focus and would otherwise
  // overwrite a freshly chosen name with the email-derived default.
  /**
   * One meal changed, named by its own id rather than its position.
   *
   * The list is rebuilt by the server, which holds the row lock; this page
   * takes the result. Sending the whole array from here is what used to
   * overwrite a meal logged on another device between this page's load and
   * this tap.
   */
  const applyMealChange = useCallback(async (idx, run) => {
    const meal = mealHistory[idx];
    if (!meal) return;
    try {
      const row = await run();
      setMealHistory(row.meal_history || []);
      if (userDataId) updateCachedUserData(userDataId, { meal_history: row.meal_history || [] });
      window.dispatchEvent(
        new CustomEvent('meal-history-updated', { detail: { meal_history: row.meal_history || [] } }),
      );
    } catch (error) {
      toast.error(error?.message || i.profilePage?.nameError || 'Could not save that');
    }
  }, [mealHistory, userDataId, i]);

  const handleUserUpdate = useCallback((next) => {
    setUser(next);
    setCachedUser(next);
  }, []);
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
  const [canInstallApp, setCanInstallApp] = useState(canInstall);

  // The prompt usually arrives before this page is opened, so subscribe rather
  // than reading once.
  useEffect(() => onInstallAvailability(setCanInstallApp), []);
  const location = useLocation();

  // Listen for meal updates from other pages and apply them immediately
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.meal_history) setMealHistory(e.detail.meal_history);
    };
    window.addEventListener('meal-history-updated', handler);
    return () => window.removeEventListener('meal-history-updated', handler);
  }, []);

  // Re-sync from cache whenever Profile becomes active
  useEffect(() => {
    const isProfileActive = location.pathname === '/Profile';
    if (!isProfileActive) return;

    let cancelled = false;
    (async () => {
      try {
        const authUser = await getCachedUser();
        if (!authUser || cancelled) return;
        setUser(authUser);

        // This effect already re-runs whenever Profile becomes the active
        // route, so the read has to be a fresh one.
        const { data, id } = await getCachedUserData({ force: true });
        if (!data || cancelled) return;
        const totalCompleted = data.total_completed || 0;
        const currentLevel = levelOf(data, totalCompleted);
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
      } catch (error) {
        console.error('Error loading data:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

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
    ? 'bg-gradient-to-b from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
    : 'bg-gradient-to-b from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white';

  const handlePullRefresh = async () => {
    invalidateCache();
    const authUser = await getCachedUser();
    if (!authUser) return;
    setUser(authUser);
    const { data, id } = await getCachedUserData();
    if (data) {
      const tc = data.total_completed || 0;
      const cl = levelOf(data, tc);
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
        <ProfileHeader
          user={user}
          stats={stats}
          levelProgress={levelProgress}
          theme={theme}
          onUserUpdate={handleUserUpdate}
          earnedLevel={stats.currentLevel?.level || 1}
        />


        {/* Daily Calories */}
        <DailyCaloriesCard
          mealHistory={mealHistory}
          onEditMeal={(idx, updated) => applyMealChange(idx, () =>
            api.questData.meals.update(mealKey(mealHistory[idx]), {
              meal_name: updated.meal_name,
              calories: Math.round(updated.calories || 0),
              protein: Math.round(updated.protein || 0),
              fat: Math.round(updated.fat || 0),
              carbs: Math.round(updated.carbs || 0),
            }),
          )}
          onDeleteMeal={(idx) => applyMealChange(idx, () =>
            api.questData.meals.remove(mealKey(mealHistory[idx])),
          )}
          theme={theme}
        />

        {/* Category levels (moved up under Calories) */}
        <CategoryLevelsCard
          completionHistory={stats.completionHistory}
          journalEntries={journalEntries}
          categoryLevels={stats.categoryLevels}
          theme={theme}
        />

        <SoundSettings theme={theme} />

        {/* Notification Settings */}
        <NotificationSettings
          settings={notificationSettings}
          onSave={async (newSettings) => {
            setNotificationSettings(newSettings);
            if (userDataId) {
              updateCachedUserData(userDataId, { notification_settings: newSettings });
              await api.questData.update({ notification_settings: newSettings });
              toast.success(i.notifications?.saved || 'Saved!');
            }
          }}
          theme={theme}
        />

        {/* Install as an app — only where the browser has an install to offer:
            already installed, or a browser that never fires the event (iOS
            installs through Share → Add to Home Screen), leaves nothing here. */}
        {canInstallApp && (
          <Button
            onClick={async () => {
              const accepted = await promptInstall();
              if (accepted) toast.success(i.profilePage.installed);
              setCanInstallApp(canInstall());
            }}
            variant="outline"
            aria-label={i.profilePage.installApp}
            className={`w-full h-12 text-sm mb-3 ${
              theme === 'light' ? 'border-gray-300' : 'border-white/10'
            }`}
          >
            <Download className="w-4 h-4 mr-2" />
            {i.profilePage.installApp}
          </Button>
        )}

        {/* Update quests button */}
        <Button
          onClick={() => setShowResetConfirm(true)}
          aria-label={i.profilePage.updateQuests}
          className="w-full h-11 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
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
                // Same server endpoint DailyTracker uses for onboarding.
                const { quest_data } = await api.ai.generateQuests(answers, getLang());
                await api.questData.create({
                  quest_data,
                  onboarding_answers: answers,
                  last_visit_date: todayKey(),
                });
                invalidateCache();

                // Straight to the tracker. Closing the modal first and then
                // reloading the page showed the profile for half a second and
                // threw away the whole app to get somewhere it could already
                // route to; the new quests are the thing to look at.
                toast.success(i.profilePage.questsUpdated);
                navigate('/DailyTracker', { replace: true });
              } catch (error) {
                console.error('Error:', error);
                toast.error(aiErrorMessage(error, i.profilePage.questsUpdateError));
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