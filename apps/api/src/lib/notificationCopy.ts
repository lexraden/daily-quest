/**
 * What the in-app notifications say for the events the app itself raises.
 *
 * The reminders job has its own copy (jobs/copy.ts) because it writes for a
 * lock screen and rotates its lines. These are different: they are reactions to
 * something the user just did, there is one right thing to say, and they are
 * read in a list rather than in a shade.
 *
 * Rank names deliberately do not appear here. They live in the web app's i18n,
 * and duplicating twenty strings across two packages is how the two drift; the
 * level number says enough, and `data.level` is on the row for a UI that wants
 * to name it.
 */

export type Lang = 'ru' | 'en';

export interface Line {
  title: string;
  body: string;
}

/** The streaks worth saying something about. Between these, silence. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365];

export function isStreakMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}

const RU = {
  levelUp: (level: number): Line => ({
    title: `Уровень ${level} достигнут`,
    body: 'Открыт новый облик — надеть его можно в профиле.',
  }),
  streakMilestone: (streak: number): Line => ({
    title: `${streak} дней подряд`,
    body: 'Серия держится. Так и продолжай.',
  }),
  freezeUsed: (freezes: number): Line => ({
    title: 'Заморозка использована',
    body:
      freezes > 0
        ? `Серия сохранена. Осталось заморозок: ${freezes}.`
        : 'Серия сохранена. Это была последняя заморозка.',
  }),
  streakLost: (streak: number): Line => ({
    title: 'Серия сброшена',
    body: streak > 0 ? `Было ${streak} дн. Начинаем заново — с одного квеста.` : 'Начинаем заново — с одного квеста.',
  }),
};

const EN = {
  levelUp: (level: number): Line => ({
    title: `Level ${level} reached`,
    body: 'A new look is unlocked — put it on from your profile.',
  }),
  streakMilestone: (streak: number): Line => ({
    title: `${streak} days in a row`,
    body: 'The streak is holding. Keep it up.',
  }),
  freezeUsed: (freezes: number): Line => ({
    title: 'Streak freeze used',
    body:
      freezes > 0
        ? `Your streak is safe. ${freezes} freeze${freezes === 1 ? '' : 's'} left.`
        : 'Your streak is safe. That was your last freeze.',
  }),
  streakLost: (streak: number): Line => ({
    title: 'Streak reset',
    body: streak > 0 ? `It was ${streak} days. Starting over — one quest does it.` : 'Starting over — one quest does it.',
  }),
};

export function copyFor(lang: Lang) {
  return lang === 'en' ? EN : RU;
}
