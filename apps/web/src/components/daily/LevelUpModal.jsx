import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { levelDef, levelName, avatarSrc, MAX_LEVEL } from '@/lib/levels';

/**
 * Congratulations on reaching a new overall level, and the avatar it unlocks.
 *
 * Unlike CategoryLevelUpModal this fires on every level rather than on
 * milestones: category levels come every ten completions and would be noise,
 * while there are only ten overall levels in the life of an account.
 *
 * Whether to show it is the server's call — see `celebrate_level` in the
 * quest-data payload — so this component only draws and reports back.
 */
export default function LevelUpModal({ level, onClose, theme = 'dark' }) {
  const i = t();
  const copy = i.levelUp || {};
  const def = levelDef(level);
  const art = avatarSrc(level);
  const light = theme === 'light';

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-sm rounded-3xl p-7 text-center border ${
            light ? 'bg-white shadow-2xl' : 'bg-[#1b2433]'
          }`}
          style={{ borderColor: `${def.color}66` }}
        >
          <button
            onClick={onClose}
            aria-label={i.common?.close || 'Close'}
            className={`absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center ${
              light ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className={`text-[11px] font-bold tracking-[0.2em] ${
              light ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {(copy.kicker || 'LEVEL UP').toUpperCase()}
          </div>

          <motion.div
            initial={{ scale: 0, rotate: -140 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', damping: 11, stiffness: 190 }}
            className="relative mx-auto mt-5 flex h-[136px] w-[136px] items-center justify-center rounded-full"
            style={{
              border: `3px solid ${def.color}`,
              boxShadow: `0 0 42px ${def.color}73`,
              background: light ? `${def.color}1a` : `radial-gradient(circle at 50% 35%, ${def.color}33, #1b2433 70%)`,
            }}
          >
            {art ? (
              <img
                src={art}
                alt=""
                className="h-full w-full rounded-full object-cover"
                onError={(e) => {
                  // The artwork is optional; fall back to the emoji rather than
                  // leaving a broken image in the middle of a celebration.
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="text-7xl leading-none">{def.icon}</span>
            )}
            <span
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-0.5 text-sm font-extrabold text-white"
              style={{ background: def.color }}
            >
              {def.level}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2
              className={`mt-7 text-2xl font-extrabold ${light ? 'text-gray-900' : 'text-white'}`}
            >
              {levelName(level)}
            </h2>
            <p className={`mt-1.5 text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>
              {(copy.reached || 'Level {level} reached.').replace('{level}', level)}
              {level < MAX_LEVEL ? ` ${copy.unlocked || 'A new look is yours.'}` : ''}
            </p>

            <Button
              onClick={onClose}
              className="mt-6 h-13 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-blue-500 py-4 text-base font-bold text-white hover:opacity-90"
            >
              {copy.cta || 'Nice'}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
