import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Flame, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StreakFreezeModal({ streak, freezesLeft, onUseFreeze, onLoseStreak, theme = 'dark' }) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
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
          className={`relative w-full max-w-sm rounded-3xl p-8 text-center border ${
            theme === 'light'
              ? 'bg-white border-cyan-200 shadow-2xl'
              : 'bg-[#1e2836] border-cyan-500/30'
          }`}
        >
          <div className="text-5xl mb-4">❄️</div>

          <h2 className={`text-xl font-bold mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            Ты пропустил вчерашний день!
          </h2>

          <div className="flex items-center justify-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className={`text-2xl font-black ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>
              {streak}
            </span>
            <span className={`text-sm ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
              дней серия
            </span>
          </div>

          <p className={`text-sm mb-6 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            У тебя есть <span className="font-bold text-cyan-500">{freezesLeft}</span> заморозк{freezesLeft === 1 ? 'а' : 'и'} серии. 
            Использовать одну, чтобы сохранить свой стрик?
          </p>

          <div className="space-y-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}>
            <Button
              onClick={onUseFreeze}
              className="w-full h-12 text-base bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              <Shield className="w-5 h-5 mr-2" />
              Использовать заморозку
            </Button>
            <Button
              onClick={onLoseStreak}
              variant="outline"
              className={`w-full h-12 text-base ${
                theme === 'light'
                  ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  : 'border-white/10 text-gray-400 hover:bg-white/5'
              }`}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Сбросить серию
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}