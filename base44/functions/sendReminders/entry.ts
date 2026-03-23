/**
 * Send quest reminders to users.
 * Called by scheduled automation every 30 minutes.
 * 
 * Currently sends email reminders.
 * TODO: Replace with push notifications when available.
 * 
 * The notification_settings object on UserQuestData:
 * {
 *   enabled: boolean,
 *   reminder_time: "HH:MM",     // user's local time
 *   streak_warning: boolean,     // warn if streak at risk
 *   timezone: "Europe/Moscow",   // user's timezone
 *   push_token: string | null,   // for future push notifications
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This function is called by automation (service role)
    const allUserData = await base44.asServiceRole.entities.UserQuestData.list();

    const now = new Date();
    const results = { checked: 0, sent: 0, skipped: 0 };

    for (const userData of allUserData) {
      results.checked++;
      const settings = userData.notification_settings;

      // Skip users without notification settings or disabled
      if (!settings?.enabled || !settings.reminder_time) {
        results.skipped++;
        continue;
      }

      // Calculate user's current local time
      const userTz = settings.timezone || 'UTC';
      let userNow;
      try {
        userNow = new Date(now.toLocaleString('en-US', { timeZone: userTz }));
      } catch {
        userNow = now;
      }

      const userHour = userNow.getHours();
      const userMin = userNow.getMinutes();
      const userTimeStr = `${String(userHour).padStart(2, '0')}:${String(userMin).padStart(2, '0')}`;

      // Check if current 30-min window matches reminder time
      const [remH, remM] = settings.reminder_time.split(':').map(Number);
      const remMinutes = remH * 60 + remM;
      const nowMinutes = userHour * 60 + userMin;
      const diff = Math.abs(nowMinutes - remMinutes);

      if (diff > 30) {
        results.skipped++;
        continue;
      }

      // Check if user already completed quests today
      const todayKey = `${userNow.getFullYear()}-${String(userNow.getMonth() + 1).padStart(2, '0')}-${String(userNow.getDate()).padStart(2, '0')}`;
      const todayHistory = userData.completion_history?.[todayKey] || [];
      const hasCompletedToday = todayHistory.length > 0;

      // Determine notification type
      let shouldNotify = false;
      let notificationType = 'reminder'; // 'reminder' or 'streak_warning'

      if (!hasCompletedToday) {
        shouldNotify = true;

        // If user has a streak and hasn't done anything today, warn about streak
        if (settings.streak_warning && userData.streak > 0) {
          notificationType = 'streak_warning';
        }
      }

      if (!shouldNotify) {
        results.skipped++;
        continue;
      }

      // === NOTIFICATION DISPATCH ===
      // 
      // TODO: When push notifications become available, add push sending here:
      // 
      // if (settings.push_token) {
      //   await sendPushNotification({
      //     token: settings.push_token,
      //     title: notificationType === 'streak_warning' 
      //       ? `🔥 Your ${userData.streak}-day streak is at risk!`
      //       : '⚡ Time for your daily quests!',
      //     body: notificationType === 'streak_warning'
      //       ? 'Complete at least one quest to keep your streak going!'
      //       : 'Your quests are waiting. Level up today!',
      //   });
      // }
      //
      // For now, send via email as fallback:

      const userEmail = userData.created_by;
      if (!userEmail) {
        results.skipped++;
        continue;
      }

      const subject = notificationType === 'streak_warning'
        ? `🔥 Your ${userData.streak}-day streak is at risk!`
        : '⚡ Time for your daily quests!';

      const body = notificationType === 'streak_warning'
        ? `<h2>🔥 Don't lose your ${userData.streak}-day streak!</h2>
           <p>You haven't completed any quests today. Complete at least one to keep your streak going!</p>
           <p>Total XP: <strong>${userData.total_completed || 0}</strong></p>`
        : `<h2>⚡ Your daily quests are waiting!</h2>
           <p>It's ${settings.reminder_time} — time to level up!</p>
           <p>Current streak: <strong>${userData.streak || 0} days</strong></p>`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: userEmail,
        subject,
        body,
        from_name: 'Daily Quests',
      });

      results.sent++;
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('sendReminders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});