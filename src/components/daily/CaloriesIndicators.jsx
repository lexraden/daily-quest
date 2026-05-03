import React, { useState, useMemo, useEffect } from 'react';
import { Flame, Zap, Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/i18n';

/**
 * Two compact indicators for the header:
 * - IN: sum of today's meal calories (auto from mealHistory)
 * - OUT: burned calories — tap to enter manually (from watch/tracker)
 */
export default function CaloriesIndicators({ mealHistory, caloriesOut, onCaloriesOutChange, theme = 'light' }) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const i = t();
  const c = i.calories;

  const caloriesIn = useMemo(() => {
    return (mealHistory || [])
      .filter(m => m.date === today)
      .reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
  }, [mealHistory, today]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (editing) {
      setDraft(caloriesOut > 0 ? String(caloriesOut) : '');
    }
  }, [editing, caloriesOut]);

  const handleSave = () => {
    const n = parseInt(draft, 10);
    onCaloriesOutChange(isNaN(n) || n < 0 ? 0 : n);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft('');
  };

  const cardLight = 'bg-white border border-gray-200';
  const cardDark = 'bg-[#1e2836] border border-white/10';
  const cardClass = theme === 'light' ? cardLight : cardDark;
  const labelClass = theme === 'light' ? 'text-gray-500' : 'text-gray-400';
  const valueClass = theme === 'light' ? 'text-gray-900' : 'text-white';

  return (
    <div className="flex gap-2 mb-4">
      {/* Calories IN */}
      <div className={`flex-1 rounded-2xl px-3 py-2.5 ${cardClass}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          <span className={`text-xs font-medium ${labelClass}`}>IN</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-bold ${valueClass}`}>{Math.round(caloriesIn)}</span>
          <span className={`text-xs ${labelClass}`}>{c.kcal}</span>
        </div>
      </div>

      {/* Calories OUT */}
      <button
        type="button"
        onClick={() => !editing && setEditing(true)}
        aria-label="Edit calories out"
        className={`flex-1 rounded-2xl px-3 py-2.5 text-left transition-all ${cardClass} ${
          !editing ? 'active:scale-[0.98] hover:opacity-90' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-500" />
            <span className={`text-xs font-medium ${labelClass}`}>OUT</span>
          </div>
          {!editing && (
            <Pencil className={`w-3 h-3 ${theme === 'light' ? 'text-gray-300' : 'text-gray-500'}`} />
          )}
        </div>
        {editing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Input
              type="number"
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              placeholder="0"
              className={`h-7 px-2 text-base font-bold ${
                theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-white/5 border-white/10 text-white'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            <button
              type="button"
              onClick={handleSave}
              className="p-1 rounded-md hover:bg-green-500/20"
              aria-label="Save"
            >
              <Check className="w-4 h-4 text-green-500" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded-md hover:bg-red-500/20"
              aria-label="Cancel"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-bold ${valueClass}`}>{Math.round(caloriesOut || 0)}</span>
            <span className={`text-xs ${labelClass}`}>{c.kcal}</span>
          </div>
        )}
      </button>
    </div>
  );
}