import React, { useMemo } from 'react';
import { t } from '@/lib/i18n';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", color: "#00b894" },
  mind: { name: "Mind", icon: "🧠", color: "#a29bfe" },
  money: { name: "Money", icon: "💰", color: "#00cec9" },
  work: { name: "Work", icon: "💼", color: "#fdcb6e" },
  love: { name: "Love", icon: "❤️", color: "#ff7675" },
  friends: { name: "Friends", icon: "👥", color: "#fd79a8" }
};

export default function CategoryLevelsCard({ completionHistory = {}, journalEntries = [], categoryLevels = {}, theme = 'light' }) {
  const i = t();

  // Merge completionHistory + journal quest_completed entries
  const mergedHistory = useMemo(() => {
    const merged = {};
    Object.entries(completionHistory).forEach(([dateKey, quests]) => {
      merged[dateKey] = [...quests];
    });
    journalEntries.forEach(entry => {
      if (entry.type === 'quest_completed' && entry.date) {
        if (!merged[entry.date]) merged[entry.date] = [];
        const isDuplicate = merged[entry.date].some(q =>
          q.category === entry.category && (q.questName === entry.text || q.emoji === entry.emoji)
        );
        if (!isDuplicate) {
          merged[entry.date].push({
            category: entry.category,
            questName: entry.text,
            emoji: entry.emoji,
            level: entry.level || entry.questLevel
          });
        }
      }
    });
    return merged;
  }, [completionHistory, journalEntries]);

  const mergedCategoryCounts = useMemo(() => {
    const counts = {};
    Object.keys(CATEGORIES).forEach(cat => { counts[cat] = 0; });
    Object.values(mergedHistory).forEach(dayData => {
      dayData.forEach(q => {
        if (q.category && counts.hasOwnProperty(q.category)) {
          counts[q.category] += (q.level || 1);
        }
      });
    });
    return counts;
  }, [mergedHistory]);

  const maxCount = Math.max(...Object.values(mergedCategoryCounts), 1);

  return (
    <div className={`rounded-2xl p-4 border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'}`}>
      <h3 className={`text-sm font-bold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
        {i.stats.categories}
      </h3>
      <div className="space-y-2">
        {Object.entries(CATEGORIES)
          .sort((a, b) => (mergedCategoryCounts[b[0]] || 0) - (mergedCategoryCounts[a[0]] || 0))
          .map(([key, info]) => {
            const count = mergedCategoryCounts[key] || 0;
            const level = categoryLevels?.[key] || 1;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{info.icon}</span>
                    <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>{info.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>LVL {level}</span>
                    <span className={`text-xs font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{count}</span>
                  </div>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`}>
                  <div className="h-full transition-all duration-500" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: info.color }} />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}