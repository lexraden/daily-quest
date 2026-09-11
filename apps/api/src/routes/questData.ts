import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import {
  deriveProgress,
  overallLevelFor,
  OVERALL_LEVEL_THRESHOLDS,
} from '../lib/progress.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  CATEGORIES,
  sanitizeQuestData,
  sortByLevel,
  type QuestSet,
  zeroedByCategory,
  onesByCategory,
} from '../lib/questData.js';
import { toJson } from '../lib/json.js';

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

const jsonObject = z.record(z.unknown());
const jsonArray = z.array(z.unknown());

/**
 * Every writable field, explicitly. A PATCH merges only what it names, so a
 * partial save can never blank a column the client left out — and a client can
 * never write `isPremium`, `trialStartedAt` or another user's id, none of which
 * appear here.
 */
const patchBody = z
  .object({
    quest_data: jsonObject,
    // Accepted for compatibility with an older bundle, then ignored: these are
    // derived from completion_history server-side.
    category_levels: jsonObject,
    category_total_completed: jsonObject,
    completion_history: jsonObject,
    calories_burned: jsonObject,
    mood_log: jsonObject,
    onboarding_answers: jsonObject,
    notification_settings: jsonObject,
    journal_entries: jsonArray,
    meal_history: jsonArray,
    // Same: writable only through POST /completions, /streak and
    // /streak/freeze, which apply them atomically.
    total_completed: z.number().int().min(0),
    streak: z.number().int().min(0),
    streak_freezes: z.number().int().min(0),
    last_completed_date: dayString.nullable(),
    last_visit_date: dayString.nullable(),
  })
  .partial()
  .strict();

const createBody = z
  .object({
    quest_data: jsonObject,
    onboarding_answers: jsonObject.optional(),
    // The client's own local day. The server has no idea what timezone the
    // caller is in, and DailyTracker compares this value against a locally
    // computed key to decide whether a new day started — seeding it from the
    // server's UTC clock made that comparison disagree for anyone east of
    // Greenwich, on the very first load after onboarding.
    last_visit_date: dayString.optional(),
  })
  .strict();

const completionBody = z
  .object({
    day: dayString,
    category: z.string().min(1).max(64),
    quest_name: z.string().min(1).max(200),
    level: z.number().int().min(1).max(3),
    emoji: z.string().max(16).optional(),
  })
  .strict();

const completionRemoveBody = z
  .object({
    day: dayString,
    category: z.string().min(1).max(64),
    level: z.number().int().min(1).max(3),
  })
  .strict();

/**
 * A meal as the client records it. The id is assigned server-side on append so
 * that editing and deleting can name a specific meal rather than a position in
 * an array that another device may already have changed underneath them.
 */
const mealBody = z
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

const mealPatchBody = mealBody.partial().strict();

/** How many quests one category may hold. The carousel gets unusable past this. */
const MAX_QUESTS_PER_CATEGORY = 6;

/**
 * A new quest. `level` is the difficulty the caller wants, 1 to 3; if that slot
 * is taken the server appends past it, which is what the voice flow has always
 * done — a category is not limited to three.
 */
const questAddBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    emoji: z.string().max(16).default(''),
    level: z.number().int().min(1).max(3).default(1),
  })
  .strict();

/** One quest, named by where it sits. */
const questPatchBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    emoji: z.string().max(16).default(''),
  })
  .strict();

/**
 * A journal entry. Append-only: nothing in the app edits or deletes one, so
 * there is no endpoint for it — the id is here so that a retry after a dropped
 * response cannot record the same entry twice.
 */
const journalBody = z
  .object({
    id: z.string().min(1).max(64),
    date: dayString,
    category: z.string().min(1).max(64),
    emoji: z.string().max(16).default(''),
    text: z.string().trim().min(1).max(2000),
    rawText: z.string().max(4000).default(''),
    type: z.enum(['quest_completed', 'journal']),
    questLevel: z.number().int().min(1).max(3).optional(),
  })
  .strict();

