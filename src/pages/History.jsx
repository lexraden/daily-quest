import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCachedUser, getCachedUserData, updateCachedUserData, invalidateCache } from '@/components/UserDataCache';
import { base44 } from '@/api/base44Client';
import { t, getLocale } from '@/lib/i18n';
import EntryDetailModal from '@/components/history/EntryDetailModal';
import EntryCard from '@/components/history/EntryCard';
import VirtualizedEntryList from '@/components/history/VirtualizedEntryList';
import MealEditModal from '@/components/daily/MealEditModal';
import PullToRefresh from '@/components/navigation/PullToRefresh';
import StatsSection from '@/components/profile/StatsSection';

export default function History() {
  const i = t();
  const hp = i.historyPage;
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [completionHistory, setCompletionHistory] = useState({});
  const [journalEntries, setJournalEntries] = useState([]);
  const [mealHistory, setMealHistory] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingMeal, setEditingMeal] = useState(null);
  const [userDataId, setUserDataId] = useState(null);
  const [categoryTotalCompleted, setCategoryTotalCompleted] = useState({});
  const [categoryLevels, setCategoryLevels] = useState({});
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setTheme(localStorage.getItem('dailyQuestsTheme') || 'light');
    const loadData = async () => {
      const authUser = await getCachedUser();
      if (!authUser) return;
      const { data, id } = await getCachedUserData(authUser.email);
      if (data) {
        setCompletionHistory(data.completion_history || {});
        setJournalEntries(data.journal_entries || []);
        setMealHistory(data.meal_history || []);
        setCategoryTotalCompleted(data.category_total_completed || {});
        setCategoryLevels(data.category_levels || {});
        setTotalCompleted(data.total_completed || 0);
        setStreak(data.streak || 0);
        setUserDataId(id);
      }
    };
    loadData();
  }, []);

  const statsViewMode = viewMode === 'day' ? 'daily' : viewMode === 'week' ? 'weekly' : 'monthly';

  const formatDateKey = (date) => date.toISOString().split('T')[0];

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const navigatePrevious = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const monthsGen = hp.monthsGen;
  const months = hp.months;
  const dayNames = hp.dayNames;
  const dayNamesShort = hp.dayNamesShort;

  const formatTitle = () => {
    if (viewMode === 'day') return `${dayNames[currentDate.getDay()]}, ${currentDate.getDate()} ${monthsGen[currentDate.getMonth()]}`;
    if (viewMode === 'week') {
      const start = getWeekStart(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()} ${monthsGen[start.getMonth()]} — ${end.getDate()} ${monthsGen[end.getMonth()]}`;
    }
    return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d;
  };

  const getEntriesForDate = useCallback((dateKey) => {
    const items = [];
    const quests = completionHistory[dateKey] || [];
    quests.forEach((quest, idx) => {
      items.push({
        id: `quest_${dateKey}_${idx}`,
        type: 'quest_completed',
        date: dateKey,
        category: quest.category,
        emoji: quest.emoji,
        text: quest.questName,
        level: quest.level,
        timestamp: quest.timestamp || `${dateKey}T12:00:00`
      });
    });
    journalEntries.forEach(entry => {
      if (entry.date === dateKey) items.push(entry);
    });
    mealHistory.forEach((meal, idx) => {
      if (meal.date === dateKey) {
        items.push({
          id: `meal_${dateKey}_${idx}`,
          type: 'meal',
          date: dateKey,
          emoji: '🍽️',
          text: `${meal.meal_name} — ${Math.round(meal.calories)} ккал`,
          calories: meal.calories,
          protein: meal.protein,
          fat: meal.fat,
          carbs: meal.carbs,
          photo_urls: meal.photo_urls,
          timestamp: meal.timestamp || `${dateKey}T12:00:00`
        });
      }
    });
    items.sort((a, b) => {
      const tsA = a.timestamp || `${a.date}T00:00:00`;
      const tsB = b.timestamp || `${b.date}T00:00:00`;
      return tsB.localeCompare(tsA);
    });
    return items;
  }, [completionHistory, journalEntries, mealHistory]);

  const formatSmallDate = useCallback((dateStr) => {
    const todayKey = formatDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterdayDate);
    if (dateStr === todayKey) return i.common.today;
    if (dateStr === yesterdayKey) return i.common.yesterday;
    const date = new Date(dateStr + 'T12:00:00');
    return `${dayNamesShort[date.getDay()]}, ${date.getDate()} ${monthsGen[date.getMonth()]}`;
  }, []);

  const handleSelectEntry = useCallback((entry) => setSelectedEntry(entry), []);

  const renderSummary = (questCount, noteCount, totalCount) => (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${
      theme === 'light' ? 'bg-white border border-gray-200' : 'bg-white/5 border border-white/5'
    }`}>
      <div className="text-center flex-1">
        <div className={`text-2xl font-bold ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>{questCount}</div>
        <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>🎯 {i.common.quests}</div>
      </div>
      <div className={`w-px h-8 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
      <div className="text-center flex-1">
        <div className={`text-2xl font-bold ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}>{noteCount}</div>
        <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>📝 {i.common.notes}</div>
      </div>
      <div className={`w-px h-8 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
      <div className="text-center flex-1">
        <div className={`text-2xl font-bold ${theme === 'light' ? 'text-green-600' : 'text-green-400'}`}>{totalCount}</div>
        <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>{i.common.total}</div>
      </div>
    </div>
  );

  const renderEmpty = () => (
    <div className="text-center py-12">
      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
        theme === 'light' ? 'bg-gray-100' : 'bg-white/5'
      }`}>
        <span className="text-2xl">📋</span>
      </div>
      <p className={`text-sm ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
        {hp.noRecords}
      </p>
    </div>
  );

  // ========== DAY VIEW ==========
  const dayEntries = useMemo(() => getEntriesForDate(formatDateKey(currentDate)), [currentDate, getEntriesForDate]);

  const renderStats = () => (
    <StatsSection
      completionHistory={completionHistory}
      categoryTotalCompleted={categoryTotalCompleted}
      totalCompleted={totalCompleted}
      streak={streak}
      categoryLevels={categoryLevels}
      theme={theme}
      journalEntries={journalEntries}
      viewMode={statsViewMode}
      hideTabs
    />
  );

  const renderDayView = () => {
    if (dayEntries.length === 0) return renderEmpty();
    const questCount = dayEntries.filter(e => e.type === 'quest_completed').length;
    const noteCount = dayEntries.filter(e => e.type === 'journal').length;
    return (
      <div className="space-y-3">
        {renderSummary(questCount, noteCount, dayEntries.length)}
        {renderStats()}
        {dayEntries.map(entry => (
          <EntryCard key={entry.id} entry={entry} onSelect={handleSelectEntry} theme={theme} />
        ))}
      </div>
    );
  };

  // ========== WEEK VIEW ==========
  const weekData = useMemo(() => {
    const start = getWeekStart(currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    const allEntries = days.flatMap(d => getEntriesForDate(formatDateKey(d)));
    return { days, allEntries };
  }, [currentDate, getEntriesForDate]);

  const renderWeekView = () => {
    const { days, allEntries } = weekData;
    if (allEntries.length === 0) return renderEmpty();

    return (
      <div className="space-y-2">
        {renderSummary(
          allEntries.filter(e => e.type === 'quest_completed').length,
          allEntries.filter(e => e.type === 'journal').length,
          allEntries.length
        )}
        {renderStats()}
        {days.map((date) => {
          const dateKey = formatDateKey(date);
          const entries = getEntriesForDate(dateKey);
          const today = isToday(date);
          return (
            <div key={dateKey} className={`rounded-xl border overflow-hidden transition-all ${
              today
                ? theme === 'light' ? 'bg-purple-50/50 border-purple-200' : 'bg-purple-500/5 border-purple-500/30'
                : theme === 'light' ? 'bg-white border-gray-200' : 'bg-white/[0.03] border-white/5'
            }`}>
              <div className={`flex items-center justify-between px-3 py-2 ${entries.length > 0 ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                    today ? 'bg-purple-600 text-white' : theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                  }`}>{date.getDate()}</span>
                  <span className={`text-xs ${
                    today ? (theme === 'light' ? 'text-purple-600 font-semibold' : 'text-purple-400 font-semibold') : (theme === 'light' ? 'text-gray-500' : 'text-gray-500')
                  }`}>{dayNamesShort[date.getDay()]}</span>
                </div>
                {entries.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {entries.filter(e => e.type === 'quest_completed').length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        theme === 'light' ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'
                      }`}>🎯 {entries.filter(e => e.type === 'quest_completed').length}</span>
                    )}
                    {entries.filter(e => e.type === 'journal').length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'
                      }`}>📝 {entries.filter(e => e.type === 'journal').length}</span>
                    )}
                  </div>
                )}
              </div>
              {entries.length > 0 && (
                <div className="px-2 pb-2 space-y-1">
                  {entries.map(entry => (
                    <EntryCard key={entry.id} entry={entry} compact onSelect={handleSelectEntry} theme={theme} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ========== MONTH VIEW ==========
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const cells = [];
    for (let i = 0; i < startPadding; i++) cells.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) cells.push(new Date(year, month, i));

    const allEntries = [];
    const datesWithEntries = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dk = formatDateKey(d);
      const entries = getEntriesForDate(dk);
      allEntries.push(...entries);
      if (entries.length > 0) datesWithEntries.push({ dateKey: dk, entries });
    }
    datesWithEntries.reverse();

    return { cells, allEntries, datesWithEntries };
  }, [currentDate, getEntriesForDate]);

  const renderMonthView = () => {
    const { cells, allEntries, datesWithEntries } = monthData;
    const monthQuestCount = allEntries.filter(e => e.type === 'quest_completed').length;
    const monthNoteCount = allEntries.filter(e => e.type === 'journal').length;

    return (
      <div className="space-y-3">
        {allEntries.length > 0 && renderSummary(monthQuestCount, monthNoteCount, allEntries.length)}
        {renderStats()}

        {/* Day names header */}
        <div className="grid grid-cols-7 gap-1">
          {hp.dayNamesShortMon.map(d => (
            <div key={d} className={`text-center text-[10px] font-medium py-1 ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, idx) => {
            if (!date) return <div key={`empty_${idx}`} className="aspect-square" />;
            const dateKey = formatDateKey(date);
            const entries = getEntriesForDate(dateKey);
            const today = isToday(date);
            const total = entries.length;
            return (
              <div key={dateKey} className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center relative transition-all ${
                today
                  ? theme === 'light' ? 'bg-purple-100 ring-2 ring-purple-400' : 'bg-purple-500/20 ring-2 ring-purple-500'
                  : total > 0
                    ? theme === 'light' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white/5 hover:bg-white/10'
                    : ''
              }`}>
                <span className={`text-xs font-medium ${
                  today
                    ? theme === 'light' ? 'text-purple-700' : 'text-purple-300'
                    : total > 0
                      ? theme === 'light' ? 'text-gray-900' : 'text-white'
                      : theme === 'light' ? 'text-gray-400' : 'text-gray-600'
                }`}>{date.getDate()}</span>
                {total > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {entries.some(e => e.type === 'quest_completed') && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                    {entries.some(e => e.type === 'journal') && <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
                    {entries.some(e => e.type === 'meal') && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Virtualized entry list for the month */}
        {datesWithEntries.length > 0 ? (
          <VirtualizedEntryList
            dateGroups={datesWithEntries}
            onSelect={handleSelectEntry}
            formatSmallDate={formatSmallDate}
            theme={theme}
          />
        ) : renderEmpty()}
      </div>
    );
  };

  const bgClass = theme === 'light'
    ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
    : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white';

  const handlePullRefresh = async () => {
    invalidateCache();
    const authUser = await getCachedUser();
    if (!authUser) return;
    const { data, id } = await getCachedUserData(authUser.email);
    if (data) {
      setCompletionHistory(data.completion_history || {});
      setJournalEntries(data.journal_entries || []);
      setMealHistory(data.meal_history || []);
      setUserDataId(id);
    }
  };

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className={`min-h-screen ${bgClass} pb-4`}>
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' ? 'bg-white/80 border-gray-200' : 'bg-[#0f1419]/80 border-white/10'
      }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{hp.title}</h1>
          </div>
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className={`w-full ${theme === 'light' ? 'bg-black/5' : 'bg-white/5'}`}>
              <TabsTrigger value="day" className="flex-1 min-h-[44px]">{hp.day}</TabsTrigger>
              <TabsTrigger value="week" className="flex-1 min-h-[44px]">{hp.week}</TabsTrigger>
              <TabsTrigger value="month" className="flex-1 min-h-[44px]">{hp.month}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="px-5 py-3 space-y-3 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Button onClick={navigatePrevious} variant="ghost" size="icon" aria-label={hp.prevPeriod}
            className={`h-11 w-11 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-sm font-semibold">{formatTitle()}</h2>
          </div>
          <Button onClick={navigateNext} variant="ghost" size="icon" aria-label={hp.nextPeriod}
            className={`h-11 w-11 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {!isToday(currentDate) && (
          <div className="flex justify-center">
            <Button onClick={() => setCurrentDate(new Date())} variant="outline" size="sm" aria-label={hp.goToToday}
              className={`min-h-[44px] ${theme === 'light' ? 'border-purple-400 text-purple-600 hover:bg-purple-50 text-xs' : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs'}`}>
              {i.common.today}
            </Button>
          </div>
        )}

        {viewMode === 'day' && renderDayView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
      </div>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onEditMeal={(entry) => {
            const idx = mealHistory.findIndex(m =>
              m.date === entry.date && m.meal_name === entry.text?.split(' — ')[0] && m.timestamp === entry.timestamp
            );
            if (idx !== -1) {
              setEditingMeal({ meal: mealHistory[idx], index: idx });
              setSelectedEntry(null);
            }
          }}
          theme={theme}
        />
      )}

      {editingMeal && (
        <MealEditModal
          meal={editingMeal.meal}
          mealIndex={editingMeal.index}
          onSave={(idx, updated) => {
            const newHistory = [...mealHistory];
            newHistory[idx] = updated;
            setMealHistory(newHistory);
            if (userDataId) {
              updateCachedUserData(userDataId, { meal_history: newHistory });
              base44.entities.UserQuestData.update(userDataId, { meal_history: newHistory });
            }
          }}
          onDelete={(idx) => {
            const newHistory = mealHistory.filter((_, i) => i !== idx);
            setMealHistory(newHistory);
            if (userDataId) {
              updateCachedUserData(userDataId, { meal_history: newHistory });
              base44.entities.UserQuestData.update(userDataId, { meal_history: newHistory });
            }
          }}
          onClose={() => setEditingMeal(null)}
          theme={theme}
        />
      )}
    </PullToRefresh>
  );
}