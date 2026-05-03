import React, { useState, useMemo } from 'react';
import { Flame, Trophy, TrendingUp, Calendar, Target } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { t, getLocale } from '@/lib/i18n';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", color: "#00b894" },
  mind: { name: "Mind", icon: "🧠", color: "#a29bfe" },
  money: { name: "Money", icon: "💰", color: "#00cec9" },
  work: { name: "Work", icon: "💼", color: "#fdcb6e" },
  love: { name: "Love", icon: "❤️", color: "#ff7675" },
  friends: { name: "Friends", icon: "👥", color: "#fd79a8" }
};

export default function StatsSection({ completionHistory, categoryTotalCompleted, totalCompleted, streak, categoryLevels, theme, journalEntries = [] }) {
  const [viewMode, setViewMode] = useState('daily');
  const i = t();
  const s = i.stats;
  const locale = getLocale();

  // Build a merged history: completionHistory + journal quest_completed entries
  const mergedHistory = useMemo(() => {
    const merged = {};
    // Copy completionHistory
    Object.entries(completionHistory).forEach(([dateKey, quests]) => {
      merged[dateKey] = [...quests];
    });
    // Add journal entries of type quest_completed
    journalEntries.forEach(entry => {
      if (entry.type === 'quest_completed' && entry.date) {
        if (!merged[entry.date]) merged[entry.date] = [];
        // Avoid duplicates: check if already present by matching category+text
        const isDuplicate = merged[entry.date].some(q =>
          q.category === entry.category && (q.questName === entry.text || q.emoji === entry.emoji)
        );
        if (!isDuplicate) {
          merged[entry.date].push({
            category: entry.category,
            questName: entry.text,
            emoji: entry.emoji,
            level: entry.level || entry.questLevel
          });
        }
      }
    });
    return merged;
  }, [completionHistory, journalEntries]);

  const chartData = useMemo(() => {
    const today = new Date();
    const data = [];

    if (viewMode === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const dayData = mergedHistory[dateKey] || [];
        data.push({
          date: date.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
          quests: dayData.length,
          ...Object.keys(CATEGORIES).reduce((acc, cat) => {
            acc[cat] = dayData.filter(q => q.category === cat).length;
            return acc;
          }, {})
        });
      }
    } else if (viewMode === 'weekly') {
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - (i * 7) - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        let weekQuests = 0;
        const weekCat = {};
        for (let d = 0; d < 7; d++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + d);
          const dateKey = date.toISOString().split('T')[0];
          const dayData = mergedHistory[dateKey] || [];
          weekQuests += dayData.length;
          Object.keys(CATEGORIES).forEach(cat => {
            weekCat[cat] = (weekCat[cat] || 0) + dayData.filter(q => q.category === cat).length;
          });
        }
        data.push({
          date: `${weekStart.getDate()}-${weekEnd.getDate()} ${weekStart.toLocaleDateString(locale, { month: 'short' })}`,
          quests: weekQuests,
          ...weekCat
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const month = new Date(today);
        month.setMonth(month.getMonth() - i);
        let monthQuests = 0;
        const monthCat = {};
        Object.entries(mergedHistory).forEach(([dateKey, dayData]) => {
          const date = new Date(dateKey);
          if (date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()) {
            monthQuests += dayData.length;
            Object.keys(CATEGORIES).forEach(cat => {
              monthCat[cat] = (monthCat[cat] || 0) + dayData.filter(q => q.category === cat).length;
            });
          }
        });
        data.push({
          date: month.toLocaleDateString(locale, { month: 'short' }),
          quests: monthQuests,
          ...monthCat
        });
      }
    }
    return data;
  }, [mergedHistory, viewMode]);

  // Compute actual total counts from mergedHistory (includes voice quests)
  const mergedCategoryCounts = useMemo(() => {
    const counts = {};
    Object.keys(CATEGORIES).forEach(cat => { counts[cat] = 0; });
    Object.values(mergedHistory).forEach(dayData => {
      dayData.forEach(q => {
        if (q.category && counts.hasOwnProperty(q.category)) {
          counts[q.category] += (q.level || 1);
        }
      });
    });
    return counts;
  }, [mergedHistory]);

  const mergedTotalCompleted = useMemo(() => {
    return Object.values(mergedCategoryCounts).reduce((sum, c) => sum + c, 0);
  }, [mergedCategoryCounts]);

  const radarData = useMemo(() => {
    return Object.entries(CATEGORIES).map(([key, info]) => ({
      category: info.name,
      value: mergedCategoryCounts[key] || 0,
      fullMark: Math.max(...Object.values(mergedCategoryCounts), 10)
    }));
  }, [mergedCategoryCounts]);

  const tooltipStyle = {
    backgroundColor: theme === 'light' ? '#fff' : '#1e2836',
    border: theme === 'light' ? '1px solid #e5e7eb' : '1px solid #374151',
    borderRadius: '12px'
  };
  const axisColor = theme === 'light' ? '#6b7280' : '#9ca3af';
  const gridColor = theme === 'light' ? '#e5e7eb' : '#374151';

  return (
    <div className="space-y-3">


      {/* Period tabs */}
      <div className="flex gap-2">
        {[
          { key: 'daily', label: s.dayPeriod },
          { key: 'weekly', label: s.weekPeriod },
          { key: 'monthly', label: s.monthPeriod }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            aria-label={`${s.period}: ${label}`}
            className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[44px] ${
              viewMode === key
                ? theme === 'light'
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                  : 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-white border border-purple-500/50'
                : theme === 'light'
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Line chart */}
      <div className={`rounded-2xl p-4 border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'}`}>
        <h3 className={`text-sm font-bold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{s.dynamics}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="date" stroke={axisColor} style={{ fontSize: '10px' }} />
            <YAxis stroke={axisColor} style={{ fontSize: '10px' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="quests" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bar chart */}
      <div className={`rounded-2xl p-4 border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'}`}>
        <h3 className={`text-sm font-bold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{s.byCategory}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="date" stroke={axisColor} style={{ fontSize: '10px' }} />
            <YAxis stroke={axisColor} style={{ fontSize: '10px' }} />
            <Tooltip contentStyle={tooltipStyle} />
            {Object.entries(CATEGORIES).map(([key, info]) => (
              <Bar key={key} dataKey={key} name={info.name} fill={info.color} stackId="a" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar */}
      <div className={`rounded-2xl p-4 border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'}`}>
        <h3 className={`text-sm font-bold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{s.balance}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis dataKey="category" stroke={axisColor} style={{ fontSize: '10px' }} />
            <Radar name={s.questsLabel} dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}