const streakBody = z.object({ day: dayString }).strict();

const celebratedBody = z.object({
  level: z.number().int().min(1).max(OVERALL_LEVEL_THRESHOLDS.length),
});

const freezeBody = z.object({ action: z.enum(['use', 'lose']) }).strict();

/**
 * The level to congratulate someone for, or null.
 *
 * Level 1 is where everyone starts, so it is never a celebration — the floor is
 * 1 rather than the column's 0 default. An account that was already past level 1
 * when this shipped does get one modal on next load, which is how they find out
 * the avatar it unlocked exists.
 */
function celebrationFor(totalXp: number, celebrated: number): number | null {
  const level = overallLevelFor(totalXp);
  return level > Math.max(celebrated, 1) ? level : null;
}

// snake_case over the wire, camelCase in the database. The frontend was built
// against Base44's snake_case entity and there was no reason to churn it.
const toWire = (row: {
  id: string;
  questData: unknown;
  categoryLevels: unknown;
  categoryTotalCompleted: unknown;
  completionHistory: unknown;
  caloriesBurned: unknown;
  moodLog: unknown;
  onboardingAnswers: unknown;
  notificationSettings: unknown;
  journalEntries: unknown;
  mealHistory: unknown;
  totalCompleted: number;
  celebratedLevel: number;
  streak: number;
  streakFreezes: number;
  lastCompletedDate: string | null;
  lastVisitDate: string | null;
  // Entitlement lives on the user row; it is echoed here because the app reads
  // both off the quest-data payload.
  user: { trialStartedAt: Date | null; isPremium: boolean };
}) => ({
  id: row.id,
  quest_data: row.questData,
  category_levels: row.categoryLevels,
  category_total_completed: row.categoryTotalCompleted,
  completion_history: row.completionHistory,
  calories_burned: row.caloriesBurned,
  mood_log: row.moodLog,
  onboarding_answers: row.onboardingAnswers,
  notification_settings: row.notificationSettings,
  journal_entries: row.journalEntries,
  meal_history: row.mealHistory,
  total_completed: row.totalCompleted,
  overall_level: overallLevelFor(row.totalCompleted),
  /**
   * The level to congratulate the user for, or null when there is nothing to
   * show. Computed here rather than by comparing totals in the browser so it
   * survives a reload and cannot fire twice on two devices: the client
   * acknowledges it, and only then does this go quiet.
   */
  celebrate_level: celebrationFor(row.totalCompleted, row.celebratedLevel),
  streak: row.streak,
  streak_freezes: row.streakFreezes,
  last_completed_date: row.lastCompletedDate,
  last_visit_date: row.lastVisitDate,
  trial_started_at: row.user.trialStartedAt?.toISOString() ?? null,
  is_premium: row.user.isPremium,
});

type History = Record<string, unknown[]>;

/** Tolerant read of a JSON column that predates any of this. */
function asHistory(value: unknown): History {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as History) };
}

/**
 * Writes the history together with the counters derived from it, so the two can
 * never disagree. Takes the transaction client so it runs inside the row lock.
 */
async function writeDerived(
  tx: Pick<typeof prisma, 'questData'>,
  userId: string,
  history: History,
) {
  const progress = deriveProgress(history);
  return tx.questData.update({
    where: { userId },
    data: {
      completionHistory: toJson(history),
      totalCompleted: progress.totalCompleted,
      categoryTotalCompleted: toJson(progress.categoryTotalCompleted),
      categoryLevels: toJson(progress.categoryLevels),
    },
    include: { user: { select: { trialStartedAt: true, isPremium: true } } },
  });
}

/** The category and level from the path, both checked. */
function questSlot(request: { params: unknown }): { category: string; level: number } {
  const { category, level: raw } = request.params as { category: string; level: string };
  if (!CATEGORIES.includes(category as never)) throw badRequest('No such category');
  const level = Number(raw);
  if (!Number.isInteger(level) || level < 1 || level > 99) throw badRequest('No such quest level');
  return { category, level };
}

