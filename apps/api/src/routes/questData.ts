import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { deriveProgress } from '../lib/progress.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  sanitizeQuestData,
  sortByLevel,
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

const streakBody = z.object({ day: dayString }).strict();

const freezeBody = z.object({ action: z.enum(['use', 'lose']) }).strict();

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

    // The trial clock is set here, server-side. The client cannot backdate it.
    const row = await prisma.questData.upsert({
      where: { userId },
      create: {
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
        lastVisitDate: parsed.data.last_visit_date ?? utcToday(),
      },
      // Re-onboarding replaces the quests and answers but must not reset a
      // paid subscription, or restart an already-spent trial.
      update: {
        questData: toJson(quests),
        onboardingAnswers: toJson(parsed.data.onboarding_answers ?? {}),
        lastVisitDate: parsed.data.last_visit_date ?? utcToday(),
      },
      include: { user: { select: { trialStartedAt: true, isPremium: true } } },
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

  // Reset onboarding. Premium survives; the trial does not restart.
  app.delete('/', async (request) => {
    await prisma.questData.deleteMany({ where: { userId: currentUserId(request) } });
    return { ok: true };
  });
}
