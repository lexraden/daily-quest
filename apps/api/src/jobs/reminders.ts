/**
 * Daily quest reminders. Ported from the Base44 sendReminders function, keeping
 * its timezone window and streak-warning logic; the delivery swapped from
 * Base44's SendEmail to Resend, and the full-table scan became a filtered query.
 *
 * Runs as its own Railway service on a cron schedule and exits when done.
 *
 * notification_settings on quest_data:
 *   { enabled, reminder_time: "HH:MM", streak_warning, timezone, push_token }
 */

import { Resend } from 'resend';
import { prisma } from '../db.js';
import { jobEnv } from '../env.job.js';
import { isDue } from './window.js';
import { configurePush, notifyUser } from '../lib/push.js';
import { configureTelegram, notifyUser as notifyTelegram } from '../lib/telegram.js';
import { reminderCopy, situationFor, firstName } from './copy.js';
import { sanitizeQuestData } from '../lib/questData.js';
import { record as recordNotification } from '../lib/notifications.js';

/**
 * A quest worth naming in the reminder.
 *
 * The easiest one there is, because the line exists to make starting feel
 * small. Nothing is returned when the set is empty, and the copy has a form
 * that works without it.
 */
function undoneQuest(questData: unknown): string | undefined {
  const set = sanitizeQuestData(questData);
  const easiest = Object.values(set)
    .flat()
    .sort((a, b) => a.level - b.level)[0];
  return easiest?.name || undefined;
}

interface NotificationSettings {
  enabled?: boolean;
  reminder_time?: string;
  streak_warning?: boolean;
  timezone?: string;
  push_token?: string | null;
  // The app language at the time the settings were saved. The job has no other
  // way to know which language to write in.
  lang?: string;
}

/** Wall-clock hour and minute in the user's own timezone. */
function localTime(tz: string): { hour: number; minute: number; dayKey: string } {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    // Intl renders midnight as "24" in some ICU versions.
    const hour = Number(get('hour')) % 24;
    return {
      hour,
      minute: Number(get('minute')),
      dayKey: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    return {
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      dayKey: now.toISOString().slice(0, 10),
    };
  }
}


function body(type: 'reminder' | 'streak_warning', streak: number, total: number, time: string) {
  const cta = `<p><a href="${jobEnv.APP_ORIGIN}">Open DailyQ</a></p>`;
  return type === 'streak_warning'
    ? `<h2>🔥 Don't lose your ${streak}-day streak!</h2>
       <p>You haven't completed any quests today. Complete at least one to keep your streak going!</p>
       <p>Total XP: <strong>${total}</strong></p>${cta}`
    : `<h2>⚡ Your daily quests are waiting!</h2>
       <p>It's ${time} — time to level up!</p>
       <p>Current streak: <strong>${streak} days</strong></p>${cta}`;
}

