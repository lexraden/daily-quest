import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", bgColor: "bg-green-500/10", textColor: "text-green-400" },
  mind: { name: "Mind", icon: "🧠", bgColor: "bg-purple-500/10", textColor: "text-purple-400" },
  money: { name: "Money", icon: "💰", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400" },
  work: { name: "Work", icon: "💼", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" },
  love: { name: "Love", icon: "❤️", bgColor: "bg-red-500/10", textColor: "text-red-400" },
  friends: { name: "Friends", icon: "👥", bgColor: "bg-pink-500/10", textColor: "text-pink-400" }
};

export default function EntryDetailModal({ entry, onClose, theme }) {
  if (!entry) return null;

  const catInfo = CATEGORIES[entry.category];
  const isQuest = entry.type === 'quest_completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-2xl overflow-hidden max-h-[85vh] flex flex-col ${
          theme === 'light' ? 'bg-white shadow-xl' : 'bg-[#1e2836]'
        }`}
      >

        {/* Header */}
        <div className={`px-5 pt-4 pb-3 flex items-start justify-between border-b ${
          theme === 'light' ? 'border-gray-100' : 'border-white/5'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{entry.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${catInfo?.bgColor} ${catInfo?.textColor}`}>
                  {catInfo?.icon} {catInfo?.name}
                </span>
                {isQuest && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300'
                  }`}>🎯 Квест</span>
                )}
                {!isQuest && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    theme === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300'
                  }`}>📝 Заметка</span>
                )}
              </div>
              {entry.timestamp && (
                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {new Date(entry.timestamp).toLocaleString('ru-RU', {
                    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}
            className={`h-8 w-8 rounded-full flex-shrink-0 ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
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
              {isQuest ? 'Выполненный квест' : 'Заметка'}
            </p>
            <p className={`text-base font-medium leading-relaxed ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              {entry.text}
            </p>
          </div>

          {/* Raw voice input */}
          {entry.rawText && (
            <div className={`p-4 rounded-xl border ${
              theme === 'light' ? 'bg-purple-50/50 border-purple-200' : 'bg-purple-500/5 border-purple-500/20'
            }`}>
              <p className={`text-xs font-medium mb-1.5 flex items-center gap-1.5 ${
                theme === 'light' ? 'text-purple-600' : 'text-purple-400'
              }`}>
                🎙️ Голосовой ввод
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