import { api } from '@/api/client';
import { todayKey } from '@/lib/dates';

/**
 * Applies one of the coach's proposals through the ordinary endpoints.
 *
 * The model never writes anything: its answer is an offer, and this is the
 * only thing that acts on it, through the same atomic, row-locked writes the
 * rest of the app uses. Shared by the chat and by the answer card on the
 * tracker, so a card applied in either place does exactly the same thing.
 *
 * Returns what changed, for whoever owns that state, and a line saying what
 * was done, for the confirmation. Throws what the endpoint threw.
 */
export async function applyProposal(proposal, questData, copy = {}) {
  let done;
  let change;


  if (proposal.kind === 'meal') {
    // One meal, appended by the server under a row lock — this screen never
    // sends the whole list, so it cannot undo a meal logged elsewhere.
    const row = await api.questData.meals.add({
      meal_name: proposal.meal_name,
      calories: proposal.calories,
      protein: proposal.protein,
      fat: proposal.fat,
      carbs: proposal.carbs,
      photo_urls: [],
      date: todayKey(),
    });
    change = { kind: 'meal', mealHistory: row.meal_history };
    done = {
      icon: '🍽️',
      title: copy.mealAdded || 'Meal logged',
      detail: `${proposal.meal_name} · ${proposal.calories} kcal`,
    };
  } else if (proposal.kind === 'quest_add') {
    const row = await api.questData.addQuest(proposal.category, proposal);
    change = { kind: 'quest', questData: row.quest_data };
    done = {
      icon: proposal.emoji || '➕',
      title: copy.questAdded || 'Quest added',
      detail: proposal.name,
    };
  } else if (proposal.kind === 'quest_edit') {
    // One slot, rewritten by the server — the whole grid never leaves here.
    const row = await api.questData.saveQuest(proposal.category, proposal.level, proposal);
    change = { kind: 'quest', questData: row.quest_data };
    done = {
      icon: proposal.emoji || '✏️',
      title: copy.questReplaced || 'Quest replaced',
      detail: proposal.name,
    };
  } else if (proposal.kind === 'quest_delete') {
    const row = await api.questData.removeQuest(proposal.category, proposal.level);
    change = { kind: 'quest', questData: row.quest_data };
    done = {
      icon: '🗑️',
      title: copy.questDeleted || 'Quest removed',
      detail: proposal.name,
    };
  } else if (proposal.kind === 'journal') {
    const row = await api.questData.journal.add({
      id: `coach-${Date.now()}`,
      date: todayKey(),
      category: proposal.category,
      emoji: '📝',
      text: proposal.text,
      rawText: '',
      type: 'journal',
    });
    change = { kind: 'journal', journalEntries: row.journal_entries };
    done = {
      icon: '📝',
      title: copy.journalSaved || 'Noted',
      detail: proposal.text,
    };
  } else {
    const quest = (questData?.[proposal.category] || []).find(
      (q) => q.level === proposal.level,
    );
    const row = await api.questData.completions.add(todayKey(), {
      category: proposal.category,
      name: quest?.name || '',
      level: proposal.level,
      emoji: quest?.emoji || '',
    });
    change = { kind: 'complete', row };
    done = {
      icon: quest?.emoji || '✅',
      title: copy.questDone || 'Marked done',
      // A completion is worth its level in XP, which is the part worth
      // seeing — the quest name is already on the card above.
      detail: `${quest?.name || ''} · +${Math.min(proposal.level, 3)} XP`.trim(),
    };
  }


  return { change, done };
}
