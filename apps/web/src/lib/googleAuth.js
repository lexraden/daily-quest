/**
 * Google Identity Services loader. The script is injected on demand rather than
 * sitting in index.html so a signed-in returning user (restored from the
 * refresh cookie) never pays for it.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let loader = null;

const API_BASE = import.meta.env.VITE_API_URL || '';
let configPromise = null;

/**
 * The client id comes from the API rather than a VITE_ build variable, so it
 * cannot drift out of sync with the GOOGLE_CLIENT_ID the server verifies
 * tokens against, and changing it does not mean rebuilding the bundle.
 */
export function fetchGoogleClientId() {
  if (!configPromise) {
    configPromise = fetch(`${API_BASE}/api/auth/config`, { credentials: 'omit' })
      .then((r) => {
        if (!r.ok) throw new Error('Could not load the sign-in configuration');
        return r.json();
      })
      .then((c) => c.google_client_id || '')
      .catch((err) => {
        configPromise = null; // let a later attempt retry
        throw err;
      });
  }
  return configPromise;
}

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
  const clientId = await fetchGoogleClientId();
  if (!clientId) {
    throw new Error('Google sign-in is not configured for this deployment.');
  }
  await loadGoogleScript();

  window.google.accounts.id.initialize({
    client_id: clientId,
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
