import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Pencil } from 'lucide-react';
import { t } from '@/lib/i18n';

// Five levels, matching the labels in i18n. Score is 1-5 so it averages
// meaningfully and plots on a fixed axis.
export const MOOD_LEVELS = [
  { score: 1, emoji: '😞' },
  { score: 2, emoji: '😕' },
  { score: 3, emoji: '😐' },
  { score: 4, emoji: '🙂' },
  { score: 5, emoji: '😄' },
];

/**
 * One check-in per day, editable. Stored on quest_data.mood_log keyed by the
 * local date, the same shape completion_history and calories_burned use.
 */
export default function MoodCheckIn({ todayKey, moodLog, onSave, theme = 'dark' }) {
  const i = t();
  const m = i.mood;
  const today = moodLog?.[todayKey];
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(today?.note || '');

  const light = theme === 'light';
  const answered = Boolean(today) && !editing;

  const choose = (score) => {
    onSave(todayKey, { score, note: note.trim() || undefined, at: new Date().toISOString() });
    setEditing(false);
  };

  return (
    <div
      className={`rounded-2xl p-4 ${
        light ? 'bg-white border border-gray-200' : 'bg-white/5 border border-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${light ? 'text-gray-900' : 'text-white'}`}>
          {answered ? `${m.today}: ${m.scale[today.score - 1]}` : m.title}
        </h3>
        {answered && (
          <button
            onClick={() => { setEditing(true); setNote(today.note || ''); }}
            className={`flex items-center gap-1 text-xs ${
              light ? 'text-gray-500 hover:text-gray-800' : 'text-gray-400 hover:text-white'
            }`}
            aria-label={m.edit}
          >
            <Pencil className="w-3 h-3" aria-hidden="true" />
            {m.edit}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {answered ? (
          <motion.div
            key="answered"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            <span className="text-3xl" aria-hidden="true">
              {MOOD_LEVELS[today.score - 1]?.emoji}
            </span>
            <div className="min-w-0">
              <div className={`flex items-center gap-1 text-xs ${light ? 'text-green-600' : 'text-green-400'}`}>
                <Check className="w-3 h-3" aria-hidden="true" />
                {m.saved}
              </div>
              {today.note && (
                <p className={`text-sm truncate ${light ? 'text-gray-600' : 'text-gray-300'}`}>
                  {today.note}
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="asking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="flex justify-between gap-1">
              {MOOD_LEVELS.map((level, idx) => (
                <button
                  key={level.score}
                  onClick={() => choose(level.score)}
                  aria-label={m.scale[idx]}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all active:scale-95 ${
                    today?.score === level.score
                      ? light ? 'bg-purple-100' : 'bg-purple-500/25'
                      : light ? 'hover:bg-gray-100' : 'hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">{level.emoji}</span>
                  <span className={`text-[10px] leading-tight text-center ${light ? 'text-gray-500' : 'text-gray-400'}`}>
                    {m.scale[idx]}
                  </span>
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={m.note}
              maxLength={200}
              className={`w-full text-sm rounded-lg px-3 py-2 outline-none ${
                light
                  ? 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400'
                  : 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
