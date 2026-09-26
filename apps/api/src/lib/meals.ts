import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';
import { notFound } from './errors.js';
import { toJson } from './json.js';

/**
 * The one way a meal gets into meal_history.
 *
 * Lives here rather than in the quest-data routes because the app is no longer
 * the only writer: the Telegram bot logs a photographed meal too, and a second
 * copy of the append would be a second place for the row lock or the validation
 * to drift. Both callers go through appendMeal, and so through mealBody.
 */

export const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

/**
 * A meal as the client records it. The id is assigned server-side on append so
 * that editing and deleting can name a specific meal rather than a position in
 * an array that another device may already have changed underneath them.
 */
export const mealBody = z
  .object({
    meal_name: z.string().trim().min(1).max(200),
    calories: z.number().int().min(0).max(100000),
    protein: z.number().int().min(0).max(10000).default(0),
    fat: z.number().int().min(0).max(10000).default(0),
    carbs: z.number().int().min(0).max(10000).default(0),
    photo_urls: z.array(z.string().max(2048)).max(8).default([]),
    date: dayString,
  })
  .strict();

export type MealInput = z.infer<typeof mealBody>;

export const mealPatchBody = mealBody.partial().strict();

/** Reads meal_history under a row lock, tolerating anything stored before this. */
export async function lockMeals(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const locked = await tx.$queryRaw<{ meal_history: unknown }[]>`
    SELECT meal_history FROM quest_data WHERE user_id = ${userId} FOR UPDATE`;
  if (locked.length === 0) throw notFound('Finish onboarding before saving meals');
  const value = locked[0]?.meal_history;
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export function writeMeals(tx: Prisma.TransactionClient, userId: string, meals: unknown[]) {
  return tx.questData.update({
    where: { userId },
    data: { mealHistory: toJson(meals) },
    include: { user: { select: { trialStartedAt: true, isPremium: true, premiumUntil: true } } },
  });
}

/**
 * Meals written before ids existed have none. Falling back to the timestamp
 * keeps those editable instead of stranding them, and two meals logged in the
 * same millisecond is not a case worth a migration.
 */
export function mealId(meal: unknown): string {
  if (!meal || typeof meal !== 'object') return '';
  const m = meal as { id?: unknown; timestamp?: unknown };
  if (typeof m.id === 'string' && m.id) return m.id;
  return typeof m.timestamp === 'string' ? m.timestamp : '';
}

/** Prepends one already-validated meal under the row lock and returns the row. */
export async function appendMeal(userId: string, input: MealInput) {
  return prisma.$transaction((tx) => appendMealIn(tx, userId, input));
}

/**
 * The same append inside a caller's transaction, for a caller whose own write
 * has to stand or fall with the meal — the bot claiming a preview, where a
 * claim that commits without its meal is a meal lost, and a meal without its
 * claim is one a second tap saves again.
 */
export async function appendMealIn(tx: Prisma.TransactionClient, userId: string, input: MealInput) {
  const meal = { id: randomUUID(), ...input, timestamp: new Date().toISOString() };
  const meals = await lockMeals(tx, userId);
  return writeMeals(tx, userId, [meal, ...meals]);
}

/**
 * Today as the user lives it, for writers that have no browser to ask. The web
 * app sends its own local day; the bot only has the timezone the reminder
 * settings saved, and a Dubai dinner logged at 23:00 belongs to that day, not
 * to UTC's.
 */
export function localDay(timezone: string | undefined): string {
  if (timezone) {
    try {
      // en-CA formats a date as YYYY-MM-DD, which is exactly a day key.
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      // An unknown zone name falls through to UTC rather than losing the meal.
    }
  }
  return new Date().toISOString().slice(0, 10);
}
