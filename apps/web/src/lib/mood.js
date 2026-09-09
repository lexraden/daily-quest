/**
 * Mood scale. The daily check-in that wrote these was removed from the main
 * screen, but the scale outlives it: `quest_data.mood_log` still holds whatever
 * was recorded while it was there, and the Statistics page still plots it.
 *
 * Score is 1-5 so it averages meaningfully and plots on a fixed axis.
 */
export const MOOD_LEVELS = [
  { score: 1, emoji: '😞' },
  { score: 2, emoji: '😕' },
  { score: 3, emoji: '😐' },
  { score: 4, emoji: '🙂' },
  { score: 5, emoji: '😄' },
];
