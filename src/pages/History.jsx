import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCachedUser, getCachedUserData, updateCachedUserData, invalidateCache } from '@/components/UserDataCache';
import { base44 } from '@/api/base44Client';
import EntryDetailModal from '@/components/history/EntryDetailModal';
import MealEditModal from '@/components/daily/MealEditModal';
import PullToRefresh from '@/components/navigation/PullToRefresh';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", bgColor: "bg-green-500/10", textColor: "text-green-400", color: "#00b894" },
  mind: { name: "Mind", icon: "🧠", bgColor: "bg-purple-500/10", textColor: "text-purple-400", color: "#a29bfe" },
  money: { name: "Money", icon: "💰", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400", color: "#00cec9" },
  work: { name: "Work", icon: "💼", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400", color: "#fdcb6e" },
  love: { name: "Love", icon: "❤️", bgColor: "bg-red-500/10", textColor: "text-red-400", color: "#ff7675" },
  friends: { name: "Friends", icon: "👥", bgColor: "bg-pink-500/10", textColor: "text-pink-400", color: "#fd79a8" }
};

export default function History() {
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [completionHistory, setCompletionHistory] = useState({});
  const [journalEntries, setJournalEntries] = useState([]);
  const [mealHistory, setMealHistory] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingMeal, setEditingMeal] = useState(null);
  const [userDataId, setUserDataId] = useState(null);

  useEffect(() => {
    setTheme(localStorage.getItem('dailyQuestsTheme') || 'light');
    const loadData = async () => {
      const authUser = await getCachedUser();
      if (!authUser) return;
      const { data } = await getCachedUserData(authUser.email);
      if (data) {
        setCompletionHistory(data.completion_history || {});
        setJournalEntries(data.journal_entries || []);
        setMealHistory(data.meal_history || []);
        const { id } = await getCachedUserData(authUser.email);
        setUserDataId(id);
      }
    };
    loadData();
  }, []);

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

  const monthsGen = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const dayNames = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const dayNamesShort = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

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

  // Build entries for a specific date
  const getEntriesForDate = (dateKey) => {
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
    // Sort by timestamp descending (newest first), use index as tiebreaker for same-time entries
    items.sort((a, b) => {
      const tsA = a.timestamp || `${a.date}T00:00:00`;
      const tsB = b.timestamp || `${b.date}T00:00:00`;
      return tsB.localeCompare(tsA);
    });
    return items;
  };

  const formatSmallDate = (dateStr) => {
    const todayKey = formatDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterdayDate);
    if (dateStr === todayKey) return 'Сегодня';
    if (dateStr === yesterdayKey) return 'Вчера';
    const date = new Date(dateStr + 'T12:00:00');
    return `${dayNamesShort[date.getDay()]}, ${date.getDate()} ${monthsGen[date.getMonth()]}`;
  };

  // ========== ENTRY CARD (reused across views) ==========
  const EntryCard = ({ entry, compact = false }) => {
    const catInfo = CATEGORIES[entry.category];
    const isQuest = entry.type === 'quest_completed';
    const isMeal = entry.type === 'meal';

    if (compact) {
      const isClickable = !isQuest;
      return (
        <div
          onClick={() => isClickable && setSelectedEntry(entry)}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
            isClickable ? 'cursor-pointer active:scale-[0.97]' : ''
          } ${
            isMeal
              ? theme === 'light' ? 'bg-orange-50' : 'bg-orange-500/10'
              : isQuest
                ? theme === 'light' ? 'bg-purple-50' : 'bg-purple-500/10'
                : theme === 'light' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          <span className="text-sm">{entry.emoji}</span>
          <span className={`text-xs truncate flex-1 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
            {entry.text}
          </span>
          {isQuest && (
            <span className={`text-[10px] font-bold flex-shrink-0 ${theme === 'light' ? 'text-purple-500' : 'text-purple-400'}`}>+{entry.level || 1} XP</span>
          )}
          {isMeal && (
            <span className={`text-[10px] font-bold flex-shrink-0 ${theme === 'light' ? 'text-orange-500' : 'text-orange-400'}`}>{Math.round(entry.calories)} ккал</span>
          )}
        </div>
      );
    }

    const isClickable = isMeal || (!isQuest);
    return (
      <div
        onClick={() => isClickable && setSelectedEntry(entry)}
        className={`p-3 rounded-xl border transition-all ${
          isClickable ? 'cursor-pointer active:scale-[0.98]' : ''
        } ${
          isMeal
            ? theme === 'light'
              ? 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200'
              : 'bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/30'
            : isQuest
              ? theme === 'light'
                ? 'bg-gradient-to-br from-purple-50 to-cyan-50 border-purple-200'
                : 'bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30'
              : theme === 'light'
                ? 'bg-white border-gray-200'
                : 'bg-[#1e2836] border-white/10'
        }`}
      >
        <div className="flex items-start gap-3">
          {isMeal && entry.photo_urls?.[0] ? (
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
              <img src={entry.photo_urls[0]} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <span className="text-xl flex-shrink-0">{entry.emoji}</span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-medium line-clamp-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {entry.text}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isQuest && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300'
                  }`}>+{entry.level || 1} XP</span>
                )}
                {isMeal && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    theme === 'light' ? 'bg-orange-100 text-orange-700' : 'bg-orange-500/20 text-orange-300'
                  }`}>{Math.round(entry.calories)} ккал</span>
                )}
                {!isQuest && !isMeal && <ChevronRight className={`w-4 h-4 ${theme === 'light' ? 'text-gray-300' : 'text-gray-600'}`} />}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {isMeal ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-500`}>
                  🍽️ Еда
                </span>
              ) : (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${catInfo?.bgColor} ${catInfo?.textColor}`}>
                  {catInfo?.icon} {catInfo?.name || entry.category}
                </span>
              )}
              {entry.timestamp && (
                <span className={`text-xs ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {new Date(entry.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            {isMeal && (
              <div className="flex gap-3 mt-1.5 text-[10px]">
                <span className="text-red-500">Б: {Math.round(entry.protein)}г</span>
                <span className="text-yellow-500">Ж: {Math.round(entry.fat)}г</span>
                <span className="text-green-500">У: {Math.round(entry.carbs)}г</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ========== DAY VIEW ==========
  const renderDayView = () => {
    const dateKey = formatDateKey(currentDate);
    const entries = getEntriesForDate(dateKey);
    const questCount = entries.filter(e => e.type === 'quest_completed').length;
    const noteCount = entries.filter(e => e.type === 'journal').length;

    if (entries.length === 0) return renderEmpty();

    return (
      <div className="space-y-3">
        {/* Day summary */}
        <div className={`flex items-center gap-3 p-3 rounded-xl ${
          theme === 'light' ? 'bg-white border border-gray-200' : 'bg-white/5 border border-white/5'
        }`}>
          <div className="text-center flex-1">
            <div className={`text-2xl font-bold ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>{questCount}</div>
            <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>🎯 квестов</div>
          </div>
          <div className={`w-px h-8 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <div className="text-center flex-1">
            <div className={`text-2xl font-bold ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}>{noteCount}</div>
            <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>📝 заметок</div>
          </div>
          <div className={`w-px h-8 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <div className="text-center flex-1">
            <div className={`text-2xl font-bold ${theme === 'light' ? 'text-green-600' : 'text-green-400'}`}>{entries.length}</div>
            <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>всего</div>
          </div>
        </div>

        {/* Full entry cards */}
        {entries.map(entry => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    );
  };

  // ========== WEEK VIEW ==========
  const renderWeekView = () => {
    const start = getWeekStart(currentDate);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      weekDays.push(d);
    }

    const allWeekEntries = weekDays.flatMap(d => getEntriesForDate(formatDateKey(d)));
    const hasAnyEntries = allWeekEntries.length > 0;
    if (!hasAnyEntries) return renderEmpty();

    const weekQuestCount = allWeekEntries.filter(e => e.type === 'quest_completed').length;
    const weekNoteCount = allWeekEntries.filter(e => e.type === 'journal').length;

    return (
      <div className="space-y-2">
        {/* Week summary */}
        <div className={`flex items-center gap-3 p-3 rounded-xl ${
          theme === 'light' ? 'bg-white border border-gray-200' : 'bg-white/5 border border-white/5'
        }`}>
          <div className="text-center flex-1">
            <div className={`text-2xl font-bold ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>{weekQuestCount}</div>
            <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>🎯 квестов</div>
          </div>
          <div className={`w-px h-8 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <div className="text-center flex-1">
            <div className={`text-2xl font-bold ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}>{weekNoteCount}</div>
            <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>📝 заметок</div>
          </div>
          <div className={`w-px h-8 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <div className="text-center flex-1">
            <div className={`text-2xl font-bold ${theme === 'light' ? 'text-green-600' : 'text-green-400'}`}>{allWeekEntries.length}</div>
            <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>всего</div>
          </div>
        </div>

        {weekDays.map((date) => {
          const dateKey = formatDateKey(date);
          const entries = getEntriesForDate(dateKey);
          const today = isToday(date);

          return (
            <div
              key={dateKey}
              className={`rounded-xl border overflow-hidden transition-all ${
                today
                  ? theme === 'light'
                    ? 'bg-purple-50/50 border-purple-200'
                    : 'bg-purple-500/5 border-purple-500/30'
                  : theme === 'light'
                    ? 'bg-white border-gray-200'
                    : 'bg-white/[0.03] border-white/5'
              }`}
            >
              {/* Day header row */}
              <div className={`flex items-center justify-between px-3 py-2 ${
                entries.length > 0 ? '' : 'opacity-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                    today
                      ? 'bg-purple-600 text-white'
                      : theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    {date.getDate()}
                  </span>
                  <span className={`text-xs ${
                    today ? (theme === 'light' ? 'text-purple-600 font-semibold' : 'text-purple-400 font-semibold') : (theme === 'light' ? 'text-gray-500' : 'text-gray-500')
                  }`}>
                    {dayNamesShort[date.getDay()]}
                  </span>
                </div>
                {entries.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {entries.filter(e => e.type === 'quest_completed').length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        theme === 'light' ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        🎯 {entries.filter(e => e.type === 'quest_completed').length}
                      </span>
                    )}
                    {entries.filter(e => e.type === 'journal').length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        📝 {entries.filter(e => e.type === 'journal').length}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Compact entries */}
              {entries.length > 0 && (
                <div className={`px-2 pb-2 space-y-1`}>
                  {entries.map(entry => (
                    <EntryCard key={entry.id} entry={entry} compact />
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
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    // Build calendar cells
    const cells = [];
    for (let i = 0; i < startPadding; i++) cells.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) cells.push(new Date(year, month, i));

    // Collect all month entries for summary
    const allMonthEntries = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dk = formatDateKey(d);
      allMonthEntries.push(...getEntriesForDate(dk));
    }
    const monthQuestCount = allMonthEntries.filter(e => e.type === 'quest_completed').length;
    const monthNoteCount = allMonthEntries.filter(e => e.type === 'journal').length;

    return (
      <div className="space-y-3">
        {/* Month summary */}
        {allMonthEntries.length > 0 && (
          <div className={`flex items-center gap-3 p-3 rounded-xl ${
            theme === 'light' ? 'bg-white border border-gray-200' : 'bg-white/5 border border-white/5'
          }`}>
            <div className="text-center flex-1">
              <div className={`text-2xl font-bold ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>{monthQuestCount}</div>
              <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>🎯 квестов</div>
            </div>
            <div className={`w-px h-8 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
            <div className="text-center flex-1">
              <div className={`text-2xl font-bold ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}>{monthNoteCount}</div>
              <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>📝 заметок</div>
            </div>
            <div className={`w-px h-8 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
            <div className="text-center flex-1">
              <div className={`text-2xl font-bold ${theme === 'light' ? 'text-green-600' : 'text-green-400'}`}>{allMonthEntries.length}</div>
              <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>всего</div>
            </div>
          </div>
        )}

        {/* Day names header */}
        <div className="grid grid-cols-7 gap-1">
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
            <div key={d} className={`text-center text-[10px] font-medium py-1 ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, idx) => {
            if (!date) return <div key={`empty_${idx}`} className="aspect-square" />;

            const dateKey = formatDateKey(date);
            const entries = getEntriesForDate(dateKey);
            const today = isToday(date);
            const questCount = entries.filter(e => e.type === 'quest_completed').length;
            const noteCount = entries.filter(e => e.type === 'journal').length;
            const total = entries.length;

            return (
              <div
                key={dateKey}
                className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center relative transition-all ${
                  today
                    ? theme === 'light' ? 'bg-purple-100 ring-2 ring-purple-400' : 'bg-purple-500/20 ring-2 ring-purple-500'
                    : total > 0
                      ? theme === 'light' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white/5 hover:bg-white/10'
                      : ''
                }`}
              >
                <span className={`text-xs font-medium ${
                  today
                    ? theme === 'light' ? 'text-purple-700' : 'text-purple-300'
                    : total > 0
                      ? theme === 'light' ? 'text-gray-900' : 'text-white'
                      : theme === 'light' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {date.getDate()}
                </span>
                {total > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {questCount > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    )}
                    {noteCount > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    )}
                    {entries.some(e => e.type === 'meal') && (
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Month summary: list of dates that have entries */}
        {(() => {
          const datesWithEntries = [];
          for (let i = 1; i <= lastDay.getDate(); i++) {
            const d = new Date(year, month, i);
            const dk = formatDateKey(d);
            const entries = getEntriesForDate(dk);
            if (entries.length > 0) datesWithEntries.push({ dateKey: dk, entries });
          }

          if (datesWithEntries.length === 0) return renderEmpty();

          return (
            <div className="space-y-3 mt-2">
              <div className={`text-xs font-semibold ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                Записи за месяц
              </div>
              {datesWithEntries.reverse().map(({ dateKey, entries }) => (
                <div key={dateKey}>
                  <div className={`flex items-center gap-2 mb-1.5`}>
                    <div className={`text-xs font-semibold ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                      {formatSmallDate(dateKey)}
                    </div>
                    <div className={`flex-1 h-px ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
                    <div className={`text-[10px] ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {entries.length}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {entries.map(entry => (
                      <EntryCard key={entry.id} entry={entry} compact />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderEmpty = () => (
    <div className="text-center py-12">
      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
        theme === 'light' ? 'bg-gray-100' : 'bg-white/5'
      }`}>
        <span className="text-2xl">📋</span>
      </div>
      <p className={`text-sm ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
        Нет записей за этот период
      </p>
    </div>
  );

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
    <PullToRefresh onRefresh={handlePullRefresh} className={`min-h-screen ${bgClass} pb-8`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' ? 'bg-white/80 border-gray-200' : 'bg-[#0f1419]/80 border-white/10'
      }`}>
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>История</h1>
          </div>
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className={`w-full ${theme === 'light' ? 'bg-black/5' : 'bg-white/5'}`}>
              <TabsTrigger value="day" className="flex-1">День</TabsTrigger>
              <TabsTrigger value="week" className="flex-1">Неделя</TabsTrigger>
              <TabsTrigger value="month" className="flex-1">Месяц</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="px-5 py-3 space-y-3 max-w-2xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button onClick={navigatePrevious} variant="ghost" size="icon"
            className={`h-9 w-9 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-sm font-semibold">{formatTitle()}</h2>
          </div>
          <Button onClick={navigateNext} variant="ghost" size="icon"
            className={`h-9 w-9 rounded-full ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'}`}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Today button */}
        {!isToday(currentDate) && (
          <div className="flex justify-center">
            <Button onClick={() => setCurrentDate(new Date())} variant="outline" size="sm"
              className={theme === 'light' ? 'border-purple-400 text-purple-600 hover:bg-purple-50 text-xs h-7' : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs h-7'}>
              Сегодня
            </Button>
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
      </div>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onEditMeal={(entry) => {
            // Find the actual index in mealHistory
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

      {/* Meal Edit Modal */}
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