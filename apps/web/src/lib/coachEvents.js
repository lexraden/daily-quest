/**
 * The coach can be opened from any tab, but the tracker owns the quest, meal
 * and journal state it changes. A change applied from History or Profile is
 * announced with this event, and the tracker applies it exactly as it applies
 * one made from its own chat.
 */
export const COACH_APPLIED = 'dailyq:coach-applied';

export const announceCoachChange = (change) =>
  window.dispatchEvent(new CustomEvent(COACH_APPLIED, { detail: change }));
