import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { t, getLang } from '@/lib/i18n';
import { aiErrorMessage } from '@/lib/aiErrors';
import { playSfx } from '@/lib/sfx';
import { todayKey } from '@/lib/dates';

const CATEGORY_EMOJI = {
  health: '💚',
  mind: '🧠',
  money: '💰',
  work: '💼',
  love: '❤️',
  friends: '👥',
};

/**
 * The coach conversation.
 *
 * The model never writes anything. A reply may carry a proposal — replace a
 * quest, or tick one off — which is rendered as a card with a button, and
 * applying it goes through the ordinary quest endpoints from here. That keeps
 * the atomic, row-locked writes as the only path into quest data, and means a
 * wrong suggestion costs a glance rather than a correction.
 *
 * Quests are a fixed grid of six categories by three levels, so there is no
 * such thing as adding one: every quest proposal overwrites something. The card
 * shows what it would replace for exactly that reason.
 */
export default function CoachChat({
  open,
  onClose,
  theme = 'dark',
  questData,
  mealHistory = [],
  onApplied,
}) {
  const i = t();
  const copy = i.coach || {};
  const light = theme === 'light';

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [dismissed, setDismissed] = useState(() => new Set());
  const endRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api.ai.chat
      .history()
      .then(({ messages: rows }) => {
        if (!cancelled) setMessages(rows || []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    // Shown straight away with a temporary id; the server's copy replaces the
    // list on the next successful reply.
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content: message }]);
    setDraft('');
    setSending(true);

    try {
      const { reply, proposal } = await api.ai.chat.send(message, getLang());
      setMessages((prev) => [
        ...prev,
        { id: `reply-${Date.now()}`, role: 'assistant', content: reply, proposal: proposal || null },
      ]);
    } catch (error) {
      toast.error(aiErrorMessage(error, i));
      // Put the text back rather than losing what they typed.
      setDraft(message);
      setMessages((prev) => prev.filter((m) => m.content !== message || m.role !== 'user'));
    } finally {
      setSending(false);
    }
  };

  /** Applies a proposal through the ordinary endpoints and reports what changed. */
  const apply = async (messageId, proposal) => {
    if (applying) return;
    setApplying(messageId);
    try {
      if (proposal.kind === 'meal') {
        const meal = {
          meal_name: proposal.meal_name,
          calories: proposal.calories,
          protein: proposal.protein,
          fat: proposal.fat,
          carbs: proposal.carbs,
          photo_urls: [],
          date: todayKey(),
          timestamp: new Date().toISOString(),
        };
        // meal_history is still a whole-array column, so the list is rebuilt
        // from the copy this screen was given rather than appended blind.
        const next = [meal, ...mealHistory];
        await api.questData.update({ meal_history: next });
        onApplied?.({ kind: 'meal', mealHistory: next });
      } else if (proposal.kind === 'quest') {
        const current = Array.isArray(questData?.[proposal.category])
          ? questData[proposal.category]
          : [];
        const next = {
          ...questData,
          [proposal.category]: current.map((q) =>
            q.level === proposal.level
              ? { ...q, name: proposal.name, emoji: proposal.emoji || q.emoji }
              : q,
          ),
        };
        await api.questData.update({ quest_data: next });
        onApplied?.({ kind: 'quest', questData: next });
      } else {
        const quest = (questData?.[proposal.category] || []).find(
          (q) => q.level === proposal.level,
        );
        const row = await api.questData.completions.add(new Date().toISOString().slice(0, 10), {
          category: proposal.category,
          name: quest?.name || '',
          level: proposal.level,
          emoji: quest?.emoji || '',
        });
        onApplied?.({ kind: 'complete', row });
      }

      playSfx('complete');
      setDismissed((prev) => new Set(prev).add(messageId));
      toast.success(copy.applied || 'Done');
    } catch (error) {
      toast.error(error?.message || i.errors?.saveFailed || 'Could not save that — try again');
    } finally {
      setApplying(null);
    }
  };

  const clear = async () => {
    try {
      await api.ai.chat.clear();
      setMessages([]);
    } catch {
      toast.error(i.errors?.saveFailed || 'Could not do that — try again');
    }
  };

  if (!open) return null;

  const bubble = (mine) =>
    mine
      ? 'self-end bg-gradient-to-br from-purple-600 to-blue-500 text-white rounded-br-md'
      : light
        ? 'self-start bg-gray-100 text-gray-900 rounded-bl-md'
        : 'self-start bg-[#1e2836] text-gray-100 border border-white/10 rounded-bl-md';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          className={`relative flex w-full max-w-md flex-col rounded-t-3xl border-t ${
            light ? 'bg-white border-gray-200' : 'bg-[#141b27] border-white/10'
          }`}
          style={{ height: 'min(86vh, 760px)' }}
        >
          <header
            className={`flex items-center gap-3 px-5 py-3 border-b ${
              light ? 'border-gray-200' : 'border-white/10'
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-500">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
                {copy.title || 'Coach'}
              </span>
              <span className="block text-[11px] text-gray-500">
                {copy.subtitle || 'sees your quests, streak and meals'}
              </span>
            </span>
            {messages.length > 0 && (
              <button
                onClick={clear}
                aria-label={copy.clear || 'Clear chat'}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label={i.common?.close || 'Close'}
              className="-mr-3 flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {loading ? (
              <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-purple-500" />
            ) : messages.length === 0 ? (
              <p className="mx-auto mt-10 max-w-[15rem] text-center text-sm leading-relaxed text-gray-500">
                {copy.empty || 'Ask about your quests, your streak, or what to eat next.'}
              </p>
            ) : null}

            {messages.map((m) => {
              const mine = m.role === 'user';
              const proposal = !mine && m.proposal && !dismissed.has(m.id) ? m.proposal : null;
              const replaced = proposal?.kind === 'quest'
                ? (questData?.[proposal.category] || []).find((q) => q.level === proposal.level)
                : null;

              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${bubble(mine)}`}
                >
                  {m.content}

                  {proposal && (
                    <div
                      className={`mt-3 rounded-xl border p-3 ${
                        light ? 'border-gray-200 bg-white' : 'border-white/10 bg-[#141b27]'
                      }`}
                    >
                      <div className="text-[10px] font-bold tracking-[0.15em] text-gray-500">
                        {(proposal.kind === 'meal'
                          ? copy.mealLabel || 'LOG A MEAL'
                          : proposal.kind === 'quest'
                            ? copy.replaceLabel || 'REPLACE A QUEST'
                            : copy.completeLabel || 'MARK AS DONE'
                        ).toUpperCase()}
                      </div>

                      {proposal.kind === 'meal' ? (
                        <>
                          <div className={`mt-2 text-sm ${light ? 'text-gray-900' : 'text-white'}`}>
                            🍽️ {proposal.meal_name}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {proposal.calories} kcal · P{proposal.protein} F{proposal.fat} C
                            {proposal.carbs}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`mt-2 text-sm ${light ? 'text-gray-900' : 'text-white'}`}>
                            {CATEGORY_EMOJI[proposal.category] || '•'} {proposal.category} · L
                            {proposal.level}
                          </div>

                          {proposal.kind === 'quest' && (
                            <>
                              {replaced && (
                                <div className="mt-1 text-xs text-gray-500 line-through">
                                  {replaced.emoji} {replaced.name}
                                </div>
                              )}
                              <div className={`mt-1 text-sm ${light ? 'text-gray-900' : 'text-white'}`}>
                                {proposal.emoji} {proposal.name}
                              </div>
                            </>
                          )}
                        </>
                      )}

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => apply(m.id, proposal)}
                          disabled={applying === m.id}
                          className="flex h-9 flex-1 items-center justify-center rounded-lg bg-purple-600 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {applying === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            copy.apply || 'Apply'
                          )}
                        </button>
                        <button
                          onClick={() => setDismissed((prev) => new Set(prev).add(m.id))}
                          className={`h-9 w-20 rounded-lg border text-xs ${
                            light ? 'border-gray-200 text-gray-600' : 'border-white/10 text-gray-400'
                          }`}
                        >
                          {copy.skip || 'Skip'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div
                className={`self-start rounded-2xl rounded-bl-md px-4 py-3 ${
                  light ? 'bg-gray-100' : 'bg-[#1e2836] border border-white/10'
                }`}
              >
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div
            className={`border-t px-4 pt-3 ${light ? 'border-gray-200' : 'border-white/10'}`}
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                maxLength={1000}
                placeholder={copy.placeholder || 'Message…'}
                aria-label={copy.placeholder || 'Message'}
                className={`h-12 flex-1 rounded-2xl px-4 text-sm outline-none ${
                  light
                    ? 'bg-gray-100 text-gray-900 placeholder:text-gray-400'
                    : 'bg-[#1e2836] text-white placeholder:text-gray-500 border border-white/10'
                }`}
              />
              <button
                onClick={send}
                disabled={!draft.trim() || sending}
                aria-label={copy.send || 'Send'}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-500 disabled:opacity-40"
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
