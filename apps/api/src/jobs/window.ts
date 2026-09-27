/**
 * When a daily reminder is due. Kept apart from the job itself so it can be
 * tested without pulling in the job's environment.
 */

/**
 * How long after the reminder time a run may still deliver it.
 *
 * This used to be a +/- 30 minute window measured from the distance between two
 * times, which is 61 minutes wide. Against the recommended 30-minute cron that
 * is not an edge case: a 09:00 reminder matched the 08:30, 09:00 and 09:30
 * runs, so everyone who had not yet completed a quest got three identical
 * emails every day. It also fired before the time it was announcing.
 *
 * The window is one-sided now — the reminder time has to have passed — and
 * deliberately wider than the cron period, so a late or skipped run still
 * delivers. Sending only once is the claim's job, not the window's.
 */
export const WINDOW_MINUTES = 60;

const DAY = 24 * 60;

/**
 * Minutes since a time of day, going forwards round the clock. Wrapping matters
 * near midnight: at 00:10 a 23:55 reminder is 15 minutes old, not 23 hours.
 */
export function minutesSince(now: number, reminder: number): number {
  return ((now - reminder) % DAY + DAY) % DAY;
}

/** True once the reminder time has passed and the run is still close enough. */
export function isDue(nowMinutes: number, reminderMinutes: number): boolean {
  return minutesSince(nowMinutes, reminderMinutes) < WINDOW_MINUTES;
}

/**
 * The day's reminders, and which of them is due.
 *
 * One reminder a day, at the evening time, was too little to be noticed: by
 * the time it came the day was mostly gone, and someone who had quests done by
 * then heard nothing at all. So a day has up to three, each sent only while
 * nothing has been done that day (see `situationForSlot`):
 *
 *   morning    09:00           — today's quests, before the day fills up
 *   evening    reminder_time   — the reminder the user set (20:00 by default)
 *   last_call  ~22:30          — the streak, while there is still time to save it
 *
 * The morning one is left out when the chosen time is itself in the morning,
 * and the last call when the evening one is already late: two messages an
 * hour apart saying the same thing is nagging, not reminding.
 */
export type Slot = 'morning' | 'evening' | 'last_call';

export const MORNING_MINUTES = 9 * 60;
const LAST_CALL_MINUTES = 22 * 60 + 30;
const LATEST_MINUTES = 23 * 60 + 30;

export function slotsFor(evening: number): { slot: Slot; at: number }[] {
  const slots: { slot: Slot; at: number }[] = [];
  if (evening - MORNING_MINUTES >= 3 * 60) slots.push({ slot: 'morning', at: MORNING_MINUTES });
  slots.push({ slot: 'evening', at: evening });
  const lastCall = Math.min(Math.max(LAST_CALL_MINUTES, evening + 2 * 60), LATEST_MINUTES);
  if (lastCall - evening >= 90) slots.push({ slot: 'last_call', at: lastCall });
  return slots;
}

/** The reminder due at this minute of the day, if any. */
export function dueSlot(nowMinutes: number, eveningMinutes: number): Slot | null {
  return slotsFor(eveningMinutes).find((s) => isDue(nowMinutes, s.at))?.slot ?? null;
}
