/**
 * What a guest account is, in one place.
 *
 * Guest sign-in mints an account whose Google subject is namespaced `guest:` and
 * whose email is `guest-<id>@guest.invalid`, so the unique column is satisfied
 * without pretending to be anyone. The subject is the definition; the address
 * is a placeholder, and `.invalid` is reserved never to resolve.
 *
 * This lives in lib/ with no imports so scripts and jobs can use it without the
 * API's environment: importing it from a route module would pull in env.api and
 * anything run outside the API would refuse to start on missing JWT secrets.
 */

export const GUEST_PREFIX = 'guest:';

export const isGuestSubject = (googleSub: string): boolean => googleSub.startsWith(GUEST_PREFIX);
