import React, { useState } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function QuestEditor({ questData, categories, onSave, onClose }) {
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e2836] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Редактор квестов</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full hover:bg-white/10"
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
                      className="bg-white/5 rounded-xl p-3 border border-white/5"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500 font-medium">
                          Lvl {quest.level}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={quest.emoji}
                          onChange={(e) => handleQuestChange(categoryKey, quest.level, 'emoji', e.target.value)}
                          className="w-16 text-center bg-white/5 border-white/10"
                          placeholder="🏃"
                          maxLength={2}
                        />
                        <Input
                          value={quest.name}
                          onChange={(e) => handleQuestChange(categoryKey, quest.level, 'name', e.target.value)}
                          className="flex-1 bg-white/5 border-white/10"
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
        <div className="p-5 border-t border-white/10 flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-white/10 hover:bg-white/5"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}