import React from 'react';
import { ChevronRight } from 'lucide-react';
import { t, getLocale } from '@/lib/i18n';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", bgColor: "bg-green-500/10", textColor: "text-green-400" },
  mind: { name: "Mind", icon: "🧠", bgColor: "bg-purple-500/10", textColor: "text-purple-400" },
  money: { name: "Money", icon: "💰", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400" },
  work: { name: "Work", icon: "💼", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" },
  love: { name: "Love", icon: "❤️", bgColor: "bg-red-500/10", textColor: "text-red-400" },
  friends: { name: "Friends", icon: "👥", bgColor: "bg-pink-500/10", textColor: "text-pink-400" }
};

const EntryCard = React.memo(function EntryCard({ entry, compact = false, onSelect, theme }) {
  const i = t();
  const c = i.calories;
  const catInfo = CATEGORIES[entry.category];
  const isQuest = entry.type === 'quest_completed';
  const isMeal = entry.type === 'meal';

  if (compact) {
    const isClickable = !isQuest;
    return (
      <div
        onClick={() => isClickable && onSelect?.(entry)}
        className={`flex items-center gap-2 px-2.5 py-2.5 rounded-lg transition-all min-h-[44px] ${
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
          <span className={`text-[10px] font-bold flex-shrink-0 ${theme === 'light' ? 'text-orange-500' : 'text-orange-400'}`}>{Math.round(entry.calories)} {c.kcal}</span>
        )}
      </div>
    );
  }

  const isClickable = isMeal || (!isQuest);
  return (
    <div
      onClick={() => isClickable && onSelect?.(entry)}
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
                }`}>{Math.round(entry.calories)} {c.kcal}</span>
              )}
              {!isQuest && !isMeal && <ChevronRight className={`w-4 h-4 ${theme === 'light' ? 'text-gray-300' : 'text-gray-600'}`} />}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {isMeal ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-500">
                🍽️ {i.entryDetail.food}
              </span>
            ) : (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${catInfo?.bgColor} ${catInfo?.textColor}`}>
                {catInfo?.icon} {catInfo?.name || entry.category}
              </span>
            )}
            {entry.timestamp && (
              <span className={`text-xs ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
                {new Date(entry.timestamp).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {isMeal && (
            <div className="flex gap-3 mt-1.5 text-[10px]">
              <span className="text-red-500">P: {Math.round(entry.protein)}g</span>
              <span className="text-yellow-500">F: {Math.round(entry.fat)}g</span>
              <span className="text-green-500">C: {Math.round(entry.carbs)}g</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default EntryCard;