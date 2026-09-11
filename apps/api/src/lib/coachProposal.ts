import { CATEGORIES } from './questData.js';

/**
 * What the coach may offer, once it has been checked.
 *
 * The model's answer is untrusted in exactly the way user input is: it can name
 * a category that does not exist, a level outside the grid, or a "replacement"
 * identical to the quest already there. Every one of those renders a button
 * that does nothing when tapped, which reads worse than no button at all — so
 * anything that cannot be acted on is dropped and the reply stands alone.
 */
export type Proposal =
  | { kind: 'quest'; category: string; level: number; name: string; emoji: string }
  | { kind: 'complete'; category: string; level: number }
  | {
      kind: 'meal';
      meal_name: string;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
    };

/**
 * Keeps only what a proposal needs to be actionable, and returns null if it is
 * not. Every rejection here is a button the user would have tapped for nothing.
 */
export function validProposal(raw: unknown, questData: unknown): Proposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;

  if (p.kind === 'meal') {
    const name = typeof p.meal_name === 'string' ? p.meal_name.trim().slice(0, 80) : '';
    if (!name) return null;
    // A meal with no calories tells the user nothing and adds a zero to their
    // day; the estimate is the whole point of offering it.
    const calories = grams(p.calories);
    if (calories <= 0) return null;
    return {
      kind: 'meal',
      meal_name: name,
      calories,
      protein: grams(p.protein),
      fat: grams(p.fat),
      carbs: grams(p.carbs),
    };
  }

  if (p.kind !== 'quest' && p.kind !== 'complete') return null;
  if (typeof p.category !== 'string' || !CATEGORIES.includes(p.category as never)) return null;

  const level = Math.trunc(Number(p.level));
  if (!Number.isFinite(level) || level < 1 || level > 3) return null;

  const quests = (questData as Record<string, unknown>)?.[p.category];
  const current = Array.isArray(quests)
    ? (quests.find(
        (q) => q && typeof q === 'object' && (q as { level?: unknown }).level === level,
      ) as { name?: unknown; emoji?: unknown } | undefined)
    : undefined;

  if (p.kind === 'complete') {
    // Ticking a quest that is not there would do nothing at all.
    return current ? { kind: 'complete', category: p.category, level } : null;
  }

  const name = typeof p.name === 'string' ? p.name.trim().slice(0, 80) : '';
  if (!name) return null;

  // "Replace Walk 15 minutes with Walk 15 minutes" is a card that changes
  // nothing, which reads as the coach not understanding the question.
  if (typeof current?.name === 'string' && current.name.trim() === name) return null;

  const emoji = typeof p.emoji === 'string' && p.emoji.trim() ? p.emoji.trim().slice(0, 8) : '⭐';
  return { kind: 'quest', category: p.category, level, name, emoji };
}

/** Nutrition values are grams or kcal: non-negative, whole, and not absurd. */
export function grams(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 10000);
}