async function lockQuests(tx: Prisma.TransactionClient, userId: string): Promise<QuestSet> {
  const locked = await tx.$queryRaw<{ quest_data: unknown }[]>`
    SELECT quest_data FROM quest_data WHERE user_id = ${userId} FOR UPDATE`;
  if (locked.length === 0) throw notFound('Finish onboarding before saving quests');
  return sanitizeQuestData(locked[0]?.quest_data);
}

function writeQuests(tx: Prisma.TransactionClient, userId: string, quests: QuestSet) {
  return tx.questData.update({
    where: { userId },
    data: { questData: toJson(sortByLevel(quests)) },
    include: { user: { select: { trialStartedAt: true, isPremium: true } } },
  });
}

/** Reads meal_history under a row lock, tolerating anything stored before this. */
async function lockMeals(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const locked = await tx.$queryRaw<{ meal_history: unknown }[]>`
    SELECT meal_history FROM quest_data WHERE user_id = ${userId} FOR UPDATE`;
  if (locked.length === 0) throw notFound('Finish onboarding before saving meals');
  const value = locked[0]?.meal_history;
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function writeMeals(tx: Prisma.TransactionClient, userId: string, meals: unknown[]) {
  return tx.questData.update({
    where: { userId },
    data: { mealHistory: toJson(meals) },
    include: { user: { select: { trialStartedAt: true, isPremium: true } } },
  });
}

/**
 * Meals written before ids existed have none. Falling back to the timestamp
 * keeps those editable instead of stranding them, and two meals logged in the
 * same millisecond is not a case worth a migration.
 */
function mealId(meal: unknown): string {
  if (!meal || typeof meal !== 'object') return '';
  const m = meal as { id?: unknown; timestamp?: unknown };
  if (typeof m.id === 'string' && m.id) return m.id;
  return typeof m.timestamp === 'string' ? m.timestamp : '';
}

/** Fallback only — a client that sends its own local day is preferred. */
const utcToday = () => new Date().toISOString().slice(0, 10);

export default async function questDataRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // 204 means "signed in, but hasn't onboarded" — the app shows the onboarding
  // modal. A 404 would be indistinguishable from a routing mistake.
  app.get('/', async (request, reply) => {
    const row = await prisma.questData.findUnique({
      where: { userId: currentUserId(request) },
      include: { user: { select: { trialStartedAt: true, isPremium: true } } },
    });
    if (!row) return reply.code(204).send();
    return toWire(row);
  });

  app.post('/', async (request, reply) => {
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) throw badRequest('Onboarding needs a quest_data object');

    const userId = currentUserId(request);
    const quests = sortByLevel(sanitizeQuestData(parsed.data.quest_data));
    const today = parsed.data.last_visit_date ?? utcToday();

    // The trial clock is set here, server-side. The client cannot backdate it.
    const row = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ completion_history: unknown }[]>`
        SELECT completion_history FROM quest_data WHERE user_id = ${userId} FOR UPDATE`;

      if (locked.length === 0) {
        return tx.questData.create({
          data: {
            userId,
            questData: toJson(quests),
            onboardingAnswers: toJson(parsed.data.onboarding_answers ?? {}),
            categoryLevels: onesByCategory(),
            categoryTotalCompleted: zeroedByCategory(),
            completionHistory: {},
            caloriesBurned: {},
            moodLog: {},
            notificationSettings: {},
            journalEntries: [],
            mealHistory: [],
            totalCompleted: 0,
            streak: 0,
            streakFreezes: 1,
            lastVisitDate: today,
          },
          include: { user: { select: { trialStartedAt: true, isPremium: true } } },
        });
      }

      /**
       * Re-onboarding. The quests and answers are replaced; a paid
       * subscription and an already-spent trial are not touched.
       *
       * Today's ticks go with the old quests. A completion is keyed by
       * category and level, not by name, so every one of them would land on
       * whichever new quest took that slot — the user finished onboarding and
       * found a fresh set already ticked off. Their XP goes too, for the same
       * reason: it was earned by quests that no longer exist, and leaving it
       * behind would show progress against nothing visible.
       *
       * Earlier days are untouched. The confirmation dialog promises that
       * history and achievements survive, and they do — this is only today.
       */
      const history = asHistory(locked[0]?.completion_history);
      delete history[today];
      const progress = deriveProgress(history);

      return tx.questData.update({
        where: { userId },
        data: {
          questData: toJson(quests),
          onboardingAnswers: toJson(parsed.data.onboarding_answers ?? {}),
          lastVisitDate: today,
          completionHistory: toJson(history),
          totalCompleted: progress.totalCompleted,
          categoryTotalCompleted: toJson(progress.categoryTotalCompleted),
          categoryLevels: toJson(progress.categoryLevels),
        },
        include: { user: { select: { trialStartedAt: true, isPremium: true } } },
      });
    });

    // The trial clock is started by the first AI call (see requireAiAccess),
    // which onboarding always makes before reaching here.
    return reply.code(201).send(toWire(row));
  });

  app.patch('/', async (request) => {
    const parsed = patchBody.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      // Unrecognised-key issues carry an empty path, so name the field only
      // when Zod actually identified one.
      const field = issue?.path.length ? `${issue.path.join('.')}: ` : '';
      throw badRequest(`Cannot save — ${field}${issue?.message ?? 'invalid data'}`);
    }

    const userId = currentUserId(request);
    const existing = await prisma.questData.findUnique({ where: { userId } });
    if (!existing) throw notFound('Finish onboarding before saving progress');

    const b = parsed.data;
    const row = await prisma.questData.update({
      where: { userId },
      data: {
        ...(b.quest_data !== undefined
          ? { questData: toJson(sortByLevel(sanitizeQuestData(b.quest_data))) }
          : {}),
        // XP, category totals and category levels are derived, never taken from
        // the request: a browser that computes them from stale state loses a
        // sibling tab's completion. The keys stay accepted so an older bundle
        // still open somewhere keeps saving instead of getting a 400 — the
        // values it sends are simply ignored.
        ...(b.completion_history !== undefined
          ? (() => {
              const history = asHistory(b.completion_history);
              const progress = deriveProgress(history);
              return {
                completionHistory: toJson(history),
                totalCompleted: progress.totalCompleted,
                categoryTotalCompleted: toJson(progress.categoryTotalCompleted),
                categoryLevels: toJson(progress.categoryLevels),
              };
            })()
          : {}),
        ...(b.calories_burned !== undefined ? { caloriesBurned: toJson(b.calories_burned) } : {}),
        ...(b.mood_log !== undefined ? { moodLog: toJson(b.mood_log) } : {}),
        ...(b.onboarding_answers !== undefined
          ? { onboardingAnswers: toJson(b.onboarding_answers) }
          : {}),
        ...(b.notification_settings !== undefined
          ? { notificationSettings: toJson(b.notification_settings) }
          : {}),
        ...(b.journal_entries !== undefined ? { journalEntries: toJson(b.journal_entries) } : {}),
        ...(b.meal_history !== undefined ? { mealHistory: toJson(b.meal_history) } : {}),
        ...(b.last_visit_date !== undefined ? { lastVisitDate: b.last_visit_date } : {}),
      },
      include: { user: { select: { trialStartedAt: true, isPremium: true } } },
    });

    return toWire(row);
  });

  /**
   * Completions are appended by the server, not sent as a rewritten history.
   *
   * The row is locked for the transaction, so two tabs completing a quest at
   * the same moment queue up instead of overwriting each other, and the XP and
   * category levels are recomputed from the history rather than trusted from
   * the client — see lib/progress.ts.
   */
  app.post('/completions', async (request, reply) => {
    const parsed = completionBody.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.length ? `${issue.path.join('.')}: ` : '';
      throw badRequest(`Cannot record the quest — ${field}${issue?.message ?? 'invalid data'}`);
    }
    const userId = currentUserId(request);
    const c = parsed.data;

    const row = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ completion_history: unknown }[]>`
        SELECT completion_history FROM quest_data WHERE user_id = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw notFound('Finish onboarding before saving progress');

      const history = asHistory(locked[0]?.completion_history);
      const stored = history[c.day];
      const day = Array.isArray(stored) ? [...stored] : [];

      // Idempotent: a double tap, or a retry after a dropped response, must not
      // count the same quest twice.
      const already = day.some(
        (e) =>
          e && typeof e === 'object' &&
          (e as { category?: unknown }).category === c.category &&
          (e as { level?: unknown }).level === c.level,
      );
      if (!already) {
        day.push({
          category: c.category,
          questName: c.quest_name,
          level: c.level,
          emoji: c.emoji ?? '',
          timestamp: new Date().toISOString(),
        });
      }

      const next = { ...history, [c.day]: day };
      return writeDerived(tx, userId, next);
    });

    reply.code(201);
    return toWire(row);
  });

  /** Unchecking a quest. Removes one matching entry and recomputes the totals. */
  app.delete('/completions', async (request) => {
    const parsed = completionRemoveBody.safeParse(request.body);
    if (!parsed.success) throw badRequest('Cannot remove the quest — invalid data');
    const userId = currentUserId(request);
    const c = parsed.data;

    const row = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ completion_history: unknown }[]>`
        SELECT completion_history FROM quest_data WHERE user_id = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw notFound('Finish onboarding before saving progress');

      const history = asHistory(locked[0]?.completion_history);
      const stored = history[c.day];
      const day = Array.isArray(stored) ? [...stored] : [];
      const at = day.findIndex(
        (e) =>
          e && typeof e === 'object' &&
          (e as { category?: unknown }).category === c.category &&
          (e as { level?: unknown }).level === c.level,
      );
      if (at >= 0) day.splice(at, 1);

      const next = { ...history };
      if (day.length) next[c.day] = day;
      else delete next[c.day];

      return writeDerived(tx, userId, next);
    });

    return toWire(row);
  });

  /**
   * Count today towards the streak. The predicate is the concurrency control:
   * `IS DISTINCT FROM` matches a row whose last completed day is null or some
   * other day, so a second call for the same day updates nothing instead of
   * incrementing twice. Prisma's `not` filter would exclude the null row, which
   * is exactly the fresh account that has never counted a day.
   */
  app.post('/streak', async (request) => {
    const parsed = streakBody.safeParse(request.body);
    if (!parsed.success) throw badRequest('Cannot update the streak — expected a YYYY-MM-DD day');
    const userId = currentUserId(request);
    const { day } = parsed.data;

    const counted = await prisma.$executeRaw`
      UPDATE quest_data
         SET streak = streak + 1, last_completed_date = ${day}, updated_at = now()
       WHERE user_id = ${userId}
         AND last_completed_date IS DISTINCT FROM ${day}`;

    const row = await prisma.questData.findUnique({
      where: { userId },
      include: { user: { select: { trialStartedAt: true, isPremium: true } } },
    });
    if (!row) throw notFound('Finish onboarding before saving progress');

    return { ...toWire(row), counted: counted > 0 };
  });

  /**
   * Spend a freeze to save the streak, or let the streak go. Spending is
   * guarded by `streak_freezes > 0` in the WHERE clause, so two tabs cannot
   * both spend the last one.
   */
  app.post('/streak/freeze', async (request) => {
    const parsed = freezeBody.safeParse(request.body);
    if (!parsed.success) throw badRequest("Cannot update the streak — expected 'use' or 'lose'");
    const userId = currentUserId(request);

    let applied: number;
    if (parsed.data.action === 'use') {
      applied = await prisma.$executeRaw`
        UPDATE quest_data
           SET streak_freezes = streak_freezes - 1, updated_at = now()
         WHERE user_id = ${userId} AND streak_freezes > 0`;
    } else {
      applied = await prisma.$executeRaw`
        UPDATE quest_data SET streak = 0, updated_at = now() WHERE user_id = ${userId}`;
    }

    const row = await prisma.questData.findUnique({
      where: { userId },
      include: { user: { select: { trialStartedAt: true, isPremium: true } } },
    });
    if (!row) throw notFound('Finish onboarding before saving progress');

    return { ...toWire(row), applied: applied > 0 };
  });

  /**
   * Acknowledge a level-up the client has shown.
   *
   * `celebrated_level` only ever moves up, and the guard is in the WHERE
   * clause: two devices showing the same modal, or a retry after a dropped
   * response, settle on the same value instead of walking it backwards and
   * replaying an older celebration.
   */
  app.post('/level-celebrated', async (request) => {
    const parsed = celebratedBody.safeParse(request.body);
    if (!parsed.success) throw badRequest('Cannot record the level — expected a level of 1 to 10');
    const userId = currentUserId(request);

    await prisma.questData.updateMany({
      where: { userId, celebratedLevel: { lt: parsed.data.level } },
      data: { celebratedLevel: parsed.data.level },
    });

    const row = await prisma.questData.findUnique({
      where: { userId },
      include: { user: { select: { trialStartedAt: true, isPremium: true } } },
    });
    if (!row) throw notFound('Finish onboarding before saving progress');

    return toWire(row);
  });

  /**
   * Meals, one at a time.
   *
   * meal_history used to be rewritten whole by whoever saved last: the tracker's
   * debounced autosave, the profile's edit and delete, and now the coach chat.
   * Three writers and one array is how a meal logged on a phone disappears when
   * a laptop's autosave lands a second later with the list as it was at mount.
   * Each of these locks the row, changes exactly one entry, and writes back.
   */
  app.post('/meals', async (request, reply) => {
    const parsed = mealBody.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.length ? `${issue.path.join('.')}: ` : '';
      throw badRequest(`Cannot save the meal — ${field}${issue?.message ?? 'invalid data'}`);
    }
    const userId = currentUserId(request);
    const meal = { id: randomUUID(), ...parsed.data, timestamp: new Date().toISOString() };

    const row = await prisma.$transaction(async (tx) => {
      const meals = await lockMeals(tx, userId);
      return writeMeals(tx, userId, [meal, ...meals]);
    });

    reply.code(201);
    return toWire(row);
  });

  app.patch('/meals/:id', async (request) => {
    const parsed = mealPatchBody.safeParse(request.body);
    if (!parsed.success) throw badRequest('Cannot update the meal — invalid data');
    const { id } = request.params as { id: string };
    const userId = currentUserId(request);

    const row = await prisma.$transaction(async (tx) => {
      const meals = await lockMeals(tx, userId);
      const index = meals.findIndex((m) => mealId(m) === id);
      // A meal edited on one device and deleted on another is gone, not an
      // error worth interrupting anyone over.
      if (index === -1) return null;
      const next = [...meals];
      next[index] = { ...(next[index] as object), ...parsed.data };
      return writeMeals(tx, userId, next);
    });

    if (!row) throw notFound('That meal is no longer there');
    return toWire(row);
  });

  app.delete('/meals/:id', async (request) => {
    const { id } = request.params as { id: string };
    const userId = currentUserId(request);

    const row = await prisma.$transaction(async (tx) => {
      const meals = await lockMeals(tx, userId);
      const next = meals.filter((m) => mealId(m) !== id);
      // Deleting twice is the same as deleting once: a retry after a dropped
      // response must not fail.
      return writeMeals(tx, userId, next);
    });

    return toWire(row);
  });

  /**
   * One journal entry, appended under the row lock.
   *
   * Same reasoning as meals: a debounced save of the whole array would drop an
   * entry written on another device between this screen's load and its save.
   * Appending by id also makes a retry harmless — the entry is already there,
   * so the second attempt returns the same list rather than a duplicate.
   */
  app.post('/journal', async (request, reply) => {
    const parsed = journalBody.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.length ? `${issue.path.join('.')}: ` : '';
      throw badRequest(`Cannot save the entry — ${field}${issue?.message ?? 'invalid data'}`);
    }
    const userId = currentUserId(request);
    const entry = { ...parsed.data, timestamp: new Date().toISOString() };

    const row = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ journal_entries: unknown }[]>`
        SELECT journal_entries FROM quest_data WHERE user_id = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw notFound('Finish onboarding before saving entries');

      const value = locked[0]?.journal_entries;
      const entries = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const already = entries.some((e) => e && typeof e === 'object' && e.id === entry.id);

      return tx.questData.update({
        where: { userId },
        data: { journalEntries: toJson(already ? entries : [entry, ...entries]) },
        include: { user: { select: { trialStartedAt: true, isPremium: true } } },
      });
    });

    reply.code(201);
    return toWire(row);
  });

  /**
   * Quests, one at a time.
   *
   * quest_data was the last column still sent whole — by the tracker's autosave
   * and by the coach chat. Two devices editing different quests meant the later
   * save carried its own copy of every quest and quietly reverted the other.
   */

  /** Adds a quest to a category, at the requested difficulty or just past it. */
  app.post('/quests/:category', async (request, reply) => {
    const parsed = questAddBody.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw badRequest(`Cannot add the quest — ${issue?.message ?? 'invalid data'}`);
    }
    const { category } = request.params as { category: string };
    if (!CATEGORIES.includes(category as never)) throw badRequest('No such category');

    const userId = currentUserId(request);
    const row = await prisma.$transaction(async (tx) => {
      const quests = await lockQuests(tx, userId);
      const list = quests[category] ?? [];
      if (list.length >= MAX_QUESTS_PER_CATEGORY) {
        throw badRequest(`A category holds at most ${MAX_QUESTS_PER_CATEGORY} quests`);
      }

      const taken = new Set(list.map((q) => q.level));
      let level = parsed.data.level;
      while (taken.has(level)) level += 1;

      return writeQuests(tx, userId, {
        ...quests,
        [category]: [...list, { level, name: parsed.data.name, emoji: parsed.data.emoji || '⭐' }],
      });
    });

    reply.code(201);
    return toWire(row);
  });

  /** Edits one quest in place. */
  app.patch('/quests/:category/:level', async (request) => {
    const parsed = questPatchBody.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw badRequest(`Cannot save the quest — ${issue?.message ?? 'invalid data'}`);
    }
    const { category, level } = questSlot(request);
    const userId = currentUserId(request);

    const row = await prisma.$transaction(async (tx) => {
      const quests = await lockQuests(tx, userId);
      const list = quests[category] ?? [];
      if (!list.some((q) => q.level === level)) throw notFound('That quest is no longer there');

      return writeQuests(tx, userId, {
        ...quests,
        [category]: list.map((q) =>
          q.level === level
            ? { ...q, name: parsed.data.name, emoji: parsed.data.emoji || q.emoji }
            : q,
        ),
      });
    });

    return toWire(row);
  });

  /** Removes one quest. Past completions stay: they are history, not a plan. */
  app.delete('/quests/:category/:level', async (request) => {
    const { category, level } = questSlot(request);
    const userId = currentUserId(request);

    const row = await prisma.$transaction(async (tx) => {
      const quests = await lockQuests(tx, userId);
      const list = quests[category] ?? [];
      // Deleting twice is the same as deleting once.
      return writeQuests(tx, userId, {
        ...quests,
        [category]: list.filter((q) => q.level !== level),
      });
    });

    return toWire(row);
  });

  // Reset onboarding. Premium survives; the trial does not restart.
  app.delete('/', async (request) => {
    await prisma.questData.deleteMany({ where: { userId: currentUserId(request) } });
    return { ok: true };
  });
}
