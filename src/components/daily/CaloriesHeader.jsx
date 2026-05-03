import React, { useState, useMemo } from 'react';
import { Flame, Activity, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

/**
 * CaloriesHeader — compact in/out calories indicator for the top of DailyTracker.
 * - "in" is computed from today's meals (mealHistory).
 * - "out" requires an external activity tracker integration. Since Apple Health,
 *   Google Fit and Fitbit aren't directly accessible from a web app, we show a
 *   "Connect" button that opens an info modal.
 */
export default function CaloriesHeader({ mealHistory = [], theme = 'light' }) {
  const [showIntegration, setShowIntegration] = useState(false);
  const i = t();
  const c = i.calories;

  const todayKey = new Date().toISOString().split('T')[0];
  const caloriesIn = useMemo(() => {
    return Math.round(
      (mealHistory || [])
        .filter(m => m.date === todayKey)
        .reduce((sum, m) => sum + (m.calories || 0), 0)
    );
  }, [mealHistory, todayKey]);

  // No real integration yet — out is null until connected
  const caloriesOut = null;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Calories IN */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
          theme === 'light' ? 'bg-orange-100' : 'bg-orange-500/15'
        }`}>
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          <span className={`text-xs font-semibold ${theme === 'light' ? 'text-orange-700' : 'text-orange-300'}`}>
            {caloriesIn}
          </span>
        </div>

        {/* Calories OUT or Connect button */}
        {caloriesOut !== null ? (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
            theme === 'light' ? 'bg-green-100' : 'bg-green-500/15'
          }`}>
            <Activity className="w-3.5 h-3.5 text-green-500" />
            <span className={`text-xs font-semibold ${theme === 'light' ? 'text-green-700' : 'text-green-300'}`}>
              {caloriesOut}
            </span>
          </div>
        ) : (
          <button
            onClick={() => setShowIntegration(true)}
            aria-label={c.connectIntegration}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all active:scale-95 min-h-[28px] ${
              theme === 'light'
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                : 'bg-white/5 hover:bg-white/10 text-gray-400'
            }`}
          >
            <Plus className="w-3 h-3" />
            <Activity className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Integration info modal */}
      {showIntegration && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowIntegration(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 ${
              theme === 'light' ? 'bg-white' : 'bg-[#1e2836]'
            }`}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" />
                <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  {c.integrationTitle}
                </h3>
              </div>
              <button
                onClick={() => setShowIntegration(false)}
                aria-label={i.common.close}
                className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center ${
                  theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/10'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className={`text-sm mb-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
              {c.integrationDesc}
            </p>

            <div className="space-y-2 mb-4">
              <div className={`flex items-center gap-3 p-3 rounded-xl ${
                theme === 'light' ? 'bg-gray-50' : 'bg-white/5'
              }`}>
                <span className="text-xl">⌚</span>
                <span className={`text-sm flex-1 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                  {c.integrationFitbit}
                </span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${
                theme === 'light' ? 'bg-gray-50' : 'bg-white/5'
              }`}>
                <span className="text-xl">✍️</span>
                <span className={`text-sm flex-1 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                  {c.integrationManual}
                </span>
              </div>
            </div>

            <Button
              onClick={() => setShowIntegration(false)}
              className="w-full h-11 rounded-xl"
            >
              {i.common.close}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}