import type { FastifyRequest } from 'fastify';
import { verifyAccessToken } from './tokens.js';
import { unauthorized } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
  }
}

/**
 * Identity comes from the bearer token and nowhere else. No route reads a user
 * id or email out of a body, query or header — that was the authorisation hole
 * in the Base44 version, where the client chose its own `created_by` filter.
 */
export async function requireAuth(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  const claims = verifyAccessToken(header.slice('Bearer '.length).trim());
  request.userId = claims.sub;
  request.userEmail = claims.email;
}

export function currentUserId(request: FastifyRequest): string {
  if (!request.userId) throw unauthorized();
  return request.userId;
}
