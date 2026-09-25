import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { t } from '@/lib/i18n';

/**
 * The numbers behind a period of history — quests and meals both.
 *
 * What this replaced charted quests alone, so half of what people log never
 * appeared in it: a day of three meals and no quests drew an empty graph. It
 * also sat above the list, pushing the day's actual entries off the first
 * screen, and used dashed gridlines and a radar chart, which are hard to read.
 *
 * The form follows what each number is for:
 *
 *   - three headline totals are stat tiles, not a chart — the number is the
 *     chart;
 *   - quests and calories per day are two column charts, not one chart with
 *     two scales, because a shared plot would invent a relationship between
 *     them that is not in the data;
 *   - the macro split is three labelled meters, not one stacked bar. The app's
 *     fat and carb colours (yellow and green) are indistinguishable to a
 *     protanope — ΔE 4.2 against a floor of 6 — so in touching segments they
 *     would carry identity by colour alone. As separate labelled rows the text
 *     says which is which and the colour only agrees with the rest of the app;
 *   - categories are labelled rows for the same reason.
 *
 * Chart colours were run through the palette validator for both themes and
 * pass every check against their card surfaces.
 */

const CATEGORY_COLORS = {
  // The same values the tracker gives each category; see DailyTracker.
  health: '#00b894',
  mind: '#a29bfe',
  money: '#00cec9',
  work: '#fdcb6e',
  love: '#ff7675',
  friends: '#fd79a8',
};

const CATEGORY_EMOJI = {
  health: '💪', mind: '🧠', money: '💰', work: '💼', love: '❤️', friends: '👥',
};

/** Energy per gram, so the split is a share of what was eaten, not of weight. */
const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 };

/** The same colours the meal cards use for P, F and C. */
const MACRO_COLORS = { protein: '#ef4444', fat: '#eab308', carbs: '#22c55e' };

const ACCENT = {
  light: { quests: '#9333ea', kcal: '#ea580c' },
  dark: { quests: '#8b5cf6', kcal: '#ea580c' },
};

/** Mirrors lib/progress.ts on the server: a quest is worth its level, 1 to 3. */
const xpOf = (level) => Math.min(Math.max(Math.trunc(Number(level) || 1), 1), 3);

