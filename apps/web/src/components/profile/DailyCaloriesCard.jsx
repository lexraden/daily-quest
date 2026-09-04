import React, { useMemo, useState } from 'react';
import { Flame, Beef, Droplets, Wheat, Pencil } from 'lucide-react';
import MealEditModal from '@/components/daily/MealEditModal';
import { t } from '@/lib/i18n';
import { todayKey } from '@/lib/dates';

export default function DailyCaloriesCard({ mealHistory = [], onEditMeal, onDeleteMeal, theme = 'light' }) {
  const [editingMeal, setEditingMeal] = useState(null);

  const todayMeals = useMemo(() => {
    return mealHistory
      .map((m, idx) => ({ ...m, _originalIndex: idx }))
      .filter(m => m.date === todayKey());
  }, [mealHistory]);

  const todayTotals = useMemo(() => ({
    calories: todayMeals.reduce((s, m) => s + (m.calories || 0), 0),
    protein: todayMeals.reduce((s, m) => s + (m.protein || 0), 0),
    fat: todayMeals.reduce((s, m) => s + (m.fat || 0), 0),
    carbs: todayMeals.reduce((s, m) => s + (m.carbs || 0), 0),
    count: todayMeals.length
  }), [todayMeals]);

  const i = t();
  const c = i.calories;
  const nutrients = [
    { label: c.protein, value: todayTotals.protein, icon: Beef, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: c.fat, value: todayTotals.fat, icon: Droplets, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: c.carbs, value: todayTotals.carbs, icon: Wheat, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  return (
    <>
      <div className={`rounded-2xl border p-4 ${
        theme === 'light'
          ? 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200'
          : 'bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/20'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🍽️</span>
          <h3 className={`text-sm font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            {c.todayCalories}
          </h3>
          {todayTotals.count > 0 && (
            <span className={`text-xs ml-auto ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
              {todayTotals.count} {c.meals}
            </span>
          )}
        </div>

        {/* Big calorie number */}
        <div className="flex items-baseline gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className={`text-3xl font-bold ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>
            {Math.round(todayTotals.calories)}
          </span>
          <span className={`text-sm ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>{c.kcal}</span>
        </div>

        {/* Macro bars */}
        <div className="grid grid-cols-3 gap-2">
          {nutrients.map(n => (
            <div key={n.label} className={`rounded-xl p-2 text-center ${n.bg}`}>
              <n.icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${n.color}`} />
              <div className={`text-sm font-bold ${n.color}`}>{Math.round(n.value)}г</div>
              <div className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>{n.label}</div>
            </div>
          ))}
        </div>

        {/* Today's meal list */}
        {todayMeals.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
              {c.mealList}
            </div>
            {todayMeals.map((meal) => (
              <div
                key={meal._originalIndex}
                onClick={() => setEditingMeal(meal)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.98] min-h-[44px] ${
                  theme === 'light' ? 'bg-white/80 hover:bg-white' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {meal.photo_urls?.[0] ? (
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={meal.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    theme === 'light' ? 'bg-orange-100' : 'bg-orange-500/20'
                  }`}>
                    <span className="text-sm">🍽️</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${theme === 'light' ? 'text-gray-800' : 'text-gray-200'}`}>
                    {meal.meal_name}
                  </div>
                  <div className={`text-[10px] ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {Math.round(meal.calories)} {c.kcal} · P{Math.round(meal.protein)} F{Math.round(meal.fat)} C{Math.round(meal.carbs)}
                  </div>
                </div>
                <Pencil className={`w-3.5 h-3.5 flex-shrink-0 ${theme === 'light' ? 'text-gray-300' : 'text-gray-600'}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingMeal && (
        <MealEditModal
          meal={editingMeal}
          mealIndex={editingMeal._originalIndex}
          onSave={(idx, updated) => {
            onEditMeal?.(idx, updated);
            setEditingMeal(null);
          }}
          onDelete={(idx) => {
            onDeleteMeal?.(idx);
            setEditingMeal(null);
          }}
          onClose={() => setEditingMeal(null)}
          theme={theme}
        />
      )}
    </>
  );
}