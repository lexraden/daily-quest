import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/i18n';
import { isMuted, setMuted, playSfx } from '@/lib/sfx';

/**
 * The one switch for every sound the app makes.
 *
 * The preference is per device rather than per account: whether a phone should
 * make noise depends on the phone, not on who is signed in, and it has to work
 * before the first save. It lives in localStorage, which sfx.js owns.
 *
 * Turning sound on plays the level-up flourish straight away — it is the only
 * way to hear what the switch does without earning a level for it.
 */
export default function SoundSettings({ theme }) {
  const i = t();
  const copy = i.sound || {};
  const light = theme === 'light';
  const [on, setOn] = useState(() => !isMuted());

  const toggle = (next) => {
    setOn(next);
    setMuted(!next);
    if (next) playSfx('levelUp');
  };

  return (
    <div
      className={`rounded-2xl p-4 border ${
        light ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'
      }`}
    >
      <label className="flex items-center gap-3 cursor-pointer">
        {on ? (
          <Volume2 className={`w-5 h-5 ${light ? 'text-purple-600' : 'text-purple-400'}`} />
        ) : (
          <VolumeX className="w-5 h-5 text-gray-500" />
        )}

        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-semibold ${light ? 'text-gray-900' : 'text-white'}`}>
            {copy.title || 'Sound effects'}
          </span>
          <span className="block text-xs text-gray-500">
            {copy.hint || 'Quests, streaks and level-ups'}
          </span>
        </span>

        <Switch checked={on} onCheckedChange={toggle} aria-label={copy.title || 'Sound effects'} />
      </label>
    </div>
  );
}
