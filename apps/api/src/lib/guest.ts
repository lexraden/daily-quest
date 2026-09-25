/**
 * What a guest account is, in one place.
 *
 * Guest sign-in mints an account whose Google subject is namespaced `guest:` and
 * whose email is `guest-<id>@guest.invalid`, so the unique column is satisfied
 * without pretending to be anyone. The subject is the definition; the address
 * is a placeholder that must never be written to — `.invalid` is reserved never
 * to resolve, so sending there is a guaranteed bounce, and bounces are what cost
 * a sender domain its reputation.
 *
 * This lives in lib/ with no imports because the reminders job needs it too, and
 * the job runs without the API's environment: importing it from a route module
 * would pull in env.api and the job would refuse to start on missing JWT
 * secrets, which is exactly how the cron service kept failing before.
 */

export const GUEST_PREFIX = 'guest:';

export const isGuestSubject = (googleSub: string): boolean => googleSub.startsWith(GUEST_PREFIX);

/** Where this account's email may actually go, or null when it has nowhere real. */
export function emailRecipient(user: { email: string | null; googleSub: string }): string | null {
  if (!user.email || isGuestSubject(user.googleSub)) return null;
  return user.email;
}
