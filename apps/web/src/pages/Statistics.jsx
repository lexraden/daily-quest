import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { t, getLocale } from '@/lib/i18n';
import { getCachedUserData } from '@/components/UserDataCache';
import BackButton from '@/components/navigation/BackButton';
import PullToRefresh from '@/components/navigation/PullToRefresh';
import { MOOD_LEVELS } from '@/components/daily/MoodCheckIn';
import { dayKey } from '@/lib/dates';

const CATEGORIES = {
  health: { icon: '💪', color: '#00b894' },
  mind: { icon: '🧠', color: '#a29bfe' },
  money: { icon: '💰', color: '#00cec9' },
  work: { icon: '💼', color: '#fdcb6e' },
  love: { icon: '❤️', color: '#ff7675' },
  friends: { icon: '👥', color: '#fd79a8' },
};

/**
 * One sequential violet ramp, with the step order chosen per surface rather
 * than flipped wholesale: light mode reads light→dark, dark mode dark→light,
 * so every step keeps at least 3:1 against the surface it sits on.
 */
const MOOD_RAMP = {
  light: ['#ddd6fe', '#a78bfa', '#7c3aed'],
  dark: ['#7c3aed', '#a78bfa', '#ddd6fe'],
};
const MOOD_LINE = { light: '#7c3aed', dark: '#a78bfa' };

const DAYS = 30;
const MIN_CHECKINS = 3;


function StatTile({ label, value, sub, theme }) {
  const light = theme === 'light';
  return (
    <div
      className={`rounded-2xl p-3 ${
        light ? 'bg-white border border-gray-200' : 'bg-white/5 border border-white/10'
      }`}
    >
      <div className={`text-[11px] mb-1 ${light ? 'text-gray-500' : 'text-gray-400'}`}>{label}</div>
      <div
        className={`text-2xl font-semibold tabular-nums ${light ? 'text-gray-900' : 'text-white'}`}
      >
        {value}
      </div>
      {sub && (
        <div className={`text-[11px] mt-0.5 ${light ? 'text-gray-400' : 'text-gray-500'}`}>{sub}</div>
      )}
    </div>
  );
}

