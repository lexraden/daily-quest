// Ensures quest_data has all required categories with valid quest objects.
// Filters out malformed entries (missing name/emoji/level) that may have
// been produced by an AI response or corrupted records.

const REQUIRED_CATEGORIES = ['health', 'mind', 'work', 'money', 'love', 'friends'];

export function sanitizeQuestData(raw, defaults) {
  const result = {};

  for (const cat of REQUIRED_CATEGORIES) {
    const arr = Array.isArray(raw?.[cat]) ? raw[cat] : [];
    const cleaned = arr.filter(
      (q) =>
        q &&
        typeof q === 'object' &&
        typeof q.name === 'string' &&
        q.name.trim().length > 0 &&
        typeof q.emoji === 'string' &&
        typeof q.level === 'number'
    );

    // Fall back to defaults if category ends up empty after cleaning
    result[cat] = cleaned.length > 0 ? cleaned : (defaults?.[cat] || []);
  }

  return result;
}