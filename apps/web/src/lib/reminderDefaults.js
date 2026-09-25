import { getLang } from '@/lib/i18n';

/**
 * Reminders are on for everyone. This is what makes that true on the server.
 *
 * The profile stopped offering a switch and a time picker, and started sending
 * `enabled: true` — but only when its Save button is pressed, and that button
 * appears only after some other setting changes. The reminders job selects on
 * the saved row alone, so anyone who never pressed Save was never reminded:
 * every new account, and every account that had once saved `enabled: false`
 * and now had no switch to turn it back on with. "Always on" was true on the
 * screen and false everywhere it mattered.
 *
 * It has to happen in the browser rather than as a default in the job, because
 * the one thing a reminder cannot guess is the user's timezone: without it,
 * 20:00 means 20:00 UTC, which is 23:00 in Moscow.
 */

export const DEFAULT_REMINDER_TIME = '20:00';

const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

/**
 * The settings with the always-on fields filled, or null when nothing needs
 * writing. Null is the common case and it matters: this runs on every load, and
 * a write per load would be a write per app open for no reason.
 *
 * What is already there is kept. A saved time or streak preference is the
 * user's, and a saved timezone is left alone too — overwriting it from whichever
 * device loaded last would flap between two phones in different zones.
 *
 * Language is the exception, because it is now changeable: the job writes in
 * the saved language, so switching the app to English left every reminder
 * arriving in Russian until something else happened to trigger a save.
 */
export function withReminderDefaults(settings) {
  const current = settings && typeof settings === 'object' ? settings : {};
  const lang = getLang();
  const timezone = current.timezone || browserTimezone();

  const needsWrite =
    current.enabled !== true ||
    !current.reminder_time ||
    (!current.timezone && timezone) ||
    current.lang !== lang;

  if (!needsWrite) return null;

  return {
    ...current,
    enabled: true,
    reminder_time: current.reminder_time || DEFAULT_REMINDER_TIME,
    streak_warning: current.streak_warning !== false,
    ...(timezone ? { timezone } : {}),
    lang,
  };
}
