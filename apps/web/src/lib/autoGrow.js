/**
 * A one-line text field that grows with what is typed, up to `max` pixels.
 *
 * The coach's fields are textareas rather than inputs for a reason that has
 * nothing to do with length: Chrome on Android shows its autofill bar —
 * passwords, cards, addresses — above the keyboard for an <input>, whatever
 * `autocomplete` says, and not for a <textarea>. Growing is the bonus: a long
 * dictation can be read back before it is sent.
 */
export function autoGrow(el, max = 96) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
}
