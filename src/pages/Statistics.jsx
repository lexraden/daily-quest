import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, Calendar, Trophy, Target, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const CATEGORIES = {
  health: { name: "Health", icon: "💪", color: "#00b894" },
  mind: { name: "Mind", icon: "🧠", color: "#a29bfe" },
  money: { name: "Money", icon: "💰", color: "#00cec9" },
  work: { name: "Work", icon: "💼", color: "#fdcb6e" },
  love: { name: "Love", icon: "❤️", color: "#ff7675" },
  friends: { name: "Friends", icon: "👥", color: "#fd79a8" }
};

export default function Statistics() {
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('daily'); // daily, weekly, monthly
  const [stats, setStats] = useState({
    completionHistory: {},
    categoryTotalCompleted: {},
    totalCompleted: 0,
    streak: 0
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('dailyQuestsTheme') || 'light';
    setTheme(savedTheme);

    const savedData = localStorage.getItem('dailyQuestsData');
    if (savedData) {
      const data = JSON.parse(savedData);
      setStats({
        completionHistory: data.completionHistory || {},
        categoryTotalCompleted: data.categoryTotalCompleted || {},
        totalCompleted: data.totalCompleted || 0,
        streak: data.streak || 0
      });
    }
  }, []);

  // Generate chart data based on view mode
  const chartData = useMemo(() => {
    const today = new Date();
    const data = [];

    if (viewMode === 'daily') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const dayData = stats.completionHistory[dateKey] || [];
        
        data.push({
          date: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
          quests: dayData.length,
          ...Object.keys(CATEGORIES).reduce((acc, cat) => {
            acc[cat] = dayData.filter(q => q.category === cat).length;
            return acc;
          }, {})
        });
      }
    } else if (viewMode === 'weekly') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - (i * 7) - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        let weekQuests = 0;
        const weekCategoryData = {};
        
        for (let d = 0; d < 7; d++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + d);
          const dateKey = date.toISOString().split('T')[0];
          const dayData = stats.completionHistory[dateKey] || [];
          
          weekQuests += dayData.length;
          Object.keys(CATEGORIES).forEach(cat => {
            weekCategoryData[cat] = (weekCategoryData[cat] || 0) + dayData.filter(q => q.category === cat).length;
          });
        }
        
        data.push({
          date: `${weekStart.getDate()}-${weekEnd.getDate()} ${weekStart.toLocaleDateString('ru-RU', { month: 'short' })}`,
          quests: weekQuests,
          ...weekCategoryData
        });
      }
    } else {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const month = new Date(today);
        month.setMonth(month.getMonth() - i);
        const monthKey = month.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
        
        let monthQuests = 0;
        const monthCategoryData = {};
        
        Object.entries(stats.completionHistory).forEach(([dateKey, dayData]) => {
          const date = new Date(dateKey);
          if (date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()) {
            monthQuests += dayData.length;
            Object.keys(CATEGORIES).forEach(cat => {
              monthCategoryData[cat] = (monthCategoryData[cat] || 0) + dayData.filter(q => q.category === cat).length;
            });
          }
        });
        
        data.push({
          date: monthKey,
          quests: monthQuests,
          ...monthCategoryData
        });
      }
    }

    return data;
  }, [stats, viewMode]);

  // Category radar data
  const radarData = useMemo(() => {
    return Object.entries(CATEGORIES).map(([key, info]) => ({
      category: info.name,
      value: stats.categoryTotalCompleted[key] || 0,
      fullMark: Math.max(...Object.values(stats.categoryTotalCompleted || {}), 50)
    }));
  }, [stats]);

  const bgClass = theme === 'light' 
    ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
    : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' 
          ? 'bg-white/80 border-gray-200' 
          : 'bg-[#0f1419]/80 border-white/10'
      }`}>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link to={createPageUrl('DailyTracker')}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 rounded-full ${
                    theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'
                  }`}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  Статистика
                </h1>
                <p className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                  Твой прогресс и достижения
                </p>
              </div>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-2">
            {[
              { key: 'daily', label: 'День', icon: Calendar },
              { key: 'weekly', label: 'Неделя', icon: TrendingUp },
              { key: 'monthly', label: 'Месяц', icon: Target }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === key
                    ? theme === 'light'
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-white border border-purple-500/50'
                    : theme === 'light'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 inline mr-1" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-6 space-y-6 max-w-4xl mx-auto pb-20">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-5 border ${
            theme === 'light' 
              ? 'bg-gradient-to-br from-purple-50 to-white border-purple-200' 
              : 'bg-gradient-to-br from-purple-900/20 to-transparent border-purple-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-purple-400" />
              <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Всего
              </span>
            </div>
            <div className={`text-3xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              {stats.totalCompleted}
            </div>
          </div>

          <div className={`rounded-2xl p-5 border ${
            theme === 'light' 
              ? 'bg-gradient-to-br from-orange-50 to-white border-orange-200' 
              : 'bg-gradient-to-br from-orange-900/20 to-transparent border-orange-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Серия
              </span>
            </div>
            <div className={`text-3xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              {stats.streak}
            </div>
          </div>
        </div>

        {/* Quest Completion Trend */}
        <div className={`rounded-2xl p-5 border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          <h3 className={`text-lg font-bold mb-4 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            📈 Динамика выполнения
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
              <XAxis 
                dataKey="date" 
                stroke={theme === 'light' ? '#6b7280' : '#9ca3af'}
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke={theme === 'light' ? '#6b7280' : '#9ca3af'}
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme === 'light' ? '#ffffff' : '#1e2836',
                  border: theme === 'light' ? '1px solid #e5e7eb' : '1px solid #374151',
                  borderRadius: '12px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="quests" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className={`rounded-2xl p-5 border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          <h3 className={`text-lg font-bold mb-4 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            📊 По категориям
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
              <XAxis 
                dataKey="date" 
                stroke={theme === 'light' ? '#6b7280' : '#9ca3af'}
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke={theme === 'light' ? '#6b7280' : '#9ca3af'}
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme === 'light' ? '#ffffff' : '#1e2836',
                  border: theme === 'light' ? '1px solid #e5e7eb' : '1px solid #374151',
                  borderRadius: '12px'
                }}
              />
              <Legend />
              {Object.entries(CATEGORIES).map(([key, info]) => (
                <Bar 
                  key={key}
                  dataKey={key} 
                  name={info.name}
                  fill={info.color}
                  stackId="a"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Radar */}
        <div className={`rounded-2xl p-5 border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          <h3 className={`text-lg font-bold mb-4 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            🎯 Баланс категорий
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
              <PolarAngleAxis 
                dataKey="category" 
                stroke={theme === 'light' ? '#6b7280' : '#9ca3af'}
                style={{ fontSize: '12px' }}
              />
              <PolarRadiusAxis 
                stroke={theme === 'light' ? '#6b7280' : '#9ca3af'}
                style={{ fontSize: '12px' }}
              />
              <Radar 
                name="Квесты" 
                dataKey="value" 
                stroke="#8b5cf6" 
                fill="#8b5cf6" 
                fillOpacity={0.6} 
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme === 'light' ? '#ffffff' : '#1e2836',
                  border: theme === 'light' ? '1px solid #e5e7eb' : '1px solid #374151',
                  borderRadius: '12px'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Category List */}
        <div className={`rounded-2xl p-5 border ${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-[#1e2836] border-white/10'
        }`}>
          <h3 className={`text-lg font-bold mb-4 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            🏆 Всего по категориям
          </h3>
          <div className="space-y-2">
            {Object.entries(CATEGORIES)
              .sort((a, b) => (stats.categoryTotalCompleted[b[0]] || 0) - (stats.categoryTotalCompleted[a[0]] || 0))
              .map(([key, info]) => {
                const count = stats.categoryTotalCompleted[key] || 0;
                const maxCount = Math.max(...Object.values(stats.categoryTotalCompleted || {}), 1);
                const percentage = (count / maxCount) * 100;
                
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{info.icon}</span>
                        <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                          {info.name}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                        {count}
                      </span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${
                      theme === 'light' ? 'bg-gray-200' : 'bg-white/10'
                    }`}>
                      <div 
                        className="h-full transition-all duration-500"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: info.color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}