import React, { useState, useMemo, useEffect, useRef } from 'react';

/**
 * Two compact inline chips matching the player-status row size:
 * - IN: sum of today's meal calories (auto from mealHistory)
 * - OUT: burned calories — tap to enter manually (from watch/tracker)
 */
export default function CaloriesIndicators({ mealHistory, caloriesOut, onCaloriesOutChange, theme = 'light' }) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const caloriesIn = useMemo(() => {
    return (mealHistory || [])
      .filter(m => m.date === today)
      .reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
  }, [mealHistory, today]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(caloriesOut > 0 ? String(caloriesOut) : '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, caloriesOut]);

  const commit = () => {
    const n = parseInt(draft, 10);
    onCaloriesOutChange(isNaN(n) || n < 0 ? 0 : n);
    setEditing(false);
  };

  const valueClass = theme === 'light' ? 'text-gray-900' : 'text-white';

  return (
    <>
      <div className={`w-px h-4 ${theme === 'light' ? 'bg-black/10' : 'bg-white/10'}`} />
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-green-500">IN</span>
        <span className={`font-semibold text-sm ${valueClass}`}>{Math.round(caloriesIn)} <span className={`text-xs font-normal ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>ккал</span></span>
      </div>

      <div className={`w-px h-4 ${theme === 'light' ? 'bg-black/10' : 'bg-white/10'}`} />
      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-orange-500">OUT</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder="0"
            className={`w-14 h-5 px-1 text-sm font-semibold rounded outline-none border ${
              theme === 'light'
                ? 'bg-white border-gray-300 text-gray-900'
                : 'bg-white/10 border-white/20 text-white'
            }`}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit calories out"
          className="flex items-center gap-2 flex-1 pr-8 -mr-4 active:scale-95 transition-transform"
        >
          <span className="text-xs font-semibold text-orange-500">OUT</span>
          <span className={`font-semibold text-sm ${valueClass}`}>{Math.round(caloriesOut || 0)} <span className={`text-xs font-normal ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>ккал</span></span>
        </button>
      )}
    </>
  );
}