function Panel({ title, children, theme }) {
  const light = theme === 'light';
  return (
    <section
      className={`rounded-2xl p-4 ${
        light ? 'bg-white border border-gray-200' : 'bg-white/5 border border-white/10'
      }`}
    >
      <h2 className={`text-sm font-semibold mb-3 ${light ? 'text-gray-900' : 'text-white'}`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChartTooltip({ active, payload, label, theme, suffix }) {
  if (!active || !payload?.length) return null;
  const light = theme === 'light';
  return (
    <div
      className={`rounded-lg px-2.5 py-1.5 text-xs shadow-lg ${
        light ? 'bg-white border border-gray-200 text-gray-900' : 'bg-gray-900 border border-white/15 text-white'
      }`}
    >
      <div className={light ? 'text-gray-500' : 'text-gray-400'}>{label}</div>
      <div className="font-semibold tabular-nums">
        {payload[0].value}
        {suffix ? ` ${suffix}` : ''}
      </div>
    </div>
  );
}

export default function Statistics() {
  const [theme, setTheme] = useState('light');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const i = t();
  // `stats` was already taken by the Profile summary strings.
  const s = i.statsPage;

  useEffect(() => {
    setTheme(localStorage.getItem('dailyQuestsTheme') || 'light');
    let cancelled = false;
    (async () => {
      try {
        const { data: row } = await getCachedUserData();
        if (!cancelled) setData(row);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const light = theme === 'light';
  const ramp = MOOD_RAMP[light ? 'light' : 'dark'];
  const axis = light ? '#9ca3af' : '#6b7280';
  const grid = light ? '#f1f3f5' : 'rgba(255,255,255,0.06)';

  const model = useMemo(() => {
    const moodLog = data?.mood_log || {};
    const history = data?.completion_history || {};
    const locale = getLocale();

    // Last 30 days, oldest first, so the line reads left to right.
    const days = [];
    for (let n = DAYS - 1; n >= 0; n--) {
      const d = new Date();
      d.setDate(d.getDate() - n);
      const key = dayKey(d);
      days.push({
        key,
        label: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        mood: moodLog[key]?.score ?? null,
        quests: (history[key] || []).length,
      });
    }

    const checkIns = days.filter((d) => d.mood !== null);
    const avgMood = checkIns.length
      ? checkIns.reduce((sum, d) => sum + d.mood, 0) / checkIns.length
      : 0;

    // Average mood grouped by how much was done that day. Ordered buckets, so
    // the sequential ramp encodes "more quests" rather than mere identity.
    const buckets = [
      { name: '0', match: (q) => q === 0 },
      { name: '1–2', match: (q) => q >= 1 && q <= 2 },
      { name: '3+', match: (q) => q >= 3 },
    ].map((b) => {
      const inBucket = checkIns.filter((d) => b.match(d.quests));
      return {
        name: b.name,
        mood: inBucket.length
          ? Number((inBucket.reduce((sum, d) => sum + d.mood, 0) / inBucket.length).toFixed(1))
          : null,
        n: inBucket.length,
      };
    }).filter((b) => b.mood !== null);

    // The plain-language takeaway: the gap between the busiest and quietest
    // bucket, stated only when both actually have check-ins behind them.
    let insight = s.insightNone;
    const low = buckets.find((b) => b.name === '0');
    const high = buckets.find((b) => b.name === '3+');
    if (low && high) {
      const delta = high.mood - low.mood;
      if (Math.abs(delta) >= 0.3) {
        insight = s.insightMore
          .replace('{n}', '3')
          .replace('{d}', `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`);
      }
    }

    const totals = data?.category_total_completed || {};
    const byCategory = Object.keys(CATEGORIES)
      .map((key) => ({
        key,
        icon: CATEGORIES[key].icon,
        label: i.catNames?.[key] || key,
        name: `${CATEGORIES[key].icon} ${i.catNames?.[key] || key}`,
        value: totals[key] || 0,
        color: CATEGORIES[key].color,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      days,
      moodDays: days.filter((d) => d.mood !== null),
      checkIns: checkIns.length,
      avgMood,
      buckets,
      insight,
      byCategory,
      totalCompleted: data?.total_completed || 0,
      top: byCategory[0],
    };
  }, [data, i, s]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  const enough = model.checkIns >= MIN_CHECKINS;

  return (
    <PullToRefresh onRefresh={() => window.location.reload()}>
      <div className={`min-h-screen pb-24 ${light ? 'bg-gray-50' : 'bg-[#0f1115]'}`}>
        <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <BackButton theme={theme} />
            <div>
              <h1 className={`text-xl font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
                {s.title}
              </h1>
              <p className={`text-xs ${light ? 'text-gray-500' : 'text-gray-400'}`}>{s.subtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label={s.avgMood}
              value={model.checkIns ? model.avgMood.toFixed(1) : '—'}
              sub={
                model.checkIns
                  ? `${MOOD_LEVELS[Math.round(model.avgMood) - 1]?.emoji || ''} ${
                      i.mood.scale[Math.round(model.avgMood) - 1] || ''
                    }`
                  : undefined
              }
              theme={theme}
            />
            <StatTile label={s.questsDone} value={model.totalCompleted} theme={theme} />
            <StatTile label={s.checkIns} value={model.checkIns} sub={`${DAYS} ${s.days}`} theme={theme} />
            <StatTile
              label={s.bestCategory}
              value={
                model.top?.value ? (
                  <span className="flex items-center gap-1.5 text-lg">
                    <span aria-hidden="true">{model.top.icon}</span>
                    {model.top.label}
                  </span>
                ) : '—'
              }
              sub={model.top?.value ? `${model.top.value} ${s.quests}` : undefined}
              theme={theme}
            />
          </div>

          {!enough ? (
            <div
              className={`rounded-2xl p-6 text-center text-sm ${
                light
                  ? 'bg-white border border-gray-200 text-gray-500'
                  : 'bg-white/5 border border-white/10 text-gray-400'
              }`}
            >
              {model.checkIns === 0 ? s.noData : s.needMore}
            </div>
          ) : (
            <>
              <Panel title={s.moodOverTime} theme={theme}>
                <div className="h-44 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={model.days} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={grid} vertical={false} />
                      <XAxis
                        dataKey="label" stroke={axis} tickLine={false} axisLine={false}
                        style={{ fontSize: 10 }} minTickGap={24}
                      />
                      <YAxis
                        domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke={axis}
                        tickLine={false} axisLine={false} width={20} style={{ fontSize: 10 }}
                      />
                      <Tooltip
                        cursor={{ stroke: axis, strokeWidth: 1 }}
                        content={<ChartTooltip theme={theme} />}
                      />
                      {/* One series, so the panel title names it and no legend is needed. */}
                      {/* connectNulls bridges days with no check-in rather than
                          breaking the line into islands. */}
                      <Line
                        type="monotone" dataKey="mood"
                        stroke={MOOD_LINE[light ? 'light' : 'dark']} strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 0, fill: MOOD_LINE[light ? 'light' : 'dark'] }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title={s.moodVsQuests} theme={theme}>
                <div className="h-40 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={model.buckets} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={grid} vertical={false} />
                      <XAxis
                        dataKey="name" stroke={axis} tickLine={false} axisLine={false}
                        style={{ fontSize: 10 }}
                      />
                      <YAxis
                        domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} stroke={axis}
                        tickLine={false} axisLine={false} width={20} style={{ fontSize: 10 }}
                      />
                      <Tooltip
                        cursor={{ fill: light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }}
                        content={<ChartTooltip theme={theme} suffix={s.mood} />}
                      />
                      <Bar dataKey="mood" radius={[4, 4, 0, 0]} maxBarSize={54}>
                        {model.buckets.map((b, idx) => (
                          <Cell key={b.name} fill={ramp[idx] ?? ramp[ramp.length - 1]} />
                        ))}
                        {/* Direct labels: the values are the point, and they keep
                            the chart readable if the fills are hard to compare. */}
                        <LabelList
                          dataKey="mood" position="top"
                          formatter={(v) => Number(v).toFixed(1)}
                          style={{ fontSize: 11, fill: light ? '#374151' : '#d1d5db' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className={`text-xs mt-2 ${light ? 'text-gray-600' : 'text-gray-300'}`}>
                  {model.insight}
                </p>
              </Panel>
            </>
          )}

          <Panel title={s.byCategory} theme={theme}>
            {/* Horizontal bars with the category named on every row: identity
                comes from the label, so the app's category hues stay decorative
                rather than load-bearing. */}
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={model.byCategory} layout="vertical"
                  margin={{ top: 0, right: 28, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke={grid} horizontal={false} />
                  <XAxis type="number" stroke={axis} tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                  <YAxis
                    type="category" dataKey="name" stroke={axis} tickLine={false} axisLine={false}
                    width={104} style={{ fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }}
                    content={<ChartTooltip theme={theme} suffix={s.quests} />}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {model.byCategory.map((c) => (
                      <Cell key={c.key} fill={c.color} />
                    ))}
                    <LabelList
                      dataKey="value" position="right"
                      style={{ fontSize: 11, fill: light ? '#374151' : '#d1d5db' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>
    </PullToRefresh>
  );
}
