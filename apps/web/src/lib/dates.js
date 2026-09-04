/**
 * Day keys — "YYYY-MM-DD" in the viewer's own timezone.
 *
 * These were built with `toISOString()`, which is UTC. Anywhere east of
 * Greenwich that rolls the day over early: at UTC+4 the key flipped at 04:00
 * local time, so a meal, a mood check-in or calories logged just after
 * midnight were filed under the previous day. It is not only cosmetic —
 * DailyTracker compares `last_visit_date` against today's key to decide
 * whether a new day started, so a wrong key skews the streak as well.
 *
 * Reading the local date parts gives the device's own day directly, with no
 * offset arithmetic to get wrong across DST.
 */
export function dayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today, in the viewer's timezone. */
export function todayKey() {
  return dayKey();
}
