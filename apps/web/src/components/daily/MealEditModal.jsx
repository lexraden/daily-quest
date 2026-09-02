import React, { useState } from 'react';
import { X, Trash2, Save, Loader2, Flame, Beef, Droplets, Wheat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { t, getLang } from '@/lib/i18n';

export default function MealEditModal({ meal, mealIndex, onSave, onDelete, onClose, theme = 'dark' }) {
  const i = t();
  const me = i.mealEdit;
  const c = i.calories;
  const [name, setName] = useState(meal.meal_name || '');
  const [correction, setCorrection] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleRecalculate = async () => {
    if (!correction.trim()) {
      toast.error(me.writeChange);
      return;
    }
    setIsRecalculating(true);
    try {
      // Prompt and schema now live on the server.
      const result = await api.ai.correctMeal(meal, correction, getLang());

      onSave(mealIndex, {
        ...meal,
        meal_name: result.meal_name,
        calories: result.calories,
        protein: result.protein,
        fat: result.fat,
        carbs: result.carbs
      });
      toast.success(me.recalculated);
      onClose();
    } catch (error) {
      console.error('Recalculate error:', error);
      toast.error(me.recalcError);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleDelete = () => {
    onDelete(mealIndex);
    toast.success(me.mealDeleted);
    onClose();
  };

  const nutrients = [
    { label: c.caloriesLabel, value: meal.calories, unit: c.kcal, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: c.protein, value: meal.protein, unit: 'g', icon: Beef, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: c.fat, value: meal.fat, unit: 'g', icon: Droplets, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: c.carbs, value: meal.carbs, unit: 'g', icon: Wheat, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
        onClick={onClose}
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
            <div className="w-full h-36 overflow-hidden relative">
              <img src={meal.photo_urls[0]} alt={meal.meal_name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
          )}

          <div className="p-5 space-y-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>
            {/* Header */}
            <div className="flex items-start justify-between">
              <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                🍽️ {meal.meal_name}
              </h3>
              <Button variant="ghost" size="icon" onClick={onClose}
                aria-label="Закрыть"
                className={`h-11 w-11 rounded-full flex-shrink-0 ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Current nutrients */}
            <div className="grid grid-cols-4 gap-1.5">
              {nutrients.map(n => (
                <div key={n.label} className={`rounded-lg p-2 text-center ${n.bg}`}>
                  <div className={`text-sm font-bold ${n.color}`}>{Math.round(n.value)}</div>
                  <div className={`text-[9px] ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>{n.unit === c.kcal ? c.kcal : `${n.label} (g)`}</div>
                </div>
              ))}
            </div>

            {/* Correction input */}
            <div>
              <label className={`text-xs font-medium mb-1.5 block ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                {me.whatToChange}
              </label>
              <Textarea
                placeholder={me.placeholder}
                value={correction}
                onChange={e => setCorrection(e.target.value)}
                className={`h-20 resize-none text-sm rounded-xl ${
                  theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10 text-white placeholder:text-gray-500'
                }`}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="outline"
                size="icon"
                aria-label={me.deleteMeal}
                className={`h-11 w-11 flex-shrink-0 ${
                  theme === 'light' ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleRecalculate}
                disabled={isRecalculating || !correction.trim()}
                aria-label={me.recalculate}
                className="flex-1 min-h-[44px] bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              >
                {isRecalculating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {me.recalculate}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/60 rounded-2xl">
              <div className={`p-5 rounded-2xl w-full ${theme === 'light' ? 'bg-white' : 'bg-[#1e2836]'}`}>
                <p className={`text-sm font-medium mb-4 text-center ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  {i.common.delete} «{meal.meal_name}»?
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => setShowDeleteConfirm(false)} variant="outline" aria-label={i.common.cancel} className="flex-1 min-h-[44px]">{me.no}</Button>
                  <Button onClick={handleDelete} aria-label={i.common.delete} className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600">{i.common.delete}</Button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}