async function main() {
  const resend = new Resend(jobEnv.RESEND_API_KEY);

  // Only rows that opted in. The Base44 version listed every record and
  // filtered in memory, which stopped scaling the moment the table grew.
  const rows = await prisma.questData.findMany({
    where: { notificationSettings: { path: ['enabled'], equals: true } },
    select: {
      userId: true,
      streak: true,
      totalCompleted: true,
      completionHistory: true,
      notificationSettings: true,
      // The name is what makes a reminder read as addressed to someone rather
      // than broadcast, and the quests let it name what is actually waiting.
      questData: true,
      user: { select: { email: true, fullName: true } },
    },
  });

  // Without a VAPID pair notifyUser is a no-op and every reminder goes by
  // email, which is exactly how this ran before push existed.
  configurePush(
    jobEnv.VAPID_PUBLIC_KEY && jobEnv.VAPID_PRIVATE_KEY
      ? {
          publicKey: jobEnv.VAPID_PUBLIC_KEY,
          privateKey: jobEnv.VAPID_PRIVATE_KEY,
          subject: jobEnv.VAPID_SUBJECT,
        }
      : null,
  );

  configureTelegram(
    jobEnv.TELEGRAM_BOT_TOKEN && jobEnv.TELEGRAM_BOT_USERNAME
      ? {
          token: jobEnv.TELEGRAM_BOT_TOKEN,
          username: jobEnv.TELEGRAM_BOT_USERNAME,
          apiBase: jobEnv.TELEGRAM_API_BASE || undefined,
        }
      : null,
  );

  const results = { checked: 0, sent: 0, telegrammed: 0, pushed: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    results.checked++;
    const settings = (row.notificationSettings ?? {}) as NotificationSettings;

    if (!settings.reminder_time || !row.user.email) {
      results.skipped++;
      continue;
    }

    const { hour, minute, dayKey } = localTime(settings.timezone || 'UTC');
    const [remH, remM] = settings.reminder_time.split(':').map(Number);
    if (remH === undefined || remM === undefined || Number.isNaN(remH) || Number.isNaN(remM)) {
      results.skipped++;
      continue;
    }

    if (!isDue(hour * 60 + minute, remH * 60 + remM)) {
      results.skipped++;
      continue;
    }

    const history = (row.completionHistory ?? {}) as Record<string, unknown[]>;
    const doneToday = (history[dayKey] ?? []).length > 0;
    if (doneToday) {
      results.skipped++;
      continue;
    }

    const situation = situationFor(row.streak, doneToday, settings.streak_warning !== false);
    if (!situation) {
      results.skipped++;
      continue;
    }

    const copy = reminderCopy(
      settings.lang === 'en' ? 'en' : 'ru',
      situation,
      {
        name: firstName(row.user.fullName),
        streak: row.streak,
        quest: undoneQuest(row.questData),
      },
      row.userId,
      dayKey,
    );

    // The email keeps its old shape; only the subject follows the new copy, so
    // the two channels at least say the same thing.
    const type = situation === 'streak_warning' ? 'streak_warning' : 'reminder';
    const subject = copy.title;

    // Claim the day before sending, not after. The predicate is the whole
    // mechanism: `IS DISTINCT FROM` matches a row whose last reminder is null or
    // some other day, so whichever run gets there first is the only one that
    // sends. A retry after a crash, a manual trigger running beside the
    // schedule, or a second replica all update nothing and move on.
    //
    // Recording after sending instead would be the wrong way round: a crash
    // between the two leaves no record and the retry emails everyone again.
    // Raw SQL for `IS DISTINCT FROM`: Prisma's `NOT: { lastReminderDay: day }`
    // compiles to `NOT (last_reminder_day = $day)`, which is NULL — and so no
    // match — for a row that has never been claimed. That is every row on the
    // first run, so the filter would have quietly claimed nothing and nobody
    // would ever receive a reminder again.
    const claimed = await prisma.$executeRaw`
      UPDATE quest_data
         SET last_reminder_day = ${dayKey}, updated_at = now()
       WHERE user_id = ${row.userId}
         AND last_reminder_day IS DISTINCT FROM ${dayKey}`;
    if (claimed === 0) {
      results.skipped++;
      continue;
    }

    /**
     * The log first, and unconditionally.
     *
     * This is the channel that cannot be missed: a phone that was off, a
     * permission never granted, an email in a promotions tab — the reminder
     * still exists in the app the next time it is opened, which is the only
     * place the user is certain to look. Keyed on the day, so the claim above
     * and this agree: one line per user per day whatever happens below.
     */
    await recordNotification(row.userId, {
      kind: situation === 'streak_warning' ? 'streak_warning' : 'reminder',
      title: copy.title,
      body: copy.body,
      data: { streak: row.streak },
      dedupeKey: `reminder-${dayKey}`,
    });

    /**
     * Then one channel, not all of them: whichever is reachable first wins, and
     * the rest are skipped. Two notifications for one reminder is nagging, and
     * nagging is how the permission gets revoked.
     *
     * Telegram leads because connecting it is a deliberate act — a user went to
     * their profile and linked an account — where a push permission is a prompt
     * someone tapped through once. Push comes next because a notification on the
     * phone is what a streak reminder is for. Email is last: an email about a
     * habit tracker is read hours later if at all, but a user with neither of
     * the other two would otherwise hear nothing.
     */
    const telegrammed = await notifyTelegram(row.userId, {
      title: copy.title,
      body: copy.body,
      url: jobEnv.APP_ORIGIN,
    }).catch((err) => {
      // A Telegram outage must not cost the other two channels.
      console.error(`telegram failed for ${row.userId}:`, err);
      return false;
    });

    if (telegrammed) {
      results.telegrammed++;
      results.sent++;
      continue;
    }

    const pushed = await notifyUser(row.userId, {
      title: copy.title,
      body: copy.body,
      url: '/',
      // One tag for all of them: a reminder that replaced yesterday's is
      // right, two stacked in the shade is nagging.
      tag: 'dailyq-reminder',
    }).catch((err) => {
      // A push service outage must not cost the email as well.
      console.error(`push failed for ${row.userId}:`, err);
      return 0;
    });

    if (pushed > 0) {
      results.pushed++;
      results.sent++;
      continue;
    }

    let failure: unknown = null;
    try {
      // Resend reports API failures in the result rather than by throwing, so
      // the catch below never saw them: a rejected key counted every address as
      // sent, and the run logged a clean summary while delivering nothing.
      const { error } = await resend.emails.send({
        from: jobEnv.REMINDER_FROM,
        to: row.user.email,
        subject,
        html: body(type, row.streak, row.totalCompleted, settings.reminder_time),
      });
      if (error) failure = error;
    } catch (err) {
      // A thrown error still means the transport itself failed.
      failure = err;
    }

    if (!failure) {
      results.sent++;
    } else {
      // One bad address must not stop the rest of the run.
      console.error(`failed to send to ${row.user.email}:`, failure);
      results.failed++;

      // Nothing was delivered, so give the day back and let a later run try
      // again — a provider outage should not cost everyone their reminder. The
      // residual risk is a send that succeeded but reported failure, which
      // would send twice; that is rarer than an outage, and one duplicate is a
      // better trade than silently dropping every reminder for a day.
      await prisma.questData
        .updateMany({
          where: { userId: row.userId, lastReminderDay: dayKey },
          data: { lastReminderDay: null },
        })
        .catch(() => {});
    }
  }

  console.log('reminders run complete', results);
  await prisma.$disconnect();
  process.exit(results.failed > 0 && results.sent === 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('reminders run failed', err);
  await prisma.$disconnect();
  process.exit(1);
});