export default function HistoryDashboard({ theme, days, trendDays, getEntriesForDate, dayKey, formatLabel }) {
  const i = t();
  const d = i.historyPage.dashboard;
  const light = theme === 'light';
  const accent = light ? ACCENT.light : ACCENT.dark;

  const ink = light
    ? { primary: 'text-gray-900', secondary: 'text-gray-600', muted: 'text-gray-500' }
    : { primary: 'text-white', secondary: 'text-gray-300', muted: 'text-gray-400' };
  const card = light ? 'bg-white border border-gray-200' : 'bg-[#1e2836] border border-white/10';
  const track = light ? '#f3f4f6' : 'rgba(255,255,255,0.08)';
  const grid = light ? '#e5e7eb' : 'rgba(255,255,255,0.08)';
  const axis = light ? '#6b7280' : '#9ca3af';

  // Everything scoped to the period, from the same entries the list shows.
  const totals = useMemo(() => {
    const out = { xp: 0, quests: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, byCategory: {} };
    for (const day of days) {
      for (const e of getEntriesForDate(dayKey(day))) {
        if (e.type === 'quest_completed') {
          out.quests += 1;
          out.xp += xpOf(e.level);
          if (e.category) out.byCategory[e.category] = (out.byCategory[e.category] || 0) + 1;
        } else if (e.type === 'meal') {
          out.kcal += Number(e.calories) || 0;
          out.protein += Number(e.protein) || 0;
          out.fat += Number(e.fat) || 0;
          out.carbs += Number(e.carbs) || 0;
        }
      }
    }
    return out;
  }, [days, getEntriesForDate, dayKey]);

  // The trend can reach wider than the period — a single day is charted
  // against the week before it, since one column is not a trend.
  const trend = useMemo(
    () =>
      trendDays.map((day) => {
        const entries = getEntriesForDate(dayKey(day));
        return {
          label: formatLabel(day),
          quests: entries.filter((e) => e.type === 'quest_completed').length,
          kcal: Math.round(
            entries.filter((e) => e.type === 'meal').reduce((sum, e) => sum + (Number(e.calories) || 0), 0),
          ),
        };
      }),
    [trendDays, getEntriesForDate, dayKey, formatLabel],
  );

  const macros = useMemo(() => {
    const energy = {
      protein: totals.protein * KCAL_PER_GRAM.protein,
      fat: totals.fat * KCAL_PER_GRAM.fat,
      carbs: totals.carbs * KCAL_PER_GRAM.carbs,
    };
    const sum = energy.protein + energy.fat + energy.carbs;
    return ['protein', 'fat', 'carbs'].map((key) => ({
      key,
      grams: Math.round(totals[key]),
      share: sum > 0 ? Math.round((energy[key] / sum) * 100) : 0,
    }));
  }, [totals]);

  const categories = useMemo(() => {
    const rows = Object.entries(totals.byCategory)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
    const max = rows[0]?.count || 1;
    return rows.map((r) => ({ ...r, width: (r.count / max) * 100 }));
  }, [totals]);

  if (totals.quests === 0 && totals.kcal === 0) return null;

  const hasMeals = macros.some((m) => m.grams > 0);
  const showQuestTrend = trend.some((p) => p.quests > 0);
  const showKcalTrend = trend.some((p) => p.kcal > 0);
  // A month of daily labels would overlap; thin them to about seven.
  const tickInterval = trend.length > 10 ? Math.ceil(trend.length / 7) - 1 : 0;

  const tile = (value, label) => (
    <div className={`flex-1 rounded-xl p-3 ${card}`}>
      <div className={`text-xl font-bold ${ink.primary}`}>{value}</div>
      <div className={`text-xs ${ink.muted}`}>{label}</div>
    </div>
  );

  const section = (title, children) => (
    <div className={`rounded-xl p-4 ${card}`}>
      <h3 className={`text-sm font-semibold mb-3 ${ink.primary}`}>{title}</h3>
      {children}
    </div>
  );

  /** A tooltip in text tokens: the colour belongs to the mark, not the words. */
  const tip = (unit) =>
    function DashboardTooltip({ active, payload, label }) {
      if (!active || !payload?.length) return null;
      return (
        <div className={`rounded-lg px-2.5 py-1.5 text-xs shadow-lg ${card}`}>
          <div className={ink.muted}>{label}</div>
          <div className={`font-semibold ${ink.primary}`}>
            {payload[0].value} {unit}
          </div>
        </div>
      );
    };

  /**
   * Calories reach four digits, and a four-digit tick does not fit a narrow
   * axis: the first version cut "1000" down to "00" on a phone. Compact ticks
   * keep the axis narrow; the tooltip still gives the exact figure.
   */
  const compactTick = (v) =>
    v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v);

  const columns = (dataKey, color, unit) => (
    // Height includes the axis band, so the labels are never cropped into a
    // nested scroll.
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
          {/* Solid hairlines, horizontal only: dashing reads as a threshold. */}
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: axis }}
            tickLine={false}
            axisLine={{ stroke: grid }}
            interval={tickInterval}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: axis }}
            tickFormatter={compactTick}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={tip(unit)} cursor={{ fill: light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-3 pt-2">
      <h2 className={`text-xs font-bold uppercase tracking-wider px-1 ${ink.muted}`}>{d.title}</h2>

      <div className="flex gap-2">
        {tile(totals.xp, d.xp)}
        {tile(Math.round(totals.kcal).toLocaleString(), d.kcal)}
        {tile(`${Math.round(totals.protein)} g`, d.protein)}
      </div>

      {showQuestTrend && section(trendDays.length > days.length ? d.questsLast7 : d.questsPerDay,
        columns('quests', accent.quests, d.questsUnit))}

      {showKcalTrend && section(trendDays.length > days.length ? d.kcalLast7 : d.kcalPerDay,
        columns('kcal', accent.kcal, 'kcal'))}

      {hasMeals && section(d.macros, (
        <div className="space-y-3">
          {macros.map((m) => (
            <div key={m.key}>
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-sm ${ink.secondary}`}>
                  {{ protein: d.macroProtein, fat: d.fat, carbs: d.carbs }[m.key]}
                </span>
                <span className={`text-sm ${ink.primary}`}>
                  {m.grams} g <span className={ink.muted}>· {m.share}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: track }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${m.share}%`, background: MACRO_COLORS[m.key] }}
                />
              </div>
            </div>
          ))}
          <p className={`text-xs ${ink.muted}`}>{d.macrosNote}</p>
        </div>
      ))}

      {categories.length > 0 && section(d.byCategory, (
        <div className="space-y-2.5">
          {categories.map((c) => (
            <div key={c.key} className="flex items-center gap-3">
              <span className={`w-24 shrink-0 text-sm truncate ${ink.secondary}`}>
                {CATEGORY_EMOJI[c.key]} {i.catNames?.[c.key] || c.key}
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: track }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${c.width}%`, background: CATEGORY_COLORS[c.key] || accent.quests }}
                />
              </div>
              <span className={`w-6 text-right text-sm tabular-nums ${ink.primary}`}>{c.count}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
