import React from 'react';
import { Loader2 } from 'lucide-react';
import { t } from '@/lib/i18n';

/** The line above each card, by what it is offering to do. */
const PROPOSAL_LABELS = {
  meal: (c) => c.mealLabel || 'Log a meal',
  quest_add: (c) => c.addLabel || 'Add a quest',
  quest_edit: (c) => c.replaceLabel || 'Replace a quest',
  quest_delete: (c) => c.deleteLabel || 'Remove a quest',
  complete: (c) => c.completeLabel || 'Mark as done',
  journal: (c) => c.journalLabel || 'Save a note',
};

const CATEGORY_EMOJI = {
  health: '💚',
  mind: '🧠',
  money: '💰',
  work: '💼',
  love: '❤️',
  friends: '👥',
};

/**
 * One offer from the coach, with Apply and Skip.
 *
 * Quests are a fixed grid of six categories by three levels, so every quest
 * proposal overwrites something; the card shows what it would replace, struck
 * through, so the cost is visible before the tap.
 */
export default function ProposalCard({ proposal, questData, theme = 'dark', applying = false, onApply, onSkip, className = '' }) {
  const copy = t().coach || {};
  const light = theme === 'light';
  const replaced = proposal?.kind === 'quest_edit'
    ? (questData?.[proposal.category] || []).find((q) => q.level === proposal.level)
    : null;

  return (
    <div
      className={`rounded-xl border p-3 ${className} ${
        light ? 'border-gray-200 bg-white' : 'border-white/10 bg-[#141b27]'
      }`}
    >
      <div className="text-[10px] font-bold tracking-[0.15em] text-gray-500">
        {(PROPOSAL_LABELS[proposal.kind]?.(copy) || copy.apply || 'Apply').toUpperCase()}
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
      ) : proposal.kind === 'journal' ? (
        <>
          <div className={`mt-2 text-sm ${light ? 'text-gray-900' : 'text-white'}`}>
            {CATEGORY_EMOJI[proposal.category] || '•'} {proposal.category}
          </div>
          <div className="mt-1 text-xs text-gray-500">{proposal.text}</div>
        </>
      ) : (
        <>
          <div className={`mt-2 text-sm ${light ? 'text-gray-900' : 'text-white'}`}>
            {CATEGORY_EMOJI[proposal.category] || '•'} {proposal.category} · L
            {proposal.level}
          </div>

          {/* What it replaces, struck through, so the cost is visible. */}
          {proposal.kind === 'quest_edit' && replaced && (
            <div className="mt-1 text-xs text-gray-500 line-through">
              {replaced.emoji} {replaced.name}
            </div>
          )}

          {proposal.kind === 'quest_delete' ? (
            <div className="mt-1 text-sm text-gray-500 line-through">
              {proposal.name}
            </div>
          ) : proposal.kind === 'quest_add' || proposal.kind === 'quest_edit' ? (
            <div className={`mt-1 text-sm ${light ? 'text-gray-900' : 'text-white'}`}>
              {proposal.emoji} {proposal.name}
            </div>
          ) : null}
        </>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={onApply}
          disabled={applying}
          className="flex h-9 flex-1 items-center justify-center rounded-lg bg-purple-600 text-xs font-bold text-white disabled:opacity-60"
        >
          {applying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            copy.apply || 'Apply'
          )}
        </button>
        <button
          onClick={onSkip}
          className={`h-9 w-20 rounded-lg border text-xs ${
            light ? 'border-gray-200 text-gray-600' : 'border-white/10 text-gray-400'
          }`}
        >
          {copy.skip || 'Skip'}
        </button>
      </div>
    </div>
  );
}
