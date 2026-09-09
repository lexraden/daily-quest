import { t } from '@/lib/i18n';

/**
 * Turns a failed AI call into something the person can act on.
 *
 * Both AI entry points used to catch everything and show one fixed string —
 * "Photo analysis error", "Processing error" — so a spent trial, a monthly
 * limit, a provider outage and a failed upload were indistinguishable. The
 * server already separates those; this stops the UI throwing that away.
 *
 * Codes the server knows get the app's own localised copy. Anything else falls
 * back to the server's message, which is written to be read by a person, and
 * only then to the caller's generic string.
 */
export function aiErrorMessage(error, fallback) {
  const i = t();

  switch (error?.code) {
    case 'premium_required':
      return i.premium?.trialUpgradeMsg || i.premium?.trialExpired || fallback;
    case 'ai_quota_exceeded':
      return i.premium?.trialFeatureLocked || error.message || fallback;
    case 'unauthorized':
      return i.auth?.signInAgain || error.message || fallback;
    default:
      // 502/503 from the assistant, an upload that failed, a network drop.
      return error?.message || fallback;
  }
}
