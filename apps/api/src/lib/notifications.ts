/**
 * Writing to the in-app notification log.
 *
 * Every call site here is on the side of something else the user asked for — a
 * completion, a freeze, a reminder run — so nothing in this file is allowed to
 * fail that request. `record` swallows its own errors and says whether a row
 * landed; a notification that went missing is a worse outcome than no
 * notification, but both are better than losing the write that caused it.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import type { Lang } from './notificationCopy.js';

/** How many rows a user keeps. Older ones are dropped as new ones arrive. */
export const MAX_PER_USER = 40;

export interface NewNotification {
  kind: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  /** Omit for an event that may legitimately repeat. See the schema comment. */
  dedupeKey?: string;
}

/**
 * Inserts one, or does nothing if its dedupe key is already there.
 *
 * `createMany` with `skipDuplicates` is what makes that a single statement
 * rather than a read followed by a write: two requests racing on the same key
 * both succeed, and exactly one row exists afterwards. Checking first and then
 * inserting would let both pass the check.
 */
export async function record(userId: string, notification: NewNotification): Promise<boolean> {
  try {
    const { count } = await prisma.notification.createMany({
      data: [{ userId, ...notification }],
      skipDuplicates: true,
    });

    // Only the run that actually inserted trims, so a duplicate costs one
    // statement rather than two.
    if (count > 0) await trim(userId);
    return count > 0;
  } catch (err) {
    console.error(`could not record a ${notification.kind} notification for ${userId}:`, err);
    return false;
  }
}

/**
 * Keeps the newest MAX_PER_USER and deletes the rest.
 *
 * A log nobody prunes is a table that only grows, and nobody scrolls to the
 * four hundredth reminder. The subquery is ordered by id as well as time
 * because two rows written in the same millisecond would otherwise be an
 * unstable cut, which on a tie could keep one row and delete the other on every
 * run.
 */
async function trim(userId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM notifications
     WHERE user_id = ${userId}
       AND id NOT IN (
         SELECT id FROM notifications
          WHERE user_id = ${userId}
          ORDER BY created_at DESC, id DESC
          LIMIT ${MAX_PER_USER}
       )`;
}

/** The user's app language, as last saved from the browser. */
export async function langFor(userId: string): Promise<Lang> {
  const row = await prisma.questData.findUnique({
    where: { userId },
    select: { notificationSettings: true },
  });
  const settings = (row?.notificationSettings ?? {}) as { lang?: string };
  return settings.lang === 'en' ? 'en' : 'ru';
}

export const toWire = (row: {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  data: row.data ?? null,
  read: row.readAt !== null,
  created_at: row.createdAt.toISOString(),
});
