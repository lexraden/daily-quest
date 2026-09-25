import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

export function getStreakMilestone(streak) {
  const i = t();
  return i.streakCeleb[streak] || null;
}

export default function StreakCelebrationModal({ streak, onClose, theme = 'dark' }) {
  const i = t();
  const isMagic = Boolean(streak === 7 && i.magicNumber?.[7]);

  /**
   * Day seven keeps the ordinary milestone and has its words replaced, not the
   * whole entry: the magic copy carries a title and a message and no emoji, so
   * swapping the object outright left the largest element on the card empty.
   */
  const milestone = isMagic
    ? { ...i.streakCeleb[streak], ...i.magicNumber[7] }
    : i.streakCeleb[streak];
  if (!milestone) return null;

  /**
   * Written out rather than built as `text-${size}`. Tailwind generates only
   * the class names it can find literally in the source, so an interpolated
   * one exists only if some other file happens to spell it — text-9xl and
   * text-4xl appear nowhere else, and the magic card rendered at the default
   * size while looking correct in the code.
   */
  const size = isMagic
    ? { card: 'max-w-2xl', emoji: 'text-9xl', title: 'text-4xl', count: 'text-5xl', body: 'text-lg' }
    : { card: 'max-w-sm', emoji: 'text-7xl', title: 'text-2xl', count: 'text-3xl', body: 'text-sm' };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full ${size.card} rounded-3xl p-8 text-center border ${
            theme === 'light'
              ? 'bg-white border-orange-200 shadow-2xl'
              : 'bg-[#1e2836] border-orange-500/30'
          }`}
        >
          <button onClick={onClose} aria-label="Закрыть" className={`absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
            <X className="w-5 h-5" />
          </button>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 10, stiffness: 200 }}
            className={`${size.emoji} mb-4`}
          >
            {milestone.emoji}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className={`${size.title} font-bold mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              {milestone.title}
            </h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Flame className="w-6 h-6 text-orange-500" />
              <span className={`${size.count} font-black ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>
                {streak}
              </span>
              <Flame className="w-6 h-6 text-orange-500" />
            </div>
            <p className={`${size.body} mb-6 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
              {milestone.message}
            </p>
          </motion.div>

          <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}>
            <Button
              onClick={onClose}
              aria-label={i.common.close}
              className="w-full min-h-[44px] h-12 text-base bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              {i.streakContinue}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
