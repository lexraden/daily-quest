import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../db.js';
import { apiEnv } from '../env.api.js';
import { verifyGoogleIdToken } from '../auth/google.js';
import {
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  REFRESH_COOKIE,
  refreshCookieOptions,
} from '../auth/tokens.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest, unauthorized, notFound, forbidden, HttpError } from '../lib/errors.js';
import { overallLevelFor } from '../lib/progress.js';

const googleBody = z.object({
  id_token: z.string().min(1),
});

// Avatars are stored on our own volume, so the URL is the relative signed path
// /api/files/<id>?sig=… that POST /api/files returns — not an absolute URL.
const avatarUrl = z
  .string()
  .max(2048)
  .refine((v) => /^\/api\/files\/[A-Za-z0-9_-]+\?sig=[A-Za-z0-9_-]+$/.test(v), {
    message: 'must be a URL returned by the file upload endpoint',
  });

/**
 * "level-<n>" for an unlocked avatar, or null to fall back to the uploaded
 * photo. The number is checked against the level the user has actually earned
 * further down — the shape alone proves nothing.
 */
const avatarChoice = z
  .string()
  .regex(/^level-([1-9]|10)$/, 'must be a level avatar you have unlocked');

const updateMeBody = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  avatar_url: avatarUrl.nullable().optional(),
  avatar_choice: avatarChoice.nullable().optional(),
});

const publicUser = (u: {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  trialStartedAt: Date | null;
  isPremium: boolean;
  avatarChoice?: string | null;
}) => ({
  id: u.id,
  email: u.email,
  // The frontend reads `full_name` and `avatar_url` — keep those names.
  full_name: u.fullName,
  avatar_url: u.avatarUrl,
  avatar_choice: u.avatarChoice ?? null,
  role: u.role,
  trial_started_at: u.trialStartedAt?.toISOString() ?? null,
  is_premium: u.isPremium,
});

export default async function authRoutes(app: FastifyInstance) {
  // The Google client id is public by design (it ships in every GIS request),
  // so the browser fetches it at runtime instead of the build baking a second
  // copy in. One VITE_ variable fewer to keep in sync with GOOGLE_CLIENT_ID —
  // a mismatch between the two is invisible until sign-in fails with
  // "invalid_client".
  app.get('/config', async () => ({
    google_client_id: apiEnv.GOOGLE_CLIENT_ID,
    guest_login: apiEnv.GUEST_LOGIN_ENABLED,
  }));

  // Scoped to this plugin and off by default, so only the route that opts in
  // below is limited — the rest of /api/auth is untouched.
  await app.register(import('@fastify/rate-limit'), { global: false });

  /**
   * A throwaway account, for testing where Google sign-in is not reachable.
   *
   * Guests are ordinary users: their own row, their own quest data, the same
   * trial and the same per-user AI quota. Nothing here weakens the isolation
   * every other route relies on — it only removes the identity proof, which is
   * why it stays behind GUEST_LOGIN_ENABLED and is rate limited: each new guest
   * is a fresh trial, and a fresh trial can spend money on OpenAI.
   */
  app.post(
    '/guest',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!apiEnv.GUEST_LOGIN_ENABLED) {
        throw notFound('Guest access is not enabled');
      }

      const id = randomUUID();
      const user = await prisma.user.create({
        data: {
          // Namespaced so a guest can never collide with a real Google subject,
          // and so guests are easy to find and delete later.
          googleSub: `guest:${id}`,
          email: `guest-${id}@guest.invalid`,
          fullName: 'Guest',
        },
      });

      const { token, expiresIn } = issueAccessToken(user);
      const refresh = await issueRefreshToken(user.id);
      reply.setCookie(REFRESH_COOKIE, refresh, refreshCookieOptions);
      reply.code(201);
      return { access_token: token, expires_in: expiresIn, user: publicUser(user) };
    },
  );

  app.post('/google', async (request, reply) => {
    const parsed = googleBody.safeParse(request.body);
    if (!parsed.success) throw badRequest('Send a Google id_token to sign in');

    const identity = await verifyGoogleIdToken(parsed.data.id_token);

    // Match on the Google account id, but keep the email in sync — it is the
    // human-facing key and can change on the Google side.
    let user;
    try {
      user = await prisma.user.upsert({
        where: { googleSub: identity.sub },
        create: {
          googleSub: identity.sub,
          email: identity.email,
          fullName: identity.name ?? null,
          avatarUrl: identity.picture ?? null,
        },
        update: { email: identity.email },
      });
    } catch (err) {
      // Unique violation on email: a different Google account already owns it.
      if ((err as { code?: string }).code === 'P2002') {
        throw new HttpError(
          409,
          'That email is already linked to a different Google account',
          'email_taken',
        );
      }
      throw err;
    }

    const { token, expiresIn } = issueAccessToken(user);
    const refresh = await issueRefreshToken(user.id);

    reply.setCookie(REFRESH_COOKIE, refresh, refreshCookieOptions);
    return { access_token: token, expires_in: expiresIn, user: publicUser(user) };
  });

  app.post('/refresh', async (request, reply) => {
    const raw = request.cookies[REFRESH_COOKIE];
    if (!raw) throw unauthorized('No session to refresh');

    const rotated = await rotateRefreshToken(raw);
    const { token, expiresIn } = issueAccessToken({
      id: rotated.userId,
      email: rotated.email,
    });

    reply.setCookie(REFRESH_COOKIE, rotated.refreshToken, refreshCookieOptions);
    return { access_token: token, expires_in: expiresIn };
  });

  app.post('/logout', async (request, reply) => {
    const raw = request.cookies[REFRESH_COOKIE];
    if (raw) await revokeRefreshToken(raw);
    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    return { ok: true };
  });

  app.get('/me', { preHandler: requireAuth }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId(request) },
    });
    if (!user) throw notFound('Account no longer exists');
    return publicUser(user);
  });

  app.patch('/me', { preHandler: requireAuth }, async (request) => {
    const parsed = updateMeBody.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw badRequest(`Cannot update ${issue?.path.join('.') || 'profile'}: ${issue?.message}`);
    }

    const { full_name, avatar_url, avatar_choice } = parsed.data;
    const userId = currentUserId(request);

    // Wearing an avatar is an entitlement, so it is checked against the level
    // the history actually adds up to. Trusting the body here would hand out
    // the level 10 look for the cost of one request.
    if (avatar_choice) {
      const wanted = Number(avatar_choice.slice('level-'.length));
      const row = await prisma.questData.findUnique({
        where: { userId },
        select: { totalCompleted: true },
      });
      const earned = overallLevelFor(row?.totalCompleted ?? 0);
      if (wanted > earned) {
        throw forbidden(`Reach level ${wanted} to wear this avatar`, 'avatar_locked');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(full_name !== undefined ? { fullName: full_name } : {}),
        ...(avatar_url !== undefined ? { avatarUrl: avatar_url } : {}),
        ...(avatar_choice !== undefined ? { avatarChoice: avatar_choice } : {}),
      },
    });
    return publicUser(user);
  });

  app.delete('/me', { preHandler: requireAuth }, async (request, reply) => {
    const userId = currentUserId(request);

    // Cascades clear quest data, files rows and refresh tokens. The bytes on
    // disk are ours to remove — do it after the row delete succeeds so a failed
    // transaction never leaves the account without its photos.
    await prisma.user.delete({ where: { id: userId } });
    await rm(join(apiEnv.UPLOAD_DIR, userId), { recursive: true, force: true }).catch(
      (err) => request.log.warn({ err, userId }, 'could not remove upload directory'),
    );

    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    return { ok: true };
  });
}
