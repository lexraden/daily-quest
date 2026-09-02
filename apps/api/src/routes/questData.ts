import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
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
    category_levels: jsonObject,
    category_total_completed: jsonObject,
    completion_history: jsonObject,
    calories_burned: jsonObject,
    onboarding_answers: jsonObject,
    notification_settings: jsonObject,
    journal_entries: jsonArray,
    meal_history: jsonArray,
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
  })
  .strict();

const TRIAL_DAYS = 3;

// snake_case over the wire, camelCase in the database. The frontend was built
// against Base44's snake_case entity and there was no reason to churn it.
const toWire = (row: {
  id: string;
  questData: unknown;
  categoryLevels: unknown;
  categoryTotalCompleted: unknown;
  completionHistory: unknown;
  caloriesBurned: unknown;
  onboardingAnswers: unknown;
  notificationSettings: unknown;
  journalEntries: unknown;
  mealHistory: unknown;
  totalCompleted: number;
  streak: number;
  streakFreezes: number;
  lastCompletedDate: string | null;
  lastVisitDate: string | null;
  trialStartedAt: Date | null;
  isPremium: boolean;
}) => ({
  id: row.id,
  quest_data: row.questData,
  category_levels: row.categoryLevels,
  category_total_completed: row.categoryTotalCompleted,
  completion_history: row.completionHistory,
  calories_burned: row.caloriesBurned,
  onboarding_answers: row.onboardingAnswers,
  notification_settings: row.notificationSettings,
  journal_entries: row.journalEntries,
  meal_history: row.mealHistory,
  total_completed: row.totalCompleted,
  streak: row.streak,
  streak_freezes: row.streakFreezes,
  last_completed_date: row.lastCompletedDate,
  last_visit_date: row.lastVisitDate,
  trial_started_at: row.trialStartedAt?.toISOString() ?? null,
  is_premium: row.isPremium,
});

const today = () => new Date().toISOString().slice(0, 10);

export default async function questDataRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // 204 means "signed in, but hasn't onboarded" — the app shows the onboarding
  // modal. A 404 would be indistinguishable from a routing mistake.
  app.get('/', async (request, reply) => {
    const row = await prisma.questData.findUnique({
      where: { userId: currentUserId(request) },
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
        notificationSettings: {},
        journalEntries: [],
        mealHistory: [],
        totalCompleted: 0,
        streak: 0,
        streakFreezes: 1,
        lastVisitDate: today(),
        trialStartedAt: new Date(),
        isPremium: false,
      },
      // Re-onboarding replaces the quests and answers but must not reset a
      // paid subscription, or restart an already-spent trial.
      update: {
        questData: toJson(quests),
        onboardingAnswers: toJson(parsed.data.onboarding_answers ?? {}),
        lastVisitDate: today(),
      },
    });

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
        ...(b.category_levels !== undefined ? { categoryLevels: toJson(b.category_levels) } : {}),
        ...(b.category_total_completed !== undefined
          ? { categoryTotalCompleted: toJson(b.category_total_completed) }
          : {}),
        ...(b.completion_history !== undefined
          ? { completionHistory: toJson(b.completion_history) }
          : {}),
        ...(b.calories_burned !== undefined ? { caloriesBurned: toJson(b.calories_burned) } : {}),
        ...(b.onboarding_answers !== undefined
          ? { onboardingAnswers: toJson(b.onboarding_answers) }
          : {}),
        ...(b.notification_settings !== undefined
          ? { notificationSettings: toJson(b.notification_settings) }
          : {}),
        ...(b.journal_entries !== undefined ? { journalEntries: toJson(b.journal_entries) } : {}),
        ...(b.meal_history !== undefined ? { mealHistory: toJson(b.meal_history) } : {}),
        ...(b.total_completed !== undefined ? { totalCompleted: b.total_completed } : {}),
        ...(b.streak !== undefined ? { streak: b.streak } : {}),
        ...(b.streak_freezes !== undefined ? { streakFreezes: b.streak_freezes } : {}),
        ...(b.last_completed_date !== undefined
          ? { lastCompletedDate: b.last_completed_date }
          : {}),
        ...(b.last_visit_date !== undefined ? { lastVisitDate: b.last_visit_date } : {}),
      },
    });

    return toWire(row);
  });

  // Reset onboarding. Premium survives; the trial does not restart.
  app.delete('/', async (request) => {
    await prisma.questData.deleteMany({ where: { userId: currentUserId(request) } });
    return { ok: true };
  });
}

export { TRIAL_DAYS };
