import { useMemo } from 'react';

const TRIAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Premium / trial status derived from UserQuestData.
 * - is_premium: paid subscription (full access)
 * - trial_started_at: ISO timestamp set on onboarding completion
 *
 * Returns:
 *   isPremium    — paid user
 *   inTrial      — within 3-day free trial
 *   hasAccess    — isPremium || inTrial (can use Voice/Photo)
 *   daysLeft     — full days remaining in trial (0 if expired or no trial)
 *   trialExpired — trial started but expired
 */
export default function usePremiumStatus({ isPremium, trialStartedAt }) {
  return useMemo(() => {
    if (isPremium) {
      return { isPremium: true, inTrial: false, hasAccess: true, daysLeft: 0, trialExpired: false };
    }

    if (!trialStartedAt) {
      return { isPremium: false, inTrial: false, hasAccess: false, daysLeft: 0, trialExpired: false };
    }

    const startMs = new Date(trialStartedAt).getTime();
    if (isNaN(startMs)) {
      return { isPremium: false, inTrial: false, hasAccess: false, daysLeft: 0, trialExpired: false };
    }

    const elapsedMs = Date.now() - startMs;
    const daysLeft = Math.max(0, Math.ceil((TRIAL_DAYS * MS_PER_DAY - elapsedMs) / MS_PER_DAY));
    const inTrial = elapsedMs < TRIAL_DAYS * MS_PER_DAY;

    return {
      isPremium: false,
      inTrial,
      hasAccess: inTrial,
      daysLeft,
      trialExpired: !inTrial,
    };
  }, [isPremium, trialStartedAt]);
}