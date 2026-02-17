import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { getCachedUser, getCachedUserData } from '@/components/UserDataCache';
import EntryDetailModal from '@/components/history/EntryDetailModal';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", bgColor: "bg-green-500/10", textColor: "text-green-400", borderColor: "border-green-500/30", color: "#00b894" },
  mind: { name: "Mind", icon: "🧠", bgColor: "bg-purple-500/10", textColor: "text-purple-400", borderColor: "border-purple-500/30", color: "#a29bfe" },
  money: { name: "Money", icon: "💰", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400", borderColor: "border-cyan-500/30", color: "#00cec9" },
  work: { name: "Work", icon: "💼", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400", borderColor: "border-yellow-500/30", color: "#fdcb6e" },
  love: { name: "Love", icon: "❤️", bgColor: "bg-red-500/10", textColor: "text-red-400", borderColor: "border-red-500/30", color: "#ff7675" },
  friends: { name: "Friends", icon: "👥", bgColor: "bg-pink-500/10", textColor: "text-pink-400", borderColor: "border-pink-500/30", color: "#fd79a8" }
};

function FilterChip({ active, onClick, children, theme }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
        active
          ? theme === 'light'
            ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
            : 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-white border border-purple-500/50'
          : theme === 'light'
            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            : 'bg-white/5 text-gray-400 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export default function History() {
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [completionHistory, setCompletionHistory] = useState({});
  const [journalEntries, setJournalEntries] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all'); // 'all', 'quests', 'notes'
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    setTheme(localStorage.getItem('dailyQuestsTheme') || 'light');
    const loadData = async () => {
      const authUser = await getCachedUser();
      if (!authUser) return;
      const { data } = await getCachedUserData(authUser.email);
      if (data) {
        setCompletionHistory(data.completion_history || {});
        setJournalEntries(data.journal_entries || []);
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

  const formatTitle = () => {
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const monthsGen = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    if (viewMode === 'day') return `${days[currentDate.getDay()]}, ${currentDate.getDate()} ${monthsGen[currentDate.getMonth()]}`;
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      const dow = start.getDay();
      start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()} ${monthsGen[start.getMonth()]} — ${end.getDate()} ${monthsGen[end.getMonth()]}`;
    }
    return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  // Get entries for date range
  const getDateRange = () => {
    if (viewMode === 'day') return [formatDateKey(currentDate)];
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      const dow = start.getDay();
      start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        dates.push(formatDateKey(d));
      }
      return dates;
    }
    // month
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dates = [];
    for (let i = 1; i <= lastDay; i++) {
      dates.push(formatDateKey(new Date(year, month, i)));
    }
    return dates;
  };

  const allEntries = useMemo(() => {
    const dateRange = getDateRange();
    const items = [];

    // Add quests from completionHistory
    dateRange.forEach(dateKey => {
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
          timestamp: `${dateKey}T12:00:00`
        });
      });
    });

    // Add journal entries
    journalEntries.forEach(entry => {
      if (dateRange.includes(entry.date)) {
        items.push(entry);
      }
    });

    // Filter
    let filtered = items;
    if (filterType === 'quests') filtered = filtered.filter(e => e.type === 'quest_completed');
    if (filterType === 'notes') filtered = filtered.filter(e => e.type === 'journal');
    if (filterCategory !== 'all') filtered = filtered.filter(e => e.category === filterCategory);

    // Sort by date desc, then timestamp desc
    filtered.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    return filtered;
  }, [completionHistory, journalEntries, currentDate, viewMode, filterType, filterCategory]);

  // Group by date
  const groupedEntries = useMemo(() => {
    const groups = {};
    allEntries.forEach(entry => {
      if (!groups[entry.date]) groups[entry.date] = [];
      groups[entry.date].push(entry);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allEntries]);

  const formatGroupDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    const monthsGen = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const todayKey = formatDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterdayDate);

    if (dateStr === todayKey) return 'Сегодня';
    if (dateStr === yesterdayKey) return 'Вчера';
    return `${days[date.getDay()]}, ${date.getDate()} ${monthsGen[date.getMonth()]}`;
  };

  const bgClass = theme === 'light'
    ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
    : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white';

  const questCount = allEntries.filter(e => e.type === 'quest_completed').length;
  const noteCount = allEntries.filter(e => e.type === 'journal').length;

  return (
    <div className={`min-h-screen ${bgClass} pb-8`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' ? 'bg-white/80 border-gray-200' : 'bg-[#0f1419]/80 border-white/10'
      }`}>
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>История</h1>
            <Link to={createPageUrl('DailyTracker')}>
              <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-full ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
                <X className="w-5 h-5" />
              </Button>
            </Link>
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

        {/* Type filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={filterType === 'all'} onClick={() => setFilterType('all')} theme={theme}>
            Все ({allEntries.length})
          </FilterChip>
          <FilterChip active={filterType === 'quests'} onClick={() => setFilterType('quests')} theme={theme}>
            🎯 Квесты ({questCount})
          </FilterChip>
          <FilterChip active={filterType === 'notes'} onClick={() => setFilterType('notes')} theme={theme}>
            📝 Заметки ({noteCount})
          </FilterChip>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={filterCategory === 'all'} onClick={() => setFilterCategory('all')} theme={theme}>
            Все
          </FilterChip>
          {Object.entries(CATEGORIES).map(([key, info]) => (
            <FilterChip key={key} active={filterCategory === key} onClick={() => setFilterCategory(key)} theme={theme}>
              {info.icon} {info.name}
            </FilterChip>
          ))}
        </div>

        {/* Entries grouped by date */}
        {groupedEntries.length === 0 ? (
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
        ) : (
          groupedEntries.map(([dateKey, entries]) => (
            <div key={dateKey}>
              <div className={`text-xs font-semibold mb-2 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                {formatGroupDate(dateKey)}
              </div>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const catInfo = CATEGORIES[entry.category];
                  const isQuest = entry.type === 'quest_completed';

                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer active:scale-[0.98] ${
                        isQuest
                          ? theme === 'light'
                            ? 'bg-gradient-to-br from-purple-50 to-cyan-50 border-purple-200'
                            : 'bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30'
                          : theme === 'light'
                            ? 'bg-white border-gray-200'
                            : 'bg-[#1e2836] border-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0">{entry.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium line-clamp-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                              {entry.text}
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isQuest && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                  theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300'
                                }`}>+1 XP</span>
                              )}
                              <ChevronRight className={`w-4 h-4 ${theme === 'light' ? 'text-gray-300' : 'text-gray-600'}`} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${catInfo?.bgColor} ${catInfo?.textColor}`}>
                              {catInfo?.icon} {catInfo?.name || entry.category}
                            </span>
                            <span className={`text-xs ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
                              {isQuest ? '🎯' : '📝'}
                            </span>
                            {entry.timestamp && (
                              <span className={`text-xs ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
                                {new Date(entry.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          theme={theme}
        />
      )}
    </div>
  );
}