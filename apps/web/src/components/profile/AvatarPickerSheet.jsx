import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Check, Camera, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { t } from '@/lib/i18n';
import { LEVEL_DEFS, levelName, avatarSrc, levelFromChoice } from '@/lib/levels';

/**
 * The avatars earned by levelling up, opened by tapping the profile picture.
 *
 * It lives behind that tap rather than in a card of its own: for most of the
 * first week there is exactly one avatar to choose from, and a permanent row
 * of nine padlocks is not worth the space on the profile page.
 *
 * The server is what actually decides whether a choice is allowed — see the
 * check in PATCH /auth/me — so the padlock here is presentation. Tapping a
 * locked one says what it costs instead of sending a request that would be
 * refused.
 */
export default function AvatarPickerSheet({
  user,
  earnedLevel = 1,
  theme,
  onUserUpdate,
  onPickPhoto,
  isUploadingPhoto = false,
  onClose,
}) {
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
      onClose?.();
    } catch (error) {
      toast.error(error?.message || i.profilePage?.nameError || 'Could not save that');
    } finally {
      setSaving(null);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-md rounded-t-3xl border-t px-5 pt-4 ${
            light ? 'bg-white border-gray-200' : 'bg-[#1b2433] border-white/10'
          }`}
          style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center justify-between">
            <h3 className={`text-base font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
              🎭 {copy.title || 'Avatars'}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {(copy.unlockedCount || '{have} of {total}')
                  .replace('{have}', unlocked)
                  .replace('{total}', LEVEL_DEFS.length)}
              </span>
              <button
                onClick={onClose}
                aria-label={i.common?.close || 'Close'}
                className="min-w-[44px] min-h-[44px] -mr-3 flex items-center justify-center text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-3">
            {LEVEL_DEFS.map((def) => {
              const isUnlocked = def.level <= earnedLevel;
              const isWorn = !usingPhoto && worn === def.level;
              const art = avatarSrc(def.level);

              return (
                <button
                  key={def.level}
                  type="button"
                  disabled={saving === def.level}
                  onClick={() =>
                    isUnlocked
                      ? choose(def.level)
                      : toast(
                          (copy.locked || 'Unlocks at level {level}').replace('{level}', def.level),
                        )
                  }
                  aria-label={
                    isUnlocked ? levelName(def.level) : `${levelName(def.level)} — locked`
                  }
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

          <button
            type="button"
            onClick={onPickPhoto}
            disabled={isUploadingPhoto}
            className={`mt-5 w-full h-12 rounded-2xl border flex items-center justify-center gap-2 text-sm ${
              usingPhoto
                ? 'border-emerald-500/60 text-emerald-500'
                : light
                  ? 'border-gray-200 text-gray-600'
                  : 'border-white/10 text-gray-400'
            }`}
          >
            {isUploadingPhoto ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            {copy.ownPhoto || 'My own photo'}
            {usingPhoto && !isUploadingPhoto && <Check className="w-4 h-4" />}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
