/**
 * Google Identity Services loader. The script is injected on demand rather than
 * sitting in index.html so a signed-in returning user (restored from the
 * refresh cookie) never pays for it.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let loader = null;

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();

  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google sign-in failed to load')));
        return;
      }
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loader = null;
        reject(new Error('Google sign-in failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return loader;
}

/**
 * Initialise GIS and hand each credential to `onCredential`. Returns a function
 * that renders the Google button into a container element.
 */
export async function initGoogleSignIn(onCredential) {
  if (!googleClientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not set');
  }
  await loadGoogleScript();

  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: (response) => onCredential(response.credential),
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  return (container, { theme = 'outline', size = 'large' } = {}) => {
    if (!container) return;
    window.google.accounts.id.renderButton(container, {
      theme,
      size,
      shape: 'pill',
      text: 'continue_with',
      width: Math.min(container.offsetWidth || 320, 400),
    });
  };
}

export function disableGoogleAutoSelect() {
  window.google?.accounts?.id?.disableAutoSelect?.();
}
