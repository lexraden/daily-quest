/**
 * Overall levels: the look of each one, in one place.
 *
 * The XP thresholds that decide *which* level someone is on live on the server
 * (`overallLevelFor` in progress.ts) and arrive in the payload as
 * `overall_level`. They are repeated here only as a fallback for a payload
 * written before that field existed — if the two ever disagree, the server is
 * right, and this list is the one to correct.
 */
import { t } from '@/lib/i18n';

export const LEVEL_DEFS = [
  { level: 1, threshold: 0, icon: '🌱', color: '#6c5ce7' },
  { level: 2, threshold: 10, icon: '📚', color: '#00cec9' },
  { level: 3, threshold: 25, icon: '⚡', color: '#fdcb6e' },
  { level: 4, threshold: 50, icon: '🔥', color: '#e17055' },
  { level: 5, threshold: 100, icon: '💎', color: '#d63031' },
  { level: 6, threshold: 200, icon: '⚔️', color: '#fd79a8' },
  { level: 7, threshold: 350, icon: '🏆', color: '#fdcb6e' },
  { level: 8, threshold: 550, icon: '👑', color: '#ffeaa7' },
  { level: 9, threshold: 800, icon: '⚡', color: '#a29bfe' },
  { level: 10, threshold: 1100, icon: '✨', color: '#ffffff' },
];

export const MAX_LEVEL = LEVEL_DEFS.length;

/** The definition for a level number, clamped into the list. */
export function levelDef(level) {
  const index = Math.min(Math.max(Math.trunc(level) || 1, 1), MAX_LEVEL) - 1;
  return LEVEL_DEFS[index];
}

/** The localised title for a level — Novice, Apprentice, Practitioner… */
export function levelName(level) {
  return t().levels?.[levelDef(level).level] || `Level ${level}`;
}

/** Fallback for payloads that predate `overall_level`. */
export function levelFromXp(totalXp) {
  const xp = Number.isFinite(totalXp) ? Math.max(totalXp, 0) : 0;
  let level = 1;
  for (const def of LEVEL_DEFS) if (xp >= def.threshold) level = def.level;
  return level;
}

/** XP still needed for the next level, and how far through this one we are. */
export function levelProgress(totalXp, level) {
  const current = levelDef(level);
  const next = LEVEL_DEFS[current.level] || null;
  if (!next) return { remaining: 0, percent: 100, next: null };
  const span = next.threshold - current.threshold;
  const done = Math.max(0, totalXp - current.threshold);
  return {
    remaining: Math.max(0, next.threshold - totalXp),
    percent: span > 0 ? Math.min(100, (done / span) * 100) : 100,
    next,
  };
}

/**
 * Where an unlocked avatar's artwork lives.
 *
 * The files are dropped into `public/avatars/`; until they are, the emoji from
 * LEVEL_DEFS stands in. `avatarSrc` returning null is the signal to draw the
 * emoji instead, so a missing set degrades to the look this shipped with
 * rather than to a broken image.
 */
export const AVATAR_ASSETS_PRESENT = false;

export function avatarSrc(level) {
  if (!AVATAR_ASSETS_PRESENT) return null;
  return `/avatars/level-${levelDef(level).level}.png`;
}

/** "level-4" → 4. Anything else → null. */
export function levelFromChoice(choice) {
  const match = /^level-([1-9]|10)$/.exec(choice || '');
  return match ? Number(match[1]) : null;
}

/**
 * What to draw for a user right now, in priority order: an uploaded photo wins
 * over an unlocked avatar, because someone who took the trouble to set their
 * own picture should not have it replaced by levelling up.
 */
export function resolveAvatar(user, earnedLevel) {
  if (user?.avatar_url) return { kind: 'photo', src: user.avatar_url };

  const chosen = levelFromChoice(user?.avatar_choice);
  if (chosen && chosen <= (earnedLevel || 1)) {
    const src = avatarSrc(chosen);
    return src
      ? { kind: 'art', src, level: chosen }
      : { kind: 'emoji', emoji: levelDef(chosen).icon, color: levelDef(chosen).color, level: chosen };
  }

  return { kind: 'initial' };
}
