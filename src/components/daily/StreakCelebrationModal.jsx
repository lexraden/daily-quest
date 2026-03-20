import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STREAK_MILESTONES = {
  3: { emoji: '🔥', title: '3 дня подряд!', message: 'Отличное начало! Привычка начинает формироваться.' },
  5: { emoji: '⚡', title: '5 дней подряд!', message: 'Ты набираешь обороты! Так держать!' },
  7: { emoji: '🌟', title: 'Неделя подряд!', message: 'Целая неделя! Ты уже на пути к настоящей привычке.' },
  10: { emoji: '💪', title: '10 дней подряд!', message: 'Молодец! Ты уже 10 дней повышаешь свой уровень!' },
  14: { emoji: '🏅', title: '2 недели подряд!', message: 'Невероятная дисциплина! Ты — настоящий воин.' },
  21: { emoji: '🧠', title: '21 день подряд!', message: 'Привычка сформирована! Ты — машина!' },
  30: { emoji: '🏆', title: 'Месяц подряд!', message: 'Целый месяц без пропусков! Это легендарно!' },
  50: { emoji: '👑', title: '50 дней подряд!', message: 'Полсотни дней! Ты в элите!' },
  100: { emoji: '✨', title: '100 дней подряд!', message: 'СТО ДНЕЙ! Ты — абсолютная легенда!' },
};

export function getStreakMilestone(streak) {
  return STREAK_MILESTONES[streak] || null;
}

export default function StreakCelebrationModal({ streak, onClose, theme = 'dark' }) {
  const milestone = STREAK_MILESTONES[streak];
  if (!milestone) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-5" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-sm rounded-3xl p-8 text-center border ${
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
              className="w-full h-12 text-base bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              🔥 Продолжаем!
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}