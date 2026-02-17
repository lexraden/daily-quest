import React from 'react';
import { X, User, Sparkles, CheckCircle2, Plus, BookOpen, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AIResponseModal({ userInput, aiResponse, onClose, onAccept, onReject, theme = 'dark' }) {
  if (!aiResponse) return null;

  const getIntentIcon = () => {
    switch (aiResponse.intent) {
      case 'COMPLETED_QUEST':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'ADD_QUEST':
        return <Plus className="w-5 h-5 text-purple-400" />;
      case 'DELETE_QUEST':
        return <Trash2 className="w-5 h-5 text-red-400" />;
      case 'EDIT_QUEST':
        return <Pencil className="w-5 h-5 text-amber-400" />;
      case 'JOURNAL':
        return <BookOpen className="w-5 h-5 text-cyan-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-purple-400" />;
    }
  };

  const getIntentLabel = () => {
    switch (aiResponse.intent) {
      case 'COMPLETED_QUEST':
        return 'Квест выполнен';
      case 'ADD_QUEST':
        return 'Новый квест';
      case 'DELETE_QUEST':
        return 'Удалить квест';
      case 'EDIT_QUEST':
        return 'Изменить квест';
      case 'JOURNAL':
        return 'Заметка';
      default:
        return 'AI ответ';
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4 ${
        theme === 'light' ? 'bg-black/60' : 'bg-black/80'
      }`}
      onClick={onClose}
    >
      <div 
        className={`rounded-3xl max-w-md w-full border overflow-hidden ${
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
            <Sparkles className={`w-5 h-5 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
            <h2 className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              AI Ассистент
            </h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className={`h-9 w-9 rounded-full ${
              theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* User Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className={`w-4 h-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`} />
              <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Вы сказали:
              </span>
            </div>
            <div className={`p-4 rounded-xl ${
              theme === 'light' 
                ? 'bg-gradient-to-br from-gray-50 to-purple-50/30 border border-gray-200' 
                : 'bg-gradient-to-br from-white/5 to-purple-500/5 border border-white/10'
            }`}>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-800' : 'text-gray-200'}`}>
                {userInput || 'Обрабатываю ваше сообщение...'}
              </p>
            </div>
          </div>

          {/* AI Response */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
              <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                AI понял:
              </span>
            </div>
            <div className={`p-4 rounded-xl border ${
              theme === 'light' 
                ? 'bg-gradient-to-br from-purple-50 to-cyan-50 border-purple-200' 
                : 'bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30'
            }`}>
              {/* Intent Badge */}
              <div className="flex items-center gap-2 mb-3">
                {getIntentIcon()}
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  theme === 'light' 
                    ? 'bg-white/80 text-purple-700' 
                    : 'bg-white/10 text-purple-300'
                }`}>
                  {getIntentLabel()}
                </span>
              </div>

              {/* Quest/Note Details */}
              <div className="space-y-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{aiResponse.emoji}</span>
                  <span className={`font-bold text-lg ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    {aiResponse.name}
                  </span>
                </div>
                {aiResponse.description && (
                  <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    {aiResponse.description}
                  </p>
                )}
                
                {/* Category and XP Info */}
                <div className="flex items-center gap-3 pt-2">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    aiResponse.category === 'health' ? 'bg-green-500/20 text-green-400' :
                    aiResponse.category === 'mind' ? 'bg-purple-500/20 text-purple-400' :
                    aiResponse.category === 'work' ? 'bg-yellow-500/20 text-yellow-400' :
                    aiResponse.category === 'money' ? 'bg-cyan-500/20 text-cyan-400' :
                    aiResponse.category === 'love' ? 'bg-red-500/20 text-red-400' :
                    'bg-pink-500/20 text-pink-400'
                  }`}>
                    {aiResponse.category === 'health' ? '💪 Health' :
                     aiResponse.category === 'mind' ? '🧠 Mind' :
                     aiResponse.category === 'work' ? '💼 Work' :
                     aiResponse.category === 'money' ? '💰 Money' :
                     aiResponse.category === 'love' ? '❤️ Love' :
                     '👥 Friends'}
                  </div>
                  {aiResponse.intent === 'COMPLETED_QUEST' && (
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      theme === 'light' 
                        ? 'bg-gradient-to-r from-purple-100 to-cyan-100 text-purple-700' 
                        : 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-300'
                    }`}>
                      +1 XP
                    </div>
                  )}
                </div>
              </div>

              {/* AI Message */}
              <p className={`text-sm italic ${theme === 'light' ? 'text-purple-700' : 'text-purple-300'}`}>
                "{aiResponse.message}"
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-5 border-t space-y-2 ${
          theme === 'light' ? 'border-gray-200' : 'border-white/10'
        }`}>
          {aiResponse.intent === 'DELETE_QUEST' ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={onReject}
                variant="outline"
                className={
                  theme === 'light'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                }
              >
                Отмена
              </Button>
              <Button
                onClick={onAccept}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </Button>
            </div>
          ) : aiResponse.intent === 'EDIT_QUEST' ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={onReject}
                variant="outline"
                className={
                  theme === 'light'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                }
              >
                Отмена
              </Button>
              <Button
                onClick={onAccept}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Изменить
              </Button>
            </div>
          ) : aiResponse.intent === 'ADD_QUEST' ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={onReject}
                variant="outline"
                className={
                  theme === 'light'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                }
              >
                Отмена
              </Button>
              <Button
                onClick={onAccept}
                className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
              >
                Добавить квест
              </Button>
            </div>
          ) : (
            <Button
              onClick={onAccept}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
            >
              Отлично!
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}