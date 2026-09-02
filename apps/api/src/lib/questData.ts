export const CATEGORIES = ['health', 'mind', 'work', 'money', 'love', 'friends'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Quest {
  level: number;
  emoji: string;
  name: string;
}

export type QuestSet = Record<string, Quest[]>;

/**
 * Ported from the frontend's sanitizeQuestData. It now runs server-side too, so
 * malformed model output can never reach the database — the client-side copy
 * stays as a second line of defence for records written before this existed.
 */
export function sanitizeQuestData(raw: unknown, defaults?: QuestSet): QuestSet {
  const source = (raw ?? {}) as Record<string, unknown>;
  const result: QuestSet = {};

  for (const cat of CATEGORIES) {
    const arr = Array.isArray(source[cat]) ? (source[cat] as unknown[]) : [];
    const cleaned = arr.filter((q): q is Quest => {
      if (!q || typeof q !== 'object') return false;
      const quest = q as Partial<Quest>;
      return (
        typeof quest.name === 'string' &&
        quest.name.trim().length > 0 &&
        typeof quest.emoji === 'string' &&
        typeof quest.level === 'number'
      );
    });

    result[cat] = cleaned.length > 0 ? cleaned : (defaults?.[cat] ?? []);
  }

  return result;
}

/** Levels ascend 1..3 within a category; the model occasionally reorders them. */
export function sortByLevel(set: QuestSet): QuestSet {
  const out: QuestSet = {};
  for (const [cat, quests] of Object.entries(set)) {
    out[cat] = [...quests].sort((a, b) => a.level - b.level);
  }
  return out;
}

export const zeroedByCategory = (): Record<string, number> =>
  Object.fromEntries(CATEGORIES.map((c) => [c, 0]));

export const onesByCategory = (): Record<string, number> =>
  Object.fromEntries(CATEGORIES.map((c) => [c, 1]));
