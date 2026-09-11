import { CATEGORIES } from './questData.js';

/**
 * What the coach may offer, once it has been checked.
 *
 * The model's answer is untrusted in exactly the way user input is: it can name
 * a category that does not exist, a quest that is not there, or a "replacement"
 * identical to what is already in the slot. Every one of those renders a button
 * that does nothing when tapped, which reads worse than no button at all — so
 * anything that cannot be acted on is dropped and the reply stands alone.
 */
export type Proposal =
  | { kind: 'quest_add'; category: string; level: number; name: string; emoji: string }
  | { kind: 'quest_edit'; category: string; level: number; name: string; emoji: string }
  | { kind: 'quest_delete'; category: string; level: number; name: string }
  | { kind: 'complete'; category: string; level: number }
  | { kind: 'journal'; category: string; text: string }
  | {
      kind: 'meal';
      meal_name: string;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
    };

interface Quest {
  level?: unknown;
  name?: unknown;
  emoji?: unknown;
}

export function validProposal(raw: unknown, questData: unknown): Proposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;

  if (p.kind === 'meal') {
    const name = text(p.meal_name, 80);
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

  const category = typeof p.category === 'string' ? p.category : '';
  if (!CATEGORIES.includes(category as never)) return null;

  if (p.kind === 'journal') {
    const body = text(p.text, 500);
    return body ? { kind: 'journal', category, text: body } : null;
  }

  const list = questsIn(questData, category);

  if (p.kind === 'quest_add') {
    const name = questName(p.name);
    if (!name) return null;
    // Offering to add something already there is a card that changes nothing.
    if (list.some((q) => sameName(q.name, name))) return null;
    const level = clampLevel(p.level) ?? 1;
    return { kind: 'quest_add', category, level, name, emoji: emojiOf(p.emoji) };
  }

  const level = clampLevel(p.level);
  if (level === null) return null;
  const current = list.find((q) => q.level === level);

  if (p.kind === 'complete') {
    // Ticking a quest that is not there would do nothing at all.
    return current ? { kind: 'complete', category, level } : null;
  }

  if (p.kind === 'quest_delete') {
    return current
      ? { kind: 'quest_delete', category, level, name: text(current.name, 200) }
      : null;
  }

  // 'quest' is the old name for this, kept so proposals stored before the
  // other kinds existed still render.
  if (p.kind !== 'quest_edit' && p.kind !== 'quest') return null;
  if (!current) return null;

  const name = questName(p.name);
  if (!name) return null;
  // "Replace Walk 15 minutes with Walk 15 minutes" is a card that changes
  // nothing, which reads as the coach not understanding the question.
  if (sameName(current.name, name)) return null;

  return { kind: 'quest_edit', category, level, name, emoji: emojiOf(p.emoji) };
}

function questsIn(questData: unknown, category: string): Quest[] {
  const set = (questData as Record<string, unknown>)?.[category];
  return Array.isArray(set) ? (set.filter((q) => q && typeof q === 'object') as Quest[]) : [];
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * A quest name with any leading emoji removed.
 *
 * The emoji travels in its own field and is drawn separately, but the model
 * kept prefixing the name with it too — which both doubled it on screen and
 * slipped past the "is this actually different" check, since "🚶 Walk" is not
 * the string "Walk".
 */
function questName(value: unknown): string {
  return text(value, 200).replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍\s]+/u, '').trim();
}

function sameName(a: unknown, b: string): boolean {
  return questName(a).toLocaleLowerCase() === b.toLocaleLowerCase();
}

function emojiOf(value: unknown): string {
  const e = text(value, 8);
  return e || '⭐';
}

/** Difficulty is 1 to 3; anything else is the model inventing a slot. */
function clampLevel(value: unknown): number | null {
  const level = Math.trunc(Number(value));
  return Number.isFinite(level) && level >= 1 && level <= 99 ? level : null;
}

/** Nutrition values are grams or kcal: non-negative, whole, and not absurd. */
export function grams(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 10000);
}
