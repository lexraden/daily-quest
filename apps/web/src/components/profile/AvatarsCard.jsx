import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { t } from '@/lib/i18n';
import { LEVEL_DEFS, levelName, avatarSrc, levelFromChoice } from '@/lib/levels';

/**
 * The avatars earned by levelling up, and which one is being worn.
 *
 * The server is what actually decides whether a choice is allowed — see the
 * check in PATCH /auth/me — so the lock here is presentation. Tapping a locked
 * one says what it costs rather than sending a request that would be refused.
 */
export default function AvatarsCard({ user, earnedLevel = 1, theme, onUserUpdate }) {
  const i = t();
  const copy = i.avatars || {};
  const light = theme === 'light';
  const [saving, setSaving] = useState(null);

  const worn = levelFromChoice(user?.avatar_choice);
  const usingPhoto = Boolean(user?.avatar_url);
  const unlocked = LEVEL_DEFS.filter((d) => d.level <= earnedLevel).length;

  const choose = async (level) => {
    if (saving) return;
    setSaving(level);
    try {
      // Picking an avatar clears the uploaded photo's claim on the slot;
      // without this the choice would save and nothing would appear to change,
      // because a photo always wins in resolveAvatar.
      const updated = await api.auth.updateMe({
        avatar_choice: `level-${level}`,
        ...(usingPhoto ? { avatar_url: null } : {}),
      });
      onUserUpdate?.({ ...user, ...updated });
    } catch (error) {
      toast.error(error?.message || i.profilePage?.nameError || 'Could not save that');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className={`rounded-2xl p-4 border ${
        light ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className={`text-base font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
          🎭 {copy.title || 'Avatars'}
        </h3>
        <span className={`text-xs ${light ? 'text-gray-500' : 'text-gray-500'}`}>
          {(copy.unlockedCount || '{have} of {total}')
            .replace('{have}', unlocked)
            .replace('{total}', LEVEL_DEFS.length)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-3">
        {LEVEL_DEFS.map((def) => {
          const isUnlocked = def.level <= earnedLevel;
          const isWorn = !usingPhoto && worn === def.level;
          const art = avatarSrc(def.level);

          return (
            <button
              key={def.level}
              type="button"
              disabled={!isUnlocked || saving === def.level}
              onClick={() =>
                isUnlocked
                  ? choose(def.level)
                  : toast((copy.locked || 'Unlocks at level {level}').replace('{level}', def.level))
              }
              aria-label={isUnlocked ? levelName(def.level) : `${levelName(def.level)} — locked`}
              className="flex flex-col items-center gap-1.5 min-h-[44px]"
            >
              <span
                className="relative aspect-square w-full rounded-full flex items-center justify-center overflow-hidden"
                style={
                  isUnlocked
                    ? {
                        border: `${isWorn ? 3 : 2}px solid ${isWorn ? '#fff' : def.color}`,
                        background: `linear-gradient(135deg, ${def.color}, ${def.color}33)`,
                        boxShadow: isWorn ? `0 0 16px ${def.color}99` : 'none',
                      }
                    : { border: `2px dashed ${light ? '#d1d5db' : '#2d3748'}` }
                }
              >
                {isUnlocked ? (
                  art ? (
                    <img src={art} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">{def.icon}</span>
                  )
                ) : (
                  <Lock className={`w-4 h-4 ${light ? 'text-gray-400' : 'text-gray-600'}`} />
                )}

                {isWorn && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </span>

              <span
                className={`text-[9px] leading-tight text-center ${
                  isUnlocked
                    ? light
                      ? 'text-gray-600'
                      : 'text-gray-400'
                    : light
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}
              >
                {isUnlocked
                  ? levelName(def.level)
                  : (copy.lockedAt || 'Lvl {level}').replace('{level}', def.level)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
