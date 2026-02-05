import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const MOTIVATIONAL_PHRASES = [
  { text: "Ты на правильном пути!", emoji: "🚀" },
  { text: "Каждый день — новая возможность!", emoji: "🌟" },
  { text: "Продолжай в том же духе!", emoji: "💪" },
  { text: "Ты делаешь невероятные вещи!", emoji: "⭐" },
  { text: "Верь в себя, всё получится!", emoji: "🔥" },
  { text: "Маленькие шаги — большие результаты!", emoji: "👣" },
  { text: "Ты сильнее, чем думаешь!", emoji: "💎" },
  { text: "Сегодня твой день!", emoji: "☀️" },
  { text: "Ты можешь больше!", emoji: "🎯" },
  { text: "Двигайся вперёд, не останавливайся!", emoji: "🏃" },
  { text: "Ты вдохновляешь!", emoji: "✨" },
  { text: "Прогресс есть, продолжай!", emoji: "📈" }
];

export default function MotivationalBanner({ userName, completedCount, theme = 'dark' }) {
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show banner randomly (30% chance)
    if (Math.random() < 0.3) {
      const randomPhrase = MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];
      setCurrentPhrase(randomPhrase);
      setShow(true);

      // Hide after 5 seconds
      const timer = setTimeout(() => {
        setShow(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [completedCount]); // Show on completed count change

  if (!currentPhrase) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="px-5 mb-4"
        >
          <div className={`rounded-2xl p-4 border ${
            theme === 'light'
              ? 'bg-gradient-to-r from-purple-50 to-cyan-50 border-purple-200'
              : 'bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border-purple-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentPhrase.emoji}</span>
              <div className="flex-1">
                <p className={`font-medium ${
                  theme === 'light' ? 'text-purple-900' : 'text-purple-200'
                }`}>
                  {userName ? `${userName}, ${currentPhrase.text.toLowerCase()}` : currentPhrase.text}
                </p>
              </div>
              <Sparkles className={`w-5 h-5 ${
                theme === 'light' ? 'text-purple-500' : 'text-purple-400'
              }`} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}