import { useMemo } from 'react';

const TRIAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Premium / trial status derived from UserQuestData.
 * - is_premium: a standing grant with no end (comped accounts)
 * - premium_until: paid access, and when it runs out
 * - trial_started_at: ISO timestamp set on the first AI call
 *
 * Returns:
 *   isPremium    — Pro, from either a grant or paid time still running
 *   lifetime     — Pro with no end date, so nothing to renew
 *   paidUntil    — Date the paid period ends, or null
 *   inTrial      — within the 3-day free trial
 *   hasAccess    — isPremium || inTrial (can use Voice/Photo)
 *   daysLeft     — full days remaining in trial (0 if expired or no trial)
 *   trialExpired — trial started but expired
 *
 * This mirrors hasPro() in the API's lib/access.ts, which is what actually
 * decides whether a call runs. This copy decides only what the UI offers, so
 * the two disagreeing costs a misleading screen rather than free credit.
 */
export default function usePremiumStatus({ isPremium, premiumUntil, trialStartedAt }) {
  return useMemo(() => {
    const paidUntil = premiumUntil ? new Date(premiumUntil) : null;
    const paidValid = paidUntil && !isNaN(paidUntil.getTime()) && paidUntil.getTime() > Date.now();

    if (isPremium || paidValid) {
      return {
        isPremium: true,
        lifetime: !!isPremium,
        paidUntil: paidValid ? paidUntil : null,
        inTrial: false,
        hasAccess: true,
        daysLeft: 0,
        trialExpired: false,
      };
    }

    const lapsed = {
      isPremium: false,
      lifetime: false,
      paidUntil: null,
      inTrial: false,
      hasAccess: false,
      daysLeft: 0,
      trialExpired: false,
    };

    if (!trialStartedAt) return lapsed;

    const startMs = new Date(trialStartedAt).getTime();
    if (isNaN(startMs)) return lapsed;

    const elapsedMs = Date.now() - startMs;
    const daysLeft = Math.max(0, Math.ceil((TRIAL_DAYS * MS_PER_DAY - elapsedMs) / MS_PER_DAY));
    const inTrial = elapsedMs < TRIAL_DAYS * MS_PER_DAY;

    return {
      ...lapsed,
      inTrial,
      hasAccess: inTrial,
      daysLeft,
      trialExpired: !inTrial,
    };
  }, [isPremium, premiumUntil, trialStartedAt]);
}
