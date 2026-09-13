/**
 * What a reminder actually says.
 *
 * Two fixed strings is what a notification system sounds like on day one and a
 * robot by day three. These are written to be read by a person who has seen
 * them before: they use the name, they name the thing that is actually waiting,
 * and there are enough of them that the same line does not come back tomorrow.
 *
 * The register is deliberate — mildly put out, never scolding. A reminder that
 * shames gets the notification permission revoked, which is worse than one that
 * gets ignored.
 */

export type Lang = 'ru' | 'en';
export type Situation = 'streak_warning' | 'reminder_streak' | 'reminder_cold';

export interface CopyContext {
  name: string;
  streak: number;
  /** A quest they have not done today, if there is one worth naming. */
  quest?: string;
}

interface Line {
  title: (c: CopyContext) => string;
  body: (c: CopyContext) => string;
}

/**
 * First name only, and only if it looks like one.
 *
 * Google hands back whatever the account says, which for some people is an
 * email address or a single emoji. Anything that would read oddly in "Hi ___"
 * is dropped and the line falls back to its nameless form.
 */
export function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  if (first.length < 2 || first.length > 20) return '';
  if (/[@\d]/.test(first)) return '';
  return first;
}

const EN: Record<Situation, Line[]> = {
  streak_warning: [
    {
      title: (c) => (c.name ? `${c.name}, your streak ends tonight` : 'Your streak ends tonight'),
      body: (c) => `${c.streak} days. One quest keeps it alive.`,
    },
    {
      title: () => 'This is the last call',
      body: (c) =>
        c.quest
          ? `${c.streak} days go at midnight. "${c.quest}" would do it.`
          : `${c.streak} days go at midnight unless you finish one quest.`,
    },
    {
      title: (c) => `${c.streak} days, about to be zero`,
      body: (c) => (c.name ? `Up to you, ${c.name}.` : 'One quest. That is all it takes.'),
    },
    {
      title: () => 'Still nothing today',
      body: (c) => `Your ${c.streak}-day streak has a few hours left.`,
    },
  ],

  reminder_streak: [
    {
      title: (c) => (c.name ? `Hi ${c.name}. About today…` : 'About today…'),
      body: (c) =>
        c.quest ? `"${c.quest}" is still waiting. ${c.streak} days on the line.` : `${c.streak} days and counting. Keep it.`,
    },
    {
      title: () => 'Just checking in',
      body: (c) => `${c.streak} days so far. Today is not done yet.`,
    },
    {
      title: (c) => `Day ${c.streak + 1}`,
      body: (c) => (c.quest ? `Starts with "${c.quest}".` : 'Starts whenever you open the app.'),
    },
    {
      title: () => 'Your quests are waiting',
      body: (c) =>
        c.name ? `${c.name}, ${c.streak} days is a long way to come back from zero.` : `${c.streak} days is a long way to come back from zero.`,
    },
    {
      title: () => 'Small thing, big streak',
      body: (c) => `One quest tonight makes it ${c.streak + 1} days.`,
    },
  ],

  reminder_cold: [
    {
      title: (c) => (c.name ? `${c.name}, fancy starting one?` : 'Fancy starting a streak?'),
      body: (c) => (c.quest ? `"${c.quest}" takes minutes.` : 'One quest is the whole first day.'),
    },
    {
      title: () => 'Day one is the hard one',
      body: () => 'And it is only one quest long.',
    },
    {
      title: () => 'Your quests are waiting',
      body: (c) => (c.quest ? `Starting with "${c.quest}".` : 'Pick the easiest and be done.'),
    },
    {
      title: () => 'Nothing logged today',
      body: (c) => (c.name ? `Still time, ${c.name}.` : 'There is still time.'),
    },
  ],
};

const RU: Record<Situation, Line[]> = {
  streak_warning: [
    {
      title: (c) => (c.name ? `${c.name}, серия оборвётся сегодня` : 'Серия оборвётся сегодня'),
      body: (c) => `${c.streak} дн. Один квест — и она жива.`,
    },
    {
      title: () => 'Последний шанс',
      body: (c) =>
        c.quest
          ? `${c.streak} дн. сгорят в полночь. Хватит «${c.quest}».`
          : `${c.streak} дн. сгорят в полночь, если не закрыть ни одного квеста.`,
    },
    {
      title: (c) => `${c.streak} дн. вот-вот станут нулём`,
      body: (c) => (c.name ? `Решать тебе, ${c.name}.` : 'Один квест. Больше ничего не нужно.'),
    },
    {
      title: () => 'Сегодня всё ещё пусто',
      body: (c) => `У серии в ${c.streak} дн. осталось несколько часов.`,
    },
  ],

  reminder_streak: [
    {
      title: (c) => (c.name ? `${c.name}, насчёт сегодня…` : 'Насчёт сегодня…'),
      body: (c) =>
        c.quest ? `«${c.quest}» всё ещё ждёт. На кону ${c.streak} дн.` : `${c.streak} дн. позади. Не бросай.`,
    },
    {
      title: () => 'Просто напоминаю',
      body: (c) => `${c.streak} дн. в серии. День ещё не закрыт.`,
    },
    {
      title: (c) => `День ${c.streak + 1}`,
      body: (c) => (c.quest ? `Начинается с «${c.quest}».` : 'Начинается, как только откроешь приложение.'),
    },
    {
      title: () => 'Квесты ждут',
      body: (c) =>
        c.name ? `${c.name}, ${c.streak} дн. — обидно возвращаться к нулю.` : `${c.streak} дн. — обидно возвращаться к нулю.`,
    },
    {
      title: () => 'Мелочь, а серия',
      body: (c) => `Один квест вечером — и будет ${c.streak + 1} дн.`,
    },
  ],

  reminder_cold: [
    {
      title: (c) => (c.name ? `${c.name}, начнём серию?` : 'Начнём серию?'),
      body: (c) => (c.quest ? `«${c.quest}» — это пара минут.` : 'Один квест — и первый день есть.'),
    },
    {
      title: () => 'Первый день самый тяжёлый',
      body: () => 'И он длиной ровно в один квест.',
    },
    {
      title: () => 'Квесты ждут',
      body: (c) => (c.quest ? `Начни с «${c.quest}».` : 'Возьми самый лёгкий и закрой.'),
    },
    {
      title: () => 'Сегодня ничего не отмечено',
      body: (c) => (c.name ? `Ещё успеваешь, ${c.name}.` : 'Ещё успеваешь.'),
    },
  ],
};

/**
 * Picks a line deterministically from the user and the day.
 *
 * Not random: two runs on the same day — a retry, a manual trigger — must say
 * the same thing rather than contradict each other in the shade. Mixing the day
 * in rotates it; mixing the user in means two people do not get the same line
 * on the same evening.
 */
function pick<T>(lines: T[], userId: string, dayKey: string): T {
  let hash = 0;
  for (const char of `${userId}:${dayKey}`) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return lines[Math.abs(hash) % lines.length] as T;
}

export function reminderCopy(
  lang: Lang,
  situation: Situation,
  context: CopyContext,
  userId: string,
  dayKey: string,
): { title: string; body: string } {
  const line = pick((lang === 'ru' ? RU : EN)[situation], userId, dayKey);
  return { title: line.title(context), body: line.body(context) };
}

/** Which of the three situations this user is in tonight. */
export function situationFor(streak: number, doneToday: boolean, warnAllowed: boolean): Situation | null {
  if (doneToday) return null;
  if (streak > 0 && warnAllowed) return 'streak_warning';
  if (streak > 0) return 'reminder_streak';
  return 'reminder_cold';
}
