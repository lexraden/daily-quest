import React, { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function QuestSuggestionModal({ suggestion, categories, onAccept, onReject, theme = 'dark' }) {
  const [editedSuggestion, setEditedSuggestion] = useState(suggestion);
  
  if (!suggestion) return null;

  const categoryInfo = categories[suggestion.category];
  const Icon = categoryInfo?.icon;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onReject}
    >
      <div 
        className={`rounded-2xl max-w-md w-full border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${
          theme === 'light' ? 'border-gray-200' : 'border-white/10'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              AI предложение
            </h2>
          </div>
          <Button
            onClick={onReject}
            variant="ghost"
            size="icon"
            aria-label="Закрыть"
            className="h-11 w-11 rounded-full hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Message */}
          <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
            {suggestion.message}
          </p>

          {/* Category */}
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${categoryInfo?.bgColor}`}>
              <Icon className={`w-5 h-5 ${categoryInfo?.textColor}`} />
            </div>
            <span className={`font-medium ${categoryInfo?.textColor}`}>
              {categoryInfo?.name}
            </span>
          </div>

          {/* Quest Details */}
          <div className="space-y-3">
            <div>
              <label className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} mb-1 block`}>
                Эмодзи
              </label>
              <Input
                value={editedSuggestion.emoji}
                onChange={(e) => setEditedSuggestion({...editedSuggestion, emoji: e.target.value})}
                className={`w-20 text-center text-2xl ${
                  theme === 'light' 
                    ? 'bg-gray-100 border-gray-300 text-gray-900' 
                    : 'bg-white/5 border-white/10 text-white'
                }`}
                maxLength={2}
              />
            </div>

            <div>
              <label className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} mb-1 block`}>
                Название квеста
              </label>
              <Input
                value={editedSuggestion.name}
                onChange={(e) => setEditedSuggestion({...editedSuggestion, name: e.target.value})}
                className={theme === 'light' 
                  ? 'bg-gray-100 border-gray-300 text-gray-900' 
                  : 'bg-white/5 border-white/10 text-white'
                }
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-5 border-t flex gap-3 ${
          theme === 'light' ? 'border-gray-200' : 'border-white/10'
        }`}>
          <Button
            onClick={onReject}
            variant="outline"
            className={`flex-1 ${
              theme === 'light' 
                ? 'border-gray-300 hover:bg-gray-100' 
                : 'border-white/10 hover:bg-white/5'
            }`}
          >
            Отмена
          </Button>
          <Button
            onClick={() => onAccept(editedSuggestion)}
            className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        </div>
      </div>
    </div>
  );
}