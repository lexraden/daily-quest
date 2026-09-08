/**
 * When a daily reminder is due. Kept apart from the job itself so it can be
 * tested without pulling in the job's environment or its Resend client.
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
