import React, { useRef, useState } from 'react';
import { Mic, Square, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CaloriePhotoInput from './CaloriePhotoInput';
import useDictation, { mmss } from '@/lib/useDictation';
import { t } from '@/lib/i18n';

/**
 * The one place on the tracker for talking to the app: the coach, the mic
 * and the meal photo, in a row where the Voice button used to be.
 *
 * Voice and the coach were two assistants for the same job. Voice turned a
 * sentence into one action behind a modal; the coach answered in a chat and
 * offered the same actions as cards — a meal, a quest done, added, replaced
 * or removed, a note — and it sees the quests, streak and meals while doing
 * it. So the mic now feeds the coach: what was said is sent as a message, and
 * the answer comes back with a card to apply. The chat keeps the history, so
 * "no, the other one" works, which a one-shot voice command never could.
 *
 * Photos stay separate because they go to the meal analyser, not the chat,
 * and while photos are being chosen the rest of the row steps aside, as
 * before.
 */
const CoachBar = React.memo(function CoachBar({
  theme = 'dark',
  onOpenCoach,
  onVoice,
  onMealAnalyzed,
  hasAccess = true,
  onLocked,
}) {
  const i = t();
  const light = theme === 'light';
  const [photoState, setPhotoState] = useState({ hasPhotos: false, isAnalyzing: false });
  // The chat opens out of this row, so it needs to know where the row is.
  const rowRef = useRef(null);
  const rect = () => rowRef.current?.getBoundingClientRect() ?? null;
  const { recording, elapsed, start, stop } = useDictation((text) => onVoice?.(text, rect()));

  const tapMic = () => {
    if (!hasAccess) {
      onLocked?.();
      return;
    }
    start();
  };

  const photosActive = photoState.hasPhotos || photoState.isAnalyzing;

  return (
    <div className="px-5 mb-4">
      <div ref={rowRef} className="flex gap-2">
        {recording ? (
          <Button
            onClick={stop}
            aria-label={i.voice.tapToStop}
            className="h-12 flex-1 rounded-2xl bg-red-500 font-medium text-white hover:bg-red-600"
          >
            <Square className="mr-2 h-4 w-4" fill="currentColor" />
            {i.voice.tapToStop}
            {/* The clock is what says it is still running: the label alone
                looks the same at one second and at four minutes. */}
            <span className="ml-2 font-mono text-sm tabular-nums opacity-90">{mmss(elapsed)}</span>
          </Button>
        ) : (
          !photosActive && (
            <>
              {/* Looks like the field it opens, so it reads as "type here". */}
              <button
                type="button"
                onClick={() => onOpenCoach?.(rect())}
                className={`flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border px-4 text-left text-sm transition-colors ${
                  light
                    ? 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    : 'border-white/10 bg-[#1e2836] text-gray-400 hover:bg-[#243044]'
                }`}
              >
                <Sparkles className={`h-4 w-4 shrink-0 ${light ? 'text-purple-600' : 'text-purple-400'}`} />
                <span className="truncate">{i.coach?.askPlaceholder || 'Ask the coach…'}</span>
              </button>

              <Button
                onClick={tapMic}
                size="icon"
                aria-label={i.voice.voiceInput}
                className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:from-purple-700 hover:to-cyan-700"
              >
                <Mic className="h-5 w-5" />
              </Button>
            </>
          )
        )}

        {!recording && (
          <div className={photosActive ? 'flex-1' : ''}>
            <CaloriePhotoInput
              onMealAnalyzed={onMealAnalyzed}
              onStateChange={setPhotoState}
              theme={theme}
              hasAccess={hasAccess}
              onLocked={onLocked}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default CoachBar;
