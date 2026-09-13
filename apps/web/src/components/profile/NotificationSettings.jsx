import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Clock, Flame, Shield, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t, getLang } from '@/lib/i18n';
import { toast } from 'sonner';
import { enablePush, disablePush, isSubscribed, permission } from '@/lib/push';

const TIME_OPTIONS = [];
for (let h = 6; h <= 23; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    TIME_OPTIONS.push(`${hh}:${mm}`);
  }
}

export default function NotificationSettings({ settings, onSave, theme = 'light' }) {
  const i = t();
  const ns = i.notifications || {};

  const [enabled, setEnabled] = useState(settings?.enabled || false);
  const [reminderTime, setReminderTime] = useState(settings?.reminder_time || '20:00');
  const [streakWarning, setStreakWarning] = useState(settings?.streak_warning !== false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setEnabled(settings?.enabled || false);
    setReminderTime(settings?.reminder_time || '20:00');
    setStreakWarning(settings?.streak_warning !== false);
    setDirty(false);
  }, [settings]);

  /**
   * Push lives in the browser, not in the saved settings, so it is read from
   * the device on mount rather than from the row.
   */
  const [pushState, setPushState] = useState('default');
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

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

      {/* Enable toggle */}
      <div className="flex items-center justify-between min-h-[44px]">
        <div className="flex items-center gap-2">
          {enabled
            ? <Bell className={`w-4 h-4 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
            : <BellOff className={`w-4 h-4 ${subClass}`} />
          }
          <span className={`text-sm font-medium ${labelClass}`}>{ns.enable || 'Enable reminders'}</span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleChange(setEnabled)}
        />
      </div>

      {enabled && (
        <>
          {/* Reminder time */}
          <div className="flex items-center justify-between min-h-[44px]">
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`} />
              <span className={`text-sm ${labelClass}`}>{ns.reminderTime || 'Reminder time'}</span>
            </div>
            <Select value={reminderTime} onValueChange={handleChange(setReminderTime)}>
              <SelectTrigger className={`w-24 h-9 ${theme === 'light' ? 'bg-gray-50' : 'bg-white/5 border-white/10'}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map(time => (
                  <SelectItem key={time} value={time}>{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {pushState !== 'unsupported' && pushState !== 'denied' && !pushOn && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
              theme === 'light' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>{ns.pushOffHint || 'Without this, reminders are sent by email only.'}</span>
            </div>
          )}
        </>
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