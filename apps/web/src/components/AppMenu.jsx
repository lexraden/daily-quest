import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Menu, X, Sun, Moon, Languages, Volume2, VolumeX, Bell, BellOff, RefreshCw, Check, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { setTheme } from '@/lib/theme';
import { t, getLang, setLang } from '@/lib/i18n';
import { isMuted, setMuted, playSfx } from '@/lib/sfx';
import { enablePush, disablePush, isSubscribed, permission, PUSH_CHANGED } from '@/lib/push';
import { checkForUpdate, applyUpdate, currentBuild, shortBuild } from '@/lib/appVersion';

/**
 * The app's own settings, one tap from every tab.
 *
 * The header used to carry a button per setting, and each new one cost every
 * screen a little more width: theme on all three tabs, language on the
 * profile only because a third button everywhere was too many. Settings are
 * changed rarely, so they share one button and open together. The last row
 * is the version and an update check, the same one the profile has. The bell stays
 * outside the menu — it carries a live count, and a count hidden behind a tap
 * is not a count.
 *
 * Each row changes one thing and shows its current value, so opening the menu
 * also answers "which theme / language / sound am I on, and does this phone
 * get notifications".
 */
export default function AppMenu({ theme }) {
  const i = t();
  const m = i.menu || {};
  const light = theme === 'light';
  const reduce = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => !isMuted());
  // This device's push subscription: the same one the profile switch drives.
  const [pushOn, setPushOn] = useState(false);
  const [pushState, setPushState] = useState(() => permission());
  const [pushBusy, setPushBusy] = useState(false);
  // idle → checking → current | update | unknown, as on the profile.
  const [update, setUpdate] = useState('idle');
  const [serverBuild, setServerBuild] = useState(null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const lang = getLang();

  /**
   * Escape or a tap anywhere else closes it; Escape also hands focus back to
   * the button.
   *
   * A listener rather than a full-screen backdrop: the header sits inside the
   * page transition's transformed container, and a transformed ancestor turns
   * `position: fixed` into "fixed to that container", so a backdrop covered
   * the wrong area and sat on top of the button that should close it.
   */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open]);

  // The switch elsewhere (Profile → Sound) and this one show the same value.
  useEffect(() => {
    const sync = () => setSoundOn(!isMuted());
    window.addEventListener('dailyq-sound-changed', sync);
    return () => window.removeEventListener('dailyq-sound-changed', sync);
  }, []);

  // Read when the menu opens, and whenever the profile's switch changes it.
  useEffect(() => {
    if (!open) return undefined;
    // An earlier "up to date" is only true of the moment it was asked, and it
    // hides the button; each opening starts from a fresh check. A waiting
    // update stays offered.
    setUpdate((u) => (u === 'current' || u === 'unknown' ? 'idle' : u));
    let cancelled = false;
    const read = () => {
      setPushState(permission());
      isSubscribed().then((on) => !cancelled && setPushOn(on));
    };
    read();
    window.addEventListener(PUSH_CHANGED, read);
    return () => {
      cancelled = true;
      window.removeEventListener(PUSH_CHANGED, read);
    };
  }, [open]);

  const togglePush = async (next) => {
    if (pushBusy) return;
    const ns = i.notifications || {};
    setPushBusy(true);
    setPushOn(next);
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
      setPushOn(!next);
      toast.error(ns.pushFailed || 'Could not turn that on');
    } finally {
      setPushBusy(false);
    }
  };

  const checkUpdate = async () => {
    setUpdate('checking');
    const { status, commit } = await checkForUpdate();
    setServerBuild(commit);
    setUpdate(status);
  };

  const toggleSound = (next) => {
    setSoundOn(next);
    setMuted(!next);
    // The only way to hear what the switch does without earning a level.
    if (next) playSfx('levelUp');
  };

  const chooseLanguage = (next) => {
    // setLang is false when nothing changes or the choice could not be stored;
    // copy is read at module scope in places, so a change needs a reload.
    if (setLang(next)) window.location.reload();
  };

  // 48px, the same on every tab. The icon size is set on the button because
  // the shared Button forces `size-4` onto any svg inside it.
  const round = `h-12 w-12 shrink-0 rounded-full [&_svg]:size-6 ${
    light ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'
  }`;
  const ink = light ? 'text-gray-900' : 'text-white';
  const muted = light ? 'text-gray-500' : 'text-gray-400';

  /** Two options side by side, the current one filled. */
  const segmented = (options, value, onChange, label) => (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex rounded-xl p-0.5 ${light ? 'bg-gray-100' : 'bg-white/5'}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? light
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'bg-white/15 text-white'
                : muted
            }`}
          >
            {o.icon && <o.icon className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );

  const row = (Icon, title, control) => (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${muted}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {control}
    </div>
  );

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        variant="ghost"
        size="icon"
        aria-label={m.title || 'Menu'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={round}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <AnimatePresence>
        {open && (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-label={m.title || 'Menu'}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
              style={{ transformOrigin: 'top right' }}
              className={`absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl border p-4 shadow-xl ${
                light ? 'border-gray-200 bg-white' : 'border-white/10 bg-[#1e2836]'
              }`}
            >
              {row(
                light ? Sun : Moon,
                m.theme || 'Theme',
                segmented(
                  [
                    { value: 'light', label: m.light || 'Light', icon: Sun },
                    { value: 'dark', label: m.dark || 'Dark', icon: Moon },
                  ],
                  theme,
                  setTheme,
                  m.theme || 'Theme',
                ),
              )}

              {row(
                Languages,
                i.language?.title || 'Language',
                segmented(
                  [
                    { value: 'ru', label: 'Русский' },
                    { value: 'en', label: 'English' },
                  ],
                  lang,
                  chooseLanguage,
                  i.language?.title || 'Language',
                ),
              )}

              <label className="flex cursor-pointer items-center gap-3">
                {soundOn ? (
                  <Volume2 className={`h-5 w-5 ${light ? 'text-purple-600' : 'text-purple-400'}`} />
                ) : (
                  <VolumeX className="h-5 w-5 text-gray-500" />
                )}
                <span className={`flex-1 text-sm font-semibold ${ink}`}>{i.sound?.title || 'Sound effects'}</span>
                <Switch checked={soundOn} onCheckedChange={toggleSound} aria-label={i.sound?.title || 'Sound effects'} />
              </label>

              {/*
                Unsupported or blocked is not something the switch can fix, so
                it is shown off and disabled with the reason underneath.
              */}
              <label className={`flex items-center gap-3 ${pushState === 'unsupported' || pushState === 'denied' ? '' : 'cursor-pointer'}`}>
                {pushOn ? (
                  <Bell className={`h-5 w-5 ${light ? 'text-purple-600' : 'text-purple-400'}`} />
                ) : (
                  <BellOff className="h-5 w-5 text-gray-500" />
                )}
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold ${ink}`}>{m.notifications || 'Notifications'}</span>
                  <span className={`block text-xs ${muted}`}>
                    {pushState === 'unsupported'
                      ? i.notifications?.pushUnsupported || 'This browser cannot show notifications'
                      : pushState === 'denied'
                        ? i.notifications?.pushDenied || 'Blocked — allow notifications in site settings'
                        : m.notificationsHint || 'On this device'}
                  </span>
                </span>
                <Switch
                  checked={pushOn}
                  onCheckedChange={togglePush}
                  disabled={pushBusy || pushState === 'unsupported' || pushState === 'denied'}
                  aria-label={m.notifications || 'Notifications'}
                />
              </label>

              {/*
                Same shape as the rows above: icon, what is true, the build it
                is true of, and the one action that applies.
              */}
              <div className="flex items-center gap-3">
                {update === 'current' ? (
                  <Check className={`h-5 w-5 shrink-0 ${light ? 'text-green-600' : 'text-green-400'}`} />
                ) : update === 'update' ? (
                  <Download className={`h-5 w-5 shrink-0 ${light ? 'text-purple-600' : 'text-purple-400'}`} />
                ) : (
                  <RefreshCw className={`h-5 w-5 shrink-0 text-gray-500 ${update === 'checking' ? 'animate-spin' : ''}`} />
                )}
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold ${ink}`}>
                    {{
                      idle: m.update || 'Updates',
                      checking: i.update?.checking || 'Checking…',
                      current: m.upToDate || 'Up to date',
                      unknown: i.update?.unknown || 'Could not check',
                      update: m.updateReady || 'New version',
                    }[update]}
                  </span>
                  <span
                    className={`block truncate whitespace-nowrap font-mono ${
                      update === 'update' ? 'text-[11px]' : 'text-xs'
                    } ${muted}`}
                  >
                    {/* With an update waiting, the two builds say more than the word. */}
                    {update === 'update' && serverBuild
                      ? `${shortBuild(currentBuild())} → ${shortBuild(serverBuild)}`
                      : `${i.update?.version || 'Version'} ${shortBuild(currentBuild())}`}
                  </span>
                </span>
                {/* Nothing to do once it is current, so no button to do it with. */}
                {update !== 'current' && (
                <Button
                  size="sm"
                  variant={update === 'update' ? 'default' : 'outline'}
                  onClick={update === 'update' ? applyUpdate : checkUpdate}
                  disabled={update === 'checking'}
                  className={`h-8 shrink-0 rounded-xl px-3 text-xs font-semibold ${
                    update === 'update'
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:from-purple-700 hover:to-cyan-700'
                      : light
                        ? 'border-gray-300'
                        : 'border-white/20'
                  }`}
                >
                  {update === 'update' ? i.update?.reload || 'Update' : i.update?.checkShort || 'Check'}
                </Button>
                )}
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
