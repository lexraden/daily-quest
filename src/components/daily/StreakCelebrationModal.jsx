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
  const milestone = i.streakCeleb[streak];
  if (!milestone) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-5" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-8 text-center border ${
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
            className="text-7xl mb-4"
          >
            {milestone.emoji}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className={`text-2xl font-bold mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              {milestone.title}
            </h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Flame className="w-6 h-6 text-orange-500" />
              <span className={`text-3xl font-black ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>
                {streak}
              </span>
              <Flame className="w-6 h-6 text-orange-500" />
            </div>
            <p className={`text-sm mb-6 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
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