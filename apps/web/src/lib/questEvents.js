/**
 * Quests replaced from outside the tracker — re-onboarding from Profile.
 *
 * The tracker stays mounted in its tab, so without this it went on showing
 * the old quests, still ticked, until the app was reloaded: the reset looked
 * like it had done nothing. The event carries the server's row, which has the
 * new quests and today's ticks already cleared.
 */
export const QUESTS_REPLACED = 'dailyq:quests-replaced';

export const announceQuestsReplaced = (row) =>
  window.dispatchEvent(new CustomEvent(QUESTS_REPLACED, { detail: row }));
