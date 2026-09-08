import { createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { apiEnv } from '../env.api.js';
import { isProd } from '../env.js';
import { prisma } from '../db.js';
import { unauthorized } from '../lib/errors.js';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = 30;

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64url');

interface AccessClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Minimal HS256 JWT. A dedicated library would add a dependency for roughly
 * this much code; the verification below is the part that matters and it
 * checks signature, algorithm and expiry rather than trusting the header.
 */
function sign(payload: object, secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify<T>(token: string, secret: string): T {
  const parts = token.split('.');
  if (parts.length !== 3) throw unauthorized('Malformed token');
  const [header, body, sig] = parts as [string, string, string];

  let alg: unknown;
  try {
    alg = JSON.parse(Buffer.from(header, 'base64url').toString()).alg;
  } catch {
    throw unauthorized('Malformed token');
  }
  // Reject "none" and any algorithm swap outright.
  if (alg !== 'HS256') throw unauthorized('Unsupported token algorithm');

  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw unauthorized('Invalid token signature');
  }

  let claims: T & { exp?: number };
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    throw unauthorized('Malformed token');
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
    throw unauthorized('Token expired');
  }
  return claims;
}

export function issueAccessToken(user: { id: string; email: string }): {
  token: string;
  expiresIn: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const token = sign(
    { sub: user.id, email: user.email, iat: now, exp: now + ACCESS_TTL_SECONDS },
    apiEnv.JWT_ACCESS_SECRET,
  );
  return { token, expiresIn: ACCESS_TTL_SECONDS };
}

export function verifyAccessToken(token: string): AccessClaims {
  return verify<AccessClaims>(token, apiEnv.JWT_ACCESS_SECRET);
}

const hashToken = (raw: string) =>
  createHash('sha256').update(`${raw}${apiEnv.JWT_REFRESH_SECRET}`).digest('hex');

/** Refresh tokens are opaque random strings; only their hash is stored. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return raw;
}

/**
 * Consume a refresh token and issue a replacement. Rotation is unconditional:
 * a token presented twice is already revoked the second time.
 */
export async function rotateRefreshToken(
  raw: string,
): Promise<{ userId: string; email: string; refreshToken: string }> {
  const tokenHash = hashToken(raw);

  // Read for the user's details only. It decides nothing: the row could be
  // revoked between this line and the update below.
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!record) throw unauthorized('Session expired, sign in again');

  // This is the authorization. The validity predicate lives in the WHERE
  // clause, so exactly one caller can claim the token: `tokenHash` is unique,
  // so the count is 0 or 1, and only the caller that got 1 may mint a
  // replacement.
  //
  // Checking `revokedAt` in JavaScript and then updating by id was not the same
  // thing. Two refreshes arriving together — two tabs, or a retry — both read a
  // live row, both revoked it, and both issued a replacement, so one token
  // became two live sessions and the replay rejection this is supposed to
  // provide only held when the calls happened to be sequential. A logout racing
  // a refresh was undone the same way: it revoked the row, but the refresh had
  // already read it as live and minted a successor.
  const claimed = await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  });
  if (claimed.count !== 1) throw unauthorized('Session expired, sign in again');

  const refreshToken = await issueRefreshToken(record.userId);
  return { userId: record.userId, email: record.user.email, refreshToken };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const REFRESH_COOKIE = 'dq_refresh';

export const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60,
};
