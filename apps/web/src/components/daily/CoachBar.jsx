import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Mic, Send, Square, Sparkles, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { t, getLang } from '@/lib/i18n';
import { aiErrorMessage } from '@/lib/aiErrors';
import { playSfx } from '@/lib/sfx';
import { applyProposal } from '@/lib/coachApply';
import useDictation, { mmss } from '@/lib/useDictation';
import CaloriePhotoInput from './CaloriePhotoInput';
import ProposalCard from './ProposalCard';

/** The server's limit on one message; a long dictation is cut to it. */
const MAX_MESSAGE = 2000;

/**
 * Talking to the coach from the tracker, without leaving it.
 *
 * A real field in the page, with the mic and the meal photo beside it. What
 * is typed or said goes to the coach, and the answer appears as a card right
 * under the field, in the page — no panel over the quests. When the answer is
 * an action (log a meal, tick a quest, replace one, note something) the card
 * carries it, and applying it leaves a line saying what was done. The whole
 * conversation is one tap away, in the same chat the other tabs open.
 */
const CoachBar = React.memo(function CoachBar({
  theme = 'dark',
  questData,
  onApplied,
  onOpenChat,
  onMealAnalyzed,
  hasAccess = true,
  onLocked,
}) {
  const i = t();
  const copy = i.coach || {};
  const light = theme === 'light';
  const reduce = useReducedMotion();

  const [draft, setDraft] = useState('');
  // The last exchange: { question, reply?, proposal?, done?, skipped? }.
  const [exchange, setExchange] = useState(null);
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);
  const [photoState, setPhotoState] = useState({ hasPhotos: false, isAnalyzing: false });

  const send = async (text) => {
    const question = (typeof text === 'string' ? text : draft).trim().slice(0, MAX_MESSAGE);
    if (!question || sending) return;
    if (typeof text !== 'string') setDraft('');
    setSending(true);
    setExchange({ question });
    try {
      const { reply, proposal } = await api.ai.chat.send(question, getLang());
      setExchange({ question, reply, proposal: proposal || null });
      playSfx('message');
    } catch (error) {
      toast.error(aiErrorMessage(error, i));
      // Back in the field, said or typed, to send again.
      setDraft(question);
      setExchange(null);
    } finally {
      setSending(false);
    }
  };

  const { recording, elapsed, start, stop } = useDictation((spoken) => send(spoken));

  const tapMic = () => {
    if (!hasAccess) {
      onLocked?.();
      return;
    }
    start();
  };

  const apply = async () => {
    if (!exchange?.proposal || applying) return;
    setApplying(true);
    try {
      const { change, done } = await applyProposal(exchange.proposal, questData, copy);
      onApplied?.(change);
      playSfx('complete');
      setExchange((prev) => ({ ...prev, done }));
    } catch (error) {
      toast.error(error?.message || i.errors?.saveFailed || 'Could not save that — try again');
    } finally {
      setApplying(false);
    }
  };

  const photosActive = photoState.hasPhotos || photoState.isAnalyzing;
  const ink = light ? 'text-gray-900' : 'text-white';
  const muted = light ? 'text-gray-500' : 'text-gray-400';
  const iconButton =
    'h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:from-purple-700 hover:to-cyan-700 [&_svg]:size-5';

  return (
    <div className="px-5 mb-4">
      <div className="flex gap-2">
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
              <label
                className={`flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border px-4 transition-colors focus-within:border-purple-500 ${
                  light ? 'border-gray-200 bg-white' : 'border-white/10 bg-[#1e2836]'
                }`}
              >
                <Sparkles className={`h-4 w-4 shrink-0 ${light ? 'text-purple-600' : 'text-purple-400'}`} />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  maxLength={MAX_MESSAGE}
                  enterKeyHint="send"
                  placeholder={copy.askPlaceholder || 'Ask the coach'}
                  aria-label={copy.askPlaceholder || 'Ask the coach'}
                  className={`h-full min-w-0 flex-1 bg-transparent text-sm outline-none ${ink} ${
                    light ? 'placeholder:text-gray-400' : 'placeholder:text-gray-500'
                  }`}
                />
              </label>

              {/* One button, like every messenger: the mic while the field is
                  empty, send once there is something to send. */}
              {draft.trim() ? (
                <Button onClick={() => send()} disabled={sending} size="icon" aria-label={copy.send || 'Send'} className={iconButton}>
                  <Send />
                </Button>
              ) : (
                <Button onClick={tapMic} disabled={sending} size="icon" aria-label={i.voice.voiceInput} className={iconButton}>
                  <Mic />
                </Button>
              )}
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

      {/* The answer, in the page under the field it was asked in. */}
      <AnimatePresence initial={false}>
        {exchange && !photosActive && (
          <motion.div
            key="answer"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`mt-2 rounded-2xl border p-4 ${
              light ? 'border-gray-200 bg-white' : 'border-white/10 bg-[#1e2836]'
            }`}
          >
            <div className="flex items-center gap-2">
              <p className={`min-w-0 flex-1 truncate text-xs ${muted}`}>{exchange.question}</p>
              <button
                onClick={onOpenChat}
                className={`shrink-0 text-xs font-semibold ${light ? 'text-purple-600' : 'text-purple-400'}`}
              >
                {copy.openChat || 'Whole chat'}
              </button>
              <button
                onClick={() => setExchange(null)}
                aria-label={i.common?.close || 'Close'}
                className={`-mr-2 flex h-8 w-8 shrink-0 items-center justify-center ${muted}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {exchange.reply === undefined ? (
              <div className="mt-2 flex h-5 items-center gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            ) : (
              <p className={`mt-1.5 text-sm leading-relaxed ${ink}`}>{exchange.reply}</p>
            )}

            {exchange.done ? (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                <span className={`min-w-0 truncate ${ink}`}>
                  <span className="font-semibold">{exchange.done.title}</span>
                  {exchange.done.detail ? <span className={muted}> · {exchange.done.detail}</span> : null}
                </span>
              </div>
            ) : (
              exchange.proposal &&
              !exchange.skipped && (
                <ProposalCard
                  className="mt-3"
                  proposal={exchange.proposal}
                  questData={questData}
                  theme={theme}
                  applying={applying}
                  onApply={apply}
                  onSkip={() => setExchange((prev) => ({ ...prev, skipped: true }))}
                />
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default CoachBar;
