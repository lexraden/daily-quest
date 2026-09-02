import React, { useState, useMemo } from 'react';
import { t, getLocale } from '@/lib/i18n';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", bgColor: "bg-green-500/10", textColor: "text-green-400", borderColor: "border-green-500/30" },
  mind: { name: "Mind", icon: "🧠", bgColor: "bg-purple-500/10", textColor: "text-purple-400", borderColor: "border-purple-500/30" },
  money: { name: "Money", icon: "💰", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400", borderColor: "border-cyan-500/30" },
  work: { name: "Work", icon: "💼", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400", borderColor: "border-yellow-500/30" },
  love: { name: "Love", icon: "❤️", bgColor: "bg-red-500/10", textColor: "text-red-400", borderColor: "border-red-500/30" },
  friends: { name: "Friends", icon: "👥", bgColor: "bg-pink-500/10", textColor: "text-pink-400", borderColor: "border-pink-500/30" }
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

export default function JournalSection({ entries, type, theme }) {
  const [filterCategory, setFilterCategory] = useState('all');
  const i = t();
  const j = i.journal;
  const title = type === 'quest_completed' ? j.completedQuests : j.notes;
  const icon = type === 'quest_completed' ? '🎯' : '📝';
  const emptyText = type === 'quest_completed' ? j.noQuests : j.noNotes;

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (e.type !== type) return false;
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      return true;
    });
  }, [entries, type, filterCategory]);

  const count = entries.filter(e => e.type === type).length;
  if (count === 0) return null;

  return (
    <div className={`rounded-2xl p-4 border ${
      theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className={`text-base font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            {title}
          </h3>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-white/5 text-gray-400'
        }`}>
          {filtered.length}
        </span>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        <FilterChip active={filterCategory === 'all'} onClick={() => setFilterCategory('all')} theme={theme}>
          {i.common.all}
        </FilterChip>
        {Object.entries(CATEGORIES).map(([key, info]) => (
          <FilterChip
            key={key}
            active={filterCategory === key}
            onClick={() => setFilterCategory(key)}
            theme={theme}
          >
            {info.icon} {info.name}
          </FilterChip>
        ))}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className={`text-center py-6 ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
            <p className="text-sm">{emptyText}</p>
          </div>
        ) : (
          filtered.slice(0, 50).map((entry) => {
            const catInfo = CATEGORIES[entry.category];
            const isQuest = entry.type === 'quest_completed';
            return (
              <div
                key={entry.id}
                className={`p-3 rounded-xl border ${
                  isQuest
                    ? theme === 'light'
                      ? 'bg-gradient-to-br from-purple-50 to-cyan-50 border-purple-200'
                      : 'bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30'
                    : theme === 'light'
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-white/5 border-white/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{entry.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                        {entry.text}
                      </p>
                      {isQuest && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                          theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300'
                        }`}>+1 XP</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${catInfo?.bgColor} ${catInfo?.textColor}`}>
                        {catInfo?.name || entry.category}
                      </span>
                      <span className={`text-xs ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {new Date(entry.timestamp).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}