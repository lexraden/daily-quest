import React from 'react';
import { X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t, getLocale } from '@/lib/i18n';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", bgColor: "bg-green-500/10", textColor: "text-green-400" },
  mind: { name: "Mind", icon: "🧠", bgColor: "bg-purple-500/10", textColor: "text-purple-400" },
  money: { name: "Money", icon: "💰", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400" },
  work: { name: "Work", icon: "💼", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" },
  love: { name: "Love", icon: "❤️", bgColor: "bg-red-500/10", textColor: "text-red-400" },
  friends: { name: "Friends", icon: "👥", bgColor: "bg-pink-500/10", textColor: "text-pink-400" }
};

export default function EntryDetailModal({ entry, onClose, onEditMeal, theme }) {
  const i = t();
  const ed = i.entryDetail;
  const c = i.calories;
  if (!entry) return null;

  const catInfo = CATEGORIES[entry.category];
  const isQuest = entry.type === 'quest_completed';
  const isMeal = entry.type === 'meal';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[85vh] flex flex-col ${
          theme === 'light' ? 'bg-white shadow-xl' : 'bg-[#1e2836]'
        }`}
      >
        {/* Meal photo */}
        {isMeal && entry.photo_urls?.[0] && (
          <div className="w-full h-48 overflow-hidden">
            <img src={entry.photo_urls[0]} alt={entry.text} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Header */}
        <div className={`px-5 pt-4 pb-3 flex items-start justify-between border-b ${
          theme === 'light' ? 'border-gray-100' : 'border-white/5'
        }`}>
          <div className="flex items-center gap-3">
            {!isMeal && <span className="text-3xl">{entry.emoji}</span>}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {isMeal ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-500">
                    🍽️ {ed.food}
                  </span>
                ) : (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${catInfo?.bgColor} ${catInfo?.textColor}`}>
                    {catInfo?.icon} {catInfo?.name}
                  </span>
                )}
                {isQuest && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300'
                  }`}>🎯 {ed.quest}</span>
                )}
                {!isQuest && !isMeal && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    theme === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300'
                  }`}>📝 {ed.noteLabel}</span>
                )}
              </div>
              {entry.timestamp && (
                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {new Date(entry.timestamp).toLocaleString(getLocale(), {
                    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}
            aria-label="Закрыть"
            className={`h-11 w-11 rounded-full flex-shrink-0 ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {/* AI summary / name */}
          <div className={`mb-4 p-4 rounded-xl ${
            theme === 'light' ? 'bg-gray-50' : 'bg-white/5'
          }`}>
            <p className={`text-xs font-medium mb-1.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              {isMeal ? ed.meal : isQuest ? ed.completedQuest : ed.noteLabel}
            </p>
            <p className={`text-base font-medium leading-relaxed ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              {entry.text}
            </p>
          </div>

          {/* Meal nutrients */}
          {isMeal && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl p-3 bg-orange-500/10">
                <div className={`text-xs mb-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>🔥 {c.caloriesLabel}</div>
                <div className="text-lg font-bold text-orange-500">{Math.round(entry.calories)} <span className="text-xs font-normal">{c.kcal}</span></div>
              </div>
              <div className="rounded-xl p-3 bg-red-500/10">
                <div className={`text-xs mb-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>🥩 {c.protein}</div>
                <div className="text-lg font-bold text-red-500">{Math.round(entry.protein)} <span className="text-xs font-normal">g</span></div>
              </div>
              <div className="rounded-xl p-3 bg-yellow-500/10">
                <div className={`text-xs mb-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>💧 {c.fat}</div>
                <div className="text-lg font-bold text-yellow-500">{Math.round(entry.fat)} <span className="text-xs font-normal">g</span></div>
              </div>
              <div className="rounded-xl p-3 bg-green-500/10">
                <div className={`text-xs mb-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>🌾 {c.carbs}</div>
                <div className="text-lg font-bold text-green-500">{Math.round(entry.carbs)} <span className="text-xs font-normal">g</span></div>
              </div>
            </div>
          )}

          {/* Edit meal button */}
          {isMeal && onEditMeal && (
            <Button
              onClick={() => onEditMeal(entry)}
              aria-label="Редактировать приём пищи"
              className="w-full min-h-[44px] mb-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
            >
              <Pencil className="w-4 h-4 mr-2" />
              {i.common.edit}
            </Button>
          )}

          {/* Raw voice input */}
          {entry.rawText && (
            <div className={`p-4 rounded-xl border ${
              theme === 'light' ? 'bg-purple-50/50 border-purple-200' : 'bg-purple-500/5 border-purple-500/20'
            }`}>
              <p className={`text-xs font-medium mb-1.5 flex items-center gap-1.5 ${
                theme === 'light' ? 'text-purple-600' : 'text-purple-400'
              }`}>
                🎙️ {i.voice.voiceInput}
              </p>
              <p className={`text-sm leading-relaxed ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                {entry.rawText}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}