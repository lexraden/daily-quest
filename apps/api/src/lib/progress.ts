/**
 * XP and category levels are a pure function of the completion history, so the
 * server derives them rather than trusting numbers the client sends.
 *
 * They used to arrive as absolute integers computed in the browser
 * (`setTotalCompleted(prev => prev + xp)`), which loses an increment whenever
 * two tabs — or a phone and a laptop — complete a quest inside the same save
 * window: both read the same `prev`, both write the same total, and one
 * completion silently never happened. Deriving instead means the counters
 * always agree with the history they are supposed to summarise, whatever
 * order the writes land in.
 */

/** One completion as the client records it. Everything here is untrusted. */
interface Entry {
  category?: unknown;
  level?: unknown;
}

export interface Progress {
  totalCompleted: number;
  categoryTotalCompleted: Record<string, number>;
  categoryLevels: Record<string, number>;
}

/** Quests are level 1-3 and a level is worth that many XP. */
const XP_MIN = 1;
const XP_MAX = 3;

/** Every 10 XP in a category is one category level; levels start at 1. */
export const XP_PER_CATEGORY_LEVEL = 10;

export function categoryLevelFor(xp: number): number {
  return Math.floor(Math.max(xp, 0) / XP_PER_CATEGORY_LEVEL) + 1;
}

function xpOf(entry: Entry): number {
  const level = typeof entry?.level === 'number' ? entry.level : XP_MIN;
  if (!Number.isFinite(level)) return XP_MIN;
  return Math.min(Math.max(Math.trunc(level), XP_MIN), XP_MAX);
}

/**
 * `history` is `{ "YYYY-MM-DD": [entry, ...] }`. Anything that is not an array
 * of objects is skipped rather than rejected: this runs on rows that predate
 * the derivation and must never fail a save over a malformed leftover.
 */
export function deriveProgress(history: unknown): Progress {
  const byCategory: Record<string, number> = {};
  let total = 0;

  if (history && typeof history === 'object' && !Array.isArray(history)) {
    for (const entries of Object.values(history as Record<string, unknown>)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const category = (entry as Entry).category;
        if (typeof category !== 'string' || !category) continue;
        const xp = xpOf(entry as Entry);
        byCategory[category] = (byCategory[category] ?? 0) + xp;
        total += xp;
      }
    }
  }

  const levels: Record<string, number> = {};
  for (const [category, xp] of Object.entries(byCategory)) {
    levels[category] = categoryLevelFor(xp);
  }

  return { totalCompleted: total, categoryTotalCompleted: byCategory, categoryLevels: levels };
}

/**
 * XP at which each overall level starts, level 1 first.
 *
 * These used to live only in the browser (`LEVEL_DEFS` in DailyTracker), which
 * was fine while nothing depended on them. Deciding when to congratulate
 * someone does: the client may not reach the server for a while, two devices
 * may reach it at once, and a reload must not replay the celebration. So the
 * thresholds move here and the level travels in the payload; the browser keeps
 * its own copy of the icons, colours and names and looks them up by level.
 */
export const OVERALL_LEVEL_THRESHOLDS = [0, 10, 25, 50, 100, 200, 350, 550, 800, 1100];

/** The overall level for a given total XP. 1 at the bottom, never above 10. */
export function overallLevelFor(totalXp: number): number {
  const xp = Number.isFinite(totalXp) ? Math.max(totalXp, 0) : 0;
  let level = 1;
  for (let i = 0; i < OVERALL_LEVEL_THRESHOLDS.length; i += 1) {
    if (xp >= (OVERALL_LEVEL_THRESHOLDS[i] as number)) level = i + 1;
  }
  return level;
}
