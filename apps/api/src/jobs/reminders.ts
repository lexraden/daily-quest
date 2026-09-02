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
import { env } from '../env.js';

const WINDOW_MINUTES = 30;

interface NotificationSettings {
  enabled?: boolean;
  reminder_time?: string;
  streak_warning?: boolean;
  timezone?: string;
  push_token?: string | null;
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
  return type === 'streak_warning'
    ? `<h2>🔥 Don't lose your ${streak}-day streak!</h2>
       <p>You haven't completed any quests today. Complete at least one to keep your streak going!</p>
       <p>Total XP: <strong>${total}</strong></p>`
    : `<h2>⚡ Your daily quests are waiting!</h2>
       <p>It's ${time} — time to level up!</p>
       <p>Current streak: <strong>${streak} days</strong></p>`;
}

async function main() {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set — cannot send reminders');
    process.exit(1);
  }
  const resend = new Resend(env.RESEND_API_KEY);

  // Only rows that opted in. The Base44 version listed every record and
  // filtered in memory, which stopped scaling the moment the table grew.
  const rows = await prisma.questData.findMany({
    where: { notificationSettings: { path: ['enabled'], equals: true } },
    select: {
      streak: true,
      totalCompleted: true,
      completionHistory: true,
      notificationSettings: true,
      user: { select: { email: true } },
    },
  });

  const results = { checked: 0, sent: 0, skipped: 0, failed: 0 };

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

    if (Math.abs(hour * 60 + minute - (remH * 60 + remM)) > WINDOW_MINUTES) {
      results.skipped++;
      continue;
    }

    const history = (row.completionHistory ?? {}) as Record<string, unknown[]>;
    const doneToday = (history[dayKey] ?? []).length > 0;
    if (doneToday) {
      results.skipped++;
      continue;
    }

    const type =
      settings.streak_warning && row.streak > 0 ? 'streak_warning' : 'reminder';
    const subject =
      type === 'streak_warning'
        ? `🔥 Your ${row.streak}-day streak is at risk!`
        : '⚡ Time for your daily quests!';

    // TODO: send a push notification instead once settings.push_token is populated.
    try {
      await resend.emails.send({
        from: env.REMINDER_FROM,
        to: row.user.email,
        subject,
        html: body(type, row.streak, row.totalCompleted, settings.reminder_time),
      });
      results.sent++;
    } catch (err) {
      // One bad address must not stop the rest of the run.
      console.error(`failed to send to ${row.user.email}:`, err);
      results.failed++;
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
