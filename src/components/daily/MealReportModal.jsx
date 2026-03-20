import React from 'react';
import { X, Flame, Beef, Droplets, Wheat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function MealReportModal({ meal, onSave, onDiscard, theme = 'dark' }) {
  if (!meal) return null;

  const nutrients = [
    { label: 'Калории', value: meal.calories, unit: 'ккал', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Белки', value: meal.protein, unit: 'г', icon: Beef, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Жиры', value: meal.fat, unit: 'г', icon: Droplets, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Углеводы', value: meal.carbs, unit: 'г', icon: Wheat, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
        onClick={onDiscard}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className={`w-full max-w-sm rounded-2xl overflow-hidden ${
            theme === 'light' ? 'bg-white shadow-xl' : 'bg-[#1e2836]'
          }`}
        >
          {/* Photo */}
          {meal.photo_urls?.[0] && (
            <div className="w-full h-48 overflow-hidden">
              <img src={meal.photo_urls[0]} alt={meal.meal_name} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-5 space-y-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>
            {/* Meal name */}
            <div>
              <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                🍽️ {meal.meal_name}
              </h3>
              {meal.description && (
                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                  {meal.description}
                </p>
              )}
            </div>

            {/* Nutrients grid */}
            <div className="grid grid-cols-2 gap-2">
              {nutrients.map(n => (
                <div
                  key={n.label}
                  className={`rounded-xl p-3 ${n.bg}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <n.icon className={`w-3.5 h-3.5 ${n.color}`} />
                    <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>{n.label}</span>
                  </div>
                  <div className={`text-lg font-bold ${n.color}`}>
                    {Math.round(n.value)} <span className="text-xs font-normal">{n.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={onDiscard}
                variant="outline"
                className={`flex-1 ${theme === 'light' ? 'border-gray-200' : 'border-white/10'}`}
              >
                Отмена
              </Button>
              <Button
                onClick={onSave}
                className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}