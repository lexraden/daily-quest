import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

const CATEGORY_INFO = {
  health: { name: 'Health', icon: '💪', color: '#00b894' },
  mind: { name: 'Mind', icon: '🧠', color: '#a29bfe' },
  money: { name: 'Money', icon: '💰', color: '#00cec9' },
  work: { name: 'Work', icon: '💼', color: '#fdcb6e' },
  love: { name: 'Love', icon: '❤️', color: '#ff7675' },
  friends: { name: 'Friends', icon: '👥', color: '#fd79a8' }
};

// Trigger only on milestone levels
export function isCategoryLevelMilestone(level) {
  return level === 5 || level === 10 || level === 15 || level === 20 || level === 25 || level === 30;
}

export default function CategoryLevelUpModal({ category, level, onClose, theme = 'dark' }) {
  const i = t();
  const lc = i.levelCeleb;
  const info = CATEGORY_INFO[category];
  if (!info) return null;

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
          className={`relative w-full max-w-sm rounded-3xl p-8 text-center border ${
            theme === 'light' ? 'bg-white shadow-2xl' : 'bg-[#1e2836]'
          }`}
          style={{ borderColor: info.color + '40' }}
        >
          <button onClick={onClose} aria-label="Close" className={`absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
            <X className="w-5 h-5" />
          </button>

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', damping: 10, stiffness: 200 }}
            className="text-7xl mb-4"
          >
            {info.icon}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="w-5 h-5" style={{ color: info.color }} />
              <h2 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {lc.title}
              </h2>
            </div>
            <p className={`text-sm mb-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
              {lc.message}
            </p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <div
                className="text-5xl font-black"
                style={{ color: info.color }}
              >
                {level}
              </div>
              <div className="text-left">
                <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>{lc.inCategory}</div>
                <div className={`text-base font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{info.name}</div>
              </div>
            </div>
          </motion.div>

          <Button
            onClick={onClose}
            aria-label={i.common.close}
            className="w-full min-h-[44px] h-12 text-base text-white"
            style={{ background: `linear-gradient(to right, ${info.color}, ${info.color}cc)` }}
          >
            {lc.keepGoing}
          </Button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}