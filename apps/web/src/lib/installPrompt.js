/**
 * Chrome's install prompt, kept for a button to use later.
 *
 * `beforeinstallprompt` fires once, early, and is lost unless something is
 * listening when it arrives — so the listener is installed at boot rather than
 * by the screen that shows the button. The event can only be used once, and
 * only from a real user gesture.
 *
 * Browsers that never fire it (any iOS one, where installing is Share → Add to
 * Home Screen) simply leave nothing to offer, and the button stays hidden.
 */
let deferred = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(Boolean(deferred)));
}

export function watchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep Chrome's own mini-infobar from appearing; the button replaces it.
    event.preventDefault();
    deferred = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** True once the app is running from the home screen — nothing left to install. */
export function isInstalled() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function canInstall() {
  return Boolean(deferred) && !isInstalled();
}

/** Subscribe to availability. Returns an unsubscribe function. */
export function onInstallAvailability(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Show the prompt. Resolves to true if the person accepted. The event is spent
 * either way — Chrome will not hand out another one for this page load.
 */
export async function promptInstall() {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  notify();

  event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}
