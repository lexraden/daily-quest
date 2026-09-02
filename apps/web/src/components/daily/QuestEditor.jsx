import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function QuestEditor({ questData, categories, onSave, onClose, theme = 'dark' }) {
  const [editedQuests, setEditedQuests] = useState(JSON.parse(JSON.stringify(questData)));

  const handleQuestChange = (category, level, field, value) => {
    setEditedQuests(prev => ({
      ...prev,
      [category]: prev[category].map(q => 
        q.level === level ? { ...q, [field]: value } : q
      )
    }));
  };

  const handleSave = () => {
    onSave(editedQuests);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border ${
        theme === 'light' 
          ? 'bg-white border-gray-200' 
          : 'bg-[#1e2836] border-white/10'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${
          theme === 'light' ? 'border-gray-200' : 'border-white/10'
        }`}>
          <h2 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>Редактор квестов</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            aria-label="Закрыть редактор"
            className="h-11 w-11 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {Object.entries(categories).map(([categoryKey, categoryInfo]) => {
            const Icon = categoryInfo.icon;
            return (
              <div key={categoryKey} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${categoryInfo.bgColor}`}>
                    <Icon className={`w-5 h-5 ${categoryInfo.textColor}`} />
                  </div>
                  <h3 className={`font-semibold ${categoryInfo.textColor}`}>
                    {categoryInfo.name}
                  </h3>
                </div>

                {/* Quest Levels */}
                <div className="space-y-2 ml-2">
                  {editedQuests[categoryKey]?.map((quest) => (
                    <div
                      key={quest.level}
                      className={`rounded-xl p-3 border ${
                        theme === 'light' 
                          ? 'bg-gray-50 border-gray-200' 
                          : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-500'}`}>
                          Lvl {quest.level}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={quest.emoji}
                          onChange={(e) => handleQuestChange(categoryKey, quest.level, 'emoji', e.target.value)}
                          className={`w-16 text-center ${
                            theme === 'light' 
                              ? 'bg-gray-100 border-gray-300 text-gray-900' 
                              : 'bg-white/5 border-white/10 text-white'
                          }`}
                          placeholder="🏃"
                          maxLength={2}
                        />
                        <Input
                          value={quest.name}
                          onChange={(e) => handleQuestChange(categoryKey, quest.level, 'name', e.target.value)}
                          className={`flex-1 ${
                            theme === 'light' 
                              ? 'bg-gray-100 border-gray-300 text-gray-900' 
                              : 'bg-white/5 border-white/10 text-white'
                          }`}
                          placeholder="Название квеста"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={`p-5 border-t flex gap-3 ${
          theme === 'light' ? 'border-gray-200' : 'border-white/10'
        }`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
        >
          <Button
            onClick={onClose}
            variant="outline"
            aria-label="Отменить редактирование"
            className={`flex-1 min-h-[44px] ${
              theme === 'light' 
                ? 'border-gray-300 hover:bg-gray-100' 
                : 'border-white/10 hover:bg-white/5'
            }`}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            aria-label="Сохранить квесты"
            className="flex-1 min-h-[44px] bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}