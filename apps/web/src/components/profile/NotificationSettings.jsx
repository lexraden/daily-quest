import React, { useState, useEffect } from 'react';
import { Bell, Flame, Shield, Smartphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { t, getLang } from '@/lib/i18n';
import { toast } from 'sonner';
import { enablePush, disablePush, isSubscribed, permission } from '@/lib/push';
import { api } from '@/api/client';
import TelegramChannel from '@/components/profile/TelegramChannel';

export default function NotificationSettings({ settings, onSave, theme = 'light' }) {
  const i = t();
  const ns = i.notifications || {};

  // Reminders are always on: the enable toggle and the time picker were
  // removed from the UI. The saved row (or the '20:00' default) decides the
  // time, and the timezone below keeps it in the user's local evening.
  const enabled = true;
  const reminderTime = settings?.reminder_time || '20:00';
  const [streakWarning, setStreakWarning] = useState(settings?.streak_warning !== false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setStreakWarning(settings?.streak_warning !== false);
    setDirty(false);
  }, [settings]);

  /**
   * Push lives in the browser, not in the saved settings, so it is read from
   * the device on mount rather than from the row.
   */
  // Lifted out of TelegramChannel so the "email only" hint below can tell the
  // truth: with a Telegram chat connected, email is not the only thing left.
  const [telegram, setTelegram] = useState(null);

  const [pushState, setPushState] = useState('default');
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPushState(permission());
    isSubscribed().then((on) => {
      if (!cancelled) setPushOn(on);
    });
    return () => { cancelled = true; };
  }, []);

  const togglePush = async (next) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (next) {
        const { ok, reason } = await enablePush();
        setPushState(permission());
        setPushOn(ok);
        if (!ok) {
          toast.error(
            reason === 'server_disabled'
              ? ns.pushServerOff || 'Notifications are not configured on the server yet'
              : reason === 'denied'
                ? ns.pushDenied || 'Blocked — allow notifications in site settings'
                : ns.pushFailed || 'Could not turn that on',
          );
        }
      } else {
        await disablePush();
        setPushOn(false);
      }
    } catch {
      toast.error(ns.pushFailed || 'Could not turn that on');
    } finally {
      setPushBusy(false);
    }
  };

  /**
   * Proves it, rather than asking the user to wait until evening and hope.
   *
   * The two numbers the server returns are the two failures that look
   * identical from here: no devices means the permission never produced a
   * subscription on this browser, and devices with nothing delivered means the
   * push service refused the ones we have — usually a subscription that died
   * when the browser data was cleared, and turning the switch off and on again
   * replaces it.
   */
  const sendTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const { devices, delivered, expired = 0, statuses = [] } = await api.push.test();

      if (delivered > 0) {
        toast.success(ns.pushTestSent || 'Sent — it should appear in a moment');
      } else if (devices === 0) {
        toast.error(ns.pushTestNoDevices || 'This device is not subscribed yet');
      } else if (expired > 0) {
        // The rows are already gone, so turning the switch off and on makes a
        // fresh one rather than reviving a corpse.
        toast.error(ns.pushTestExpired || 'That subscription had expired — turn the switch off and on again');
      } else if (statuses.some((s) => s === 401 || s === 403)) {
        /**
         * Not the user's problem and not fixable from here: the push service
         * rejected our VAPID credentials, which means the keys on the server
         * are wrong or mismatched. Saying "resubscribe" would send someone
         * round a loop that cannot end.
         */
        toast.error(ns.pushTestVapid || 'The server’s push keys are being rejected — this needs fixing on the server');
      } else {
        toast.error(
          (ns.pushTestFailed || 'The push service refused it') +
            (statuses.length ? ` (${statuses.join(', ')})` : ''),
        );
      }
    } catch (error) {
      toast.error(error?.message || ns.pushTestFailed || 'Could not send it');
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (setter) => (val) => {
    setter(val);
    setDirty(true);
  };

  const handleSave = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    onSave({
      enabled,
      reminder_time: reminderTime,
      streak_warning: streakWarning,
      timezone,
      // The reminders job runs with no browser, so the language has to be
      // recorded here or every notification goes out in the default one.
      lang: getLang(),
      push_token: settings?.push_token || null,
    });
    setDirty(false);
  };

  const cardClass = theme === 'light'
    ? 'bg-white border border-gray-200 shadow-sm'
    : 'bg-[#1e2836] border border-white/10';

  const labelClass = theme === 'light' ? 'text-gray-900' : 'text-white';
  const subClass = theme === 'light' ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className={`rounded-2xl p-4 space-y-4 ${cardClass}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-xl ${theme === 'light' ? 'bg-purple-50' : 'bg-purple-500/10'}`}>
          <Bell className={`w-5 h-5 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
        </div>
        <div>
          <h3 className={`text-sm font-bold ${labelClass}`}>{ns.title || 'Notifications'}</h3>
          <p className={`text-xs ${subClass}`}>{ns.subtitle || 'Reminder settings'}</p>
        </div>
      </div>

      {/* Streak warning */}
      <div className="flex items-center justify-between min-h-[44px]">
        <div className="flex items-center gap-2">
          <Flame className={`w-4 h-4 text-orange-500`} />
          <div>
            <span className={`text-sm ${labelClass}`}>{ns.streakWarning || 'Streak warning'}</span>
            <p className={`text-xs ${subClass}`}>{ns.streakWarningDesc || 'Alert before losing streak'}</p>
          </div>
        </div>
        <Switch
          checked={streakWarning}
          onCheckedChange={handleChange(setStreakWarning)}
        />
      </div>

      {/*
        Notifications on this device.
        Per device rather than per account: permission belongs to the
        browser, so a phone and a laptop each answer for themselves, and
        turning it off here leaves the other one alone.
      */}
      <div className="flex items-center justify-between min-h-[44px]">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-500" />
          <div>
            <span className={`text-sm ${labelClass}`}>{ns.pushOnDevice || 'Notify this device'}</span>
            <p className={`text-xs ${subClass}`}>
              {pushState === 'unsupported'
                ? ns.pushUnsupported || 'This browser cannot show notifications'
                : pushState === 'denied'
                  ? ns.pushDenied || 'Blocked — allow notifications in site settings'
                  : ns.pushOnDeviceDesc || 'Reminders arrive with the app closed'}
            </p>
          </div>
        </div>
        <Switch
          checked={pushOn}
          disabled={pushBusy || pushState === 'unsupported' || pushState === 'denied'}
          onCheckedChange={togglePush}
          aria-label={ns.pushOnDevice || 'Notify this device'}
        />
      </div>

      {/*
        A third channel, and the one the job tries first: connecting it is a
        deliberate act, where a push permission is a prompt someone tapped
        through once. Renders nothing when no bot is configured.
      */}
      <TelegramChannel theme={theme} onState={setTelegram} />

      {/* Proves push works, rather than asking the user to wait until evening. */}
      {pushOn && (
        <Button
          onClick={sendTest}
          disabled={testing}
          variant="outline"
          className={`w-full min-h-[44px] ${theme === 'light' ? 'border-gray-300' : 'border-white/20'}`}
        >
          <Send className="w-4 h-4 mr-2" />
          {testing ? ns.pushTesting || 'Sending…' : ns.pushTest || 'Send a test notification'}
        </Button>
      )}

      {pushState !== 'unsupported' && pushState !== 'denied' && !pushOn && !telegram?.connected && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
          theme === 'light' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>{ns.pushOffHint || 'Without this, reminders are sent by email only.'}</span>
        </div>
      )}

      {/* Save button */}
      {dirty && (
        <Button
          onClick={handleSave}
          className="w-full min-h-[44px] bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
        >
          {ns.save || 'Save settings'}
        </Button>
      )}
    </div>
  );
}
