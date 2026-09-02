import { OAuth2Client } from 'google-auth-library';
import { apiEnv } from '../env.api.js';
import { unauthorized } from '../lib/errors.js';

const client = new OAuth2Client(apiEnv.GOOGLE_CLIENT_ID);

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Verify a Google ID token against Google's published keys. `verifyIdToken`
 * checks the signature, issuer and expiry; the audience check pins the token to
 * our own client id so a token minted for another app is rejected.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: apiEnv.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw unauthorized('Google sign-in could not be verified');
  }

  if (!payload?.sub) throw unauthorized('Google sign-in returned no account id');
  if (!payload.email) throw unauthorized('Google account has no email address');
  if (payload.email_verified === false) {
    throw unauthorized('Verify your Google email address before signing in');
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name,
    picture: payload.picture,
  };
}
