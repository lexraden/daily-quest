import React, { useMemo } from 'react';
import { Flame, Beef, Droplets, Wheat } from 'lucide-react';

export default function DailyCaloriesCard({ mealHistory = [], theme = 'light' }) {
  const todayKey = new Date().toISOString().split('T')[0];

  const todayTotals = useMemo(() => {
    const todayMeals = mealHistory.filter(m => m.date === todayKey);
    return {
      calories: todayMeals.reduce((s, m) => s + (m.calories || 0), 0),
      protein: todayMeals.reduce((s, m) => s + (m.protein || 0), 0),
      fat: todayMeals.reduce((s, m) => s + (m.fat || 0), 0),
      carbs: todayMeals.reduce((s, m) => s + (m.carbs || 0), 0),
      count: todayMeals.length
    };
  }, [mealHistory, todayKey]);

  const nutrients = [
    { label: 'Белки', value: todayTotals.protein, icon: Beef, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Жиры', value: todayTotals.fat, icon: Droplets, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Углеводы', value: todayTotals.carbs, icon: Wheat, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  return (
    <div className={`rounded-2xl border p-4 ${
      theme === 'light'
        ? 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200'
        : 'bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/20'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🍽️</span>
        <h3 className={`text-sm font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
          Калории сегодня
        </h3>
        {todayTotals.count > 0 && (
          <span className={`text-xs ml-auto ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
            {todayTotals.count} приёмов
          </span>
        )}
      </div>

      {/* Big calorie number */}
      <div className="flex items-baseline gap-2 mb-3">
        <Flame className="w-5 h-5 text-orange-500" />
        <span className={`text-3xl font-bold ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>
          {Math.round(todayTotals.calories)}
        </span>
        <span className={`text-sm ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>ккал</span>
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
    </div>
  );
}