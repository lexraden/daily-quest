import React, { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import OnboardingModal from '@/components/daily/OnboardingModal';
import ProfileHeader from '@/components/profile/ProfileHeader';
import JournalSection from '@/components/profile/JournalSection';
import StatsSection from '@/components/profile/StatsSection';
import { getCachedUser, getCachedUserData, invalidateCache } from '@/components/UserDataCache';

const CATEGORIES_KEYS = ['health', 'mind', 'work', 'money', 'love', 'friends'];

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
    categoryTotalCompleted: {},
    completionHistory: {},
    currentLevel: LEVELS[0]
  });
  const [journalEntries, setJournalEntries] = useState([]);
  const [activeTab, setActiveTab] = useState('stats');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(savedTheme);

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      setTgUser(window.Telegram.WebApp.initDataUnsafe.user);
    }

    const loadData = async () => {
      try {
        const authUser = await getCachedUser();
        if (!authUser) {
          await base44.auth.redirectToLogin(window.location.href);
          return;
        }
        setUser(authUser);

        const { data } = await getCachedUserData(authUser.email);
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

          if (data.journal_entries) setJournalEntries(data.journal_entries);
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

  const questEntries = journalEntries.filter(e => e.type === 'quest_completed');
  const noteEntries = journalEntries.filter(e => e.type === 'journal');

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' ? 'bg-white/80 border-gray-200' : 'bg-[#0f1419]/80 border-white/10'
      }`}>
        <div className="px-5 py-3 flex items-center justify-between">
          <h1 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>Профиль</h1>
          <Link to={createPageUrl('DailyTracker')}>
            <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-full ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
              <X className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-5 py-3 space-y-3 max-w-2xl mx-auto pb-6">
        {/* Profile header - compact */}
        <ProfileHeader user={user} tgUser={tgUser} stats={stats} levelProgress={levelProgress} theme={theme} />

        {/* Tab navigation */}
        <div className={`flex rounded-xl overflow-hidden border ${
          theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-white/5 border-white/10'
        }`}>
          {[
            { key: 'stats', label: '📊 Статистика' },
            { key: 'quests', label: `🎯 Квесты (${questEntries.length})` },
            { key: 'notes', label: `📝 Заметки (${noteEntries.length})` }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-all ${
                activeTab === key
                  ? theme === 'light'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'bg-white/10 text-white'
                  : theme === 'light'
                    ? 'text-gray-500 hover:text-gray-700'
                    : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'stats' && (
          <StatsSection
            completionHistory={stats.completionHistory}
            categoryTotalCompleted={stats.categoryTotalCompleted}
            totalCompleted={stats.totalCompleted}
            streak={stats.streak}
            categoryLevels={stats.categoryLevels}
            theme={theme}
          />
        )}

        {activeTab === 'quests' && (
          <JournalSection entries={journalEntries} type="quest_completed" theme={theme} />
        )}

        {activeTab === 'notes' && (
          <JournalSection entries={journalEntries} type="journal" theme={theme} />
        )}

        {/* Update quests button */}
        <Button
          onClick={() => setShowResetConfirm(true)}
          className="w-full h-11 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Обновить квесты
        </Button>

        {/* Reset Confirmation */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className={`rounded-2xl p-6 max-w-sm w-full ${theme === 'light' ? 'bg-white shadow-xl' : 'bg-[#1e2836]'}`}>
              <h2 className={`text-xl font-bold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>Обновить квесты?</h2>
              <p className={`text-sm mb-6 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Ваша история и достижения сохранятся. Мы создадим новые персонализированные квесты.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setShowResetConfirm(false)} variant="outline" className={theme === 'light' ? 'border-gray-300' : 'border-white/10'}>Отмена</Button>
                <Button onClick={() => { setShowResetConfirm(false); setShowOnboarding(true); }} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600">Да, обновить</Button>
              </div>
            </div>
          </div>
        )}

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
Для каждой категории создай 3 квеста (Level 1-3).
Категории: health, mind, work, money, love, friends.
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
                toast.success('Квесты обновлены! 🎉');
                setTimeout(() => { window.location.href = createPageUrl('DailyTracker'); }, 500);
              } catch (error) {
                console.error('Error:', error);
                toast.error('Ошибка при обновлении квестов');
                setShowOnboarding(false);
              }
            }}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}