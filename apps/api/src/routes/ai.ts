import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiEnv } from '../env.api.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireAiAccess, assertAiQuota, recordAiCall } from '../lib/access.js';
import { completeJson, strictSchema, nullable, type ImagePart } from '../ai/openai.js';
import * as prompts from '../ai/prompts.js';
import { CATEGORIES, sanitizeQuestData, sortByLevel } from '../lib/questData.js';
import { readFileForUser } from '../lib/storage.js';
import { prisma } from '../db.js';
import { overallLevelFor } from '../lib/progress.js';
import { toJson } from '../lib/json.js';

const lang = z.enum(['ru', 'en']).default('ru');

const questSchema = strictSchema(
  Object.fromEntries(
    CATEGORIES.map((cat) => [
      cat,
      {
        type: 'array',
        items: strictSchema({
          level: { type: 'number' },
          emoji: { type: 'string' },
          name: { type: 'string' },
        }),
      },
    ]),
  ),
);

const mealSchema = strictSchema({
  meal_name: { type: 'string' },
  calories: { type: 'number' },
  protein: { type: 'number' },
  fat: { type: 'number' },
  carbs: { type: 'number' },
  description: nullable('string'),
});

const intentSchema = strictSchema({
  intent: {
    type: 'string',
    enum: [
      'COMPLETED_QUEST',
      'ADD_QUEST',
      'DELETE_QUEST',
      'EDIT_QUEST',
      'MEAL_LOG',
      'JOURNAL',
    ],
  },
  category: { type: 'string', enum: [...CATEGORIES] },
  emoji: { type: 'string' },
  name: { type: 'string' },
  description: nullable('string'),
  level: nullable('number'),
  action: {
    type: 'string',
    enum: ['add', 'replace', 'edit', 'complete', 'journal'],
  },
  message: { type: 'string' },
  old_name: nullable('string'),
});

interface MealResult {
  meal_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  description: string | null;
}

export default async function aiRoutes(app: FastifyInstance) {
  // Authenticate on onRequest, not preHandler: @fastify/rate-limit also hooks
  // onRequest, and its keyGenerator would otherwise run before request.userId
  // was set and silently fall back to limiting per IP.
  app.addHook('onRequest', requireAuth);

  // Burst protection. The monthly ceiling is the spend backstop; this stops one
  // user hammering an endpoint in a loop.
  await app.register(import('@fastify/rate-limit'), {
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.userId ?? request.ip,
  });

  /**
   * Runs an AI call under the access gate and the monthly quota. The quota is
   * charged only once the call succeeds, so an OpenAI outage costs the user
   * nothing and a failing request cannot inflate the counter.
   */
  const guarded = async <T>(userId: string, run: () => Promise<T>): Promise<T> => {
    await requireAiAccess(userId);
    await assertAiQuota(userId);
    const result = await run();
    await recordAiCall(userId);
    return result;
  };

  app.post('/quests/generate', async (request) => {
    const body = z
      .object({
        answers: z.record(z.string()).refine((a) => Object.keys(a).length > 0, {
          message: 'Answer at least one onboarding question',
        }),
        lang,
      })
      .safeParse(request.body);
    if (!body.success) throw badRequest(body.error.issues[0]?.message ?? 'Invalid request');

    const result = await guarded(currentUserId(request), () =>
      completeJson<Record<string, unknown>>({
        model: apiEnv.OPENAI_MODEL_QUESTS,
        prompt: prompts.questGeneration(body.data.lang, body.data.answers),
        schemaName: 'quest_set',
        schema: questSchema,
        maxTokens: 3000,
      }),
    );

    // Sanitised and level-ordered here so a bad generation can't reach the UI,
    // even though POST /quest-data would sanitise it again on the way in.
    return { quest_data: sortByLevel(sanitizeQuestData(result)) };
  });

  app.post('/quests/voice', async (request) => {
    const body = z
      .object({
        text: z.string().trim().min(1).max(2000),
        quest_data: z.record(z.unknown()).optional(),
        lang,
      })
      .safeParse(request.body);
    if (!body.success) throw badRequest('Say or type something first');

    const userId = currentUserId(request);

    // The existing-quest list is rebuilt server-side in the exact format the
    // prompt expects, from the caller's own saved quests.
    const questData = body.data.quest_data ?? {};
    const existingQuestsList = Object.entries(questData)
      .map(([cat, quests]) => {
        if (!Array.isArray(quests)) return null;
        const items = quests
          .filter((q): q is { emoji: string; name: string; level: number } =>
            Boolean(q && typeof q === 'object'),
          )
          .map((q) => `"${q.emoji} ${q.name}" (level ${q.level})`)
          .join(', ');
        return `${cat}: ${items}`;
      })
      .filter(Boolean)
      .join('\n');

    return guarded(userId, () =>
      completeJson({
        model: apiEnv.OPENAI_MODEL_MEAL,
        prompt: prompts.voiceIntent(body.data.lang, body.data.text, existingQuestsList),
        schemaName: 'voice_intent',
        schema: intentSchema,
      }),
    );
  });

  // Cleans up a voice transcript during onboarding. Cheapest model: this is a
  // tidy-up, not a reasoning task.
  app.post('/text/cleanup', async (request) => {
    const body = z
      .object({
        question: z.string().trim().min(1).max(500),
        text: z.string().trim().min(1).max(4000),
        lang,
      })
      .safeParse(request.body);
    if (!body.success) throw badRequest('Nothing to clean up');

    return guarded(currentUserId(request), () =>
      completeJson<{ cleaned_text: string }>({
        model: apiEnv.OPENAI_MODEL_MEAL,
        prompt: prompts.transcriptCleanup(body.data.lang, body.data.question, body.data.text),
        schemaName: 'cleaned_text',
        schema: strictSchema({ cleaned_text: { type: 'string' } }),
      }),
    );
  });

  app.post('/meal/text', async (request) => {
    const body = z
      .object({ text: z.string().trim().min(1).max(2000), lang })
      .safeParse(request.body);
    if (!body.success) throw badRequest('Describe what you ate');

    return guarded(currentUserId(request), () =>
      completeJson<MealResult>({
        model: apiEnv.OPENAI_MODEL_MEAL,
        prompt: prompts.mealFromText(body.data.lang, body.data.text),
        schemaName: 'meal',
        schema: mealSchema,
      }),
    );
  });

  app.post('/meal/correct', async (request) => {
    const body = z
      .object({
        meal_name: z.string().min(1).max(200),
        calories: z.number(),
        protein: z.number(),
        fat: z.number(),
        carbs: z.number(),
        correction: z.string().trim().min(1).max(1000),
        lang,
      })
      .safeParse(request.body);
    if (!body.success) throw badRequest('Describe the correction you want');

    return guarded(currentUserId(request), () =>
      completeJson<MealResult>({
        model: apiEnv.OPENAI_MODEL_MEAL,
        prompt: prompts.mealCorrection(body.data.lang, body.data),
        schemaName: 'meal',
        schema: mealSchema,
      }),
    );
  });

  app.post('/meal/photo', async (request) => {
    const body = z
      .object({ file_ids: z.array(z.string()).min(1).max(4), lang })
      .safeParse(request.body);
    if (!body.success) throw badRequest('Attach at least one photo');

    const userId = currentUserId(request);
    await requireAiAccess(userId);
    await assertAiQuota(userId);

    const images: ImagePart[] = [];
    for (const id of body.data.file_ids) {
      const file = await readFileForUser(id, userId);
      if (!file) throw notFound('That photo is no longer available');
      images.push({ mimeType: file.mimeType, base64: file.bytes.toString('base64') });
    }

    const result = await completeJson<MealResult>({
      model: apiEnv.OPENAI_MODEL_VISION,
      prompt: prompts.mealFromPhoto(body.data.lang),
      schemaName: 'meal',
      schema: mealSchema,
      images,
    });
    await recordAiCall(userId);
    return result;
  });
  /**
   * The coach chat.
   *
   * The only endpoint where a caller's own words reach the model, so the
   * prompt frames them as data and this route never lets the answer write
   * anything: a proposal comes back as an offer, and the client applies it
   * through the ordinary quest endpoints once the user taps. That keeps the
   * atomic, row-locked writes as the single path into quest data.
   */
  app.get('/chat', async (request) => {
    const messages = await prisma.chatMessage.findMany({
      where: { userId: currentUserId(request) },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_KEPT,
    });
    return { messages: messages.map(toWireMessage) };
  });

  app.delete('/chat', async (request) => {
    await prisma.chatMessage.deleteMany({ where: { userId: currentUserId(request) } });
    return { ok: true };
  });

  app.post('/chat', async (request) => {
    const body = z
      .object({ message: z.string().trim().min(1).max(1000), lang })
      .safeParse(request.body);
    if (!body.success) throw badRequest('Write something first');

    const userId = currentUserId(request);
    const row = await prisma.questData.findUnique({
      where: { userId },
      select: {
        questData: true,
        categoryLevels: true,
        totalCompleted: true,
        streak: true,
        mealHistory: true,
      },
    });
    if (!row) throw notFound('Finish onboarding before using the coach');

    // Only the tail goes to the model: an unbounded transcript would make
    // every reply cost more than the one before it.
    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_SENT,
      select: { role: true, content: true },
    });
    history.reverse();

    const level = overallLevelFor(row.totalCompleted);
    const answer = await guarded(userId, () =>
      completeJson<{ reply: string; proposal: Proposal | null }>({
        model: apiEnv.OPENAI_MODEL_MEAL,
        prompt: prompts.coachChat(
          body.data.lang,
          {
            level,
            levelTitle: LEVEL_TITLES[level - 1] ?? `Level ${level}`,
            totalXp: row.totalCompleted,
            streak: row.streak,
            quests: describeQuests(row.questData),
            categoryLevels: describeCategoryLevels(row.categoryLevels),
            meals: describeMeals(row.mealHistory),
          },
          history,
          body.data.message,
        ),
        schemaName: 'coach_reply',
        schema: chatSchema,
      }),
    );

    // A proposal the app cannot act on is worse than none: it would render a
    // button that quietly does nothing. Anything malformed is dropped and the
    // reply stands on its own.
    const proposal = validProposal(answer.proposal, row.questData);

    await prisma.$transaction([
      prisma.chatMessage.create({
        data: { userId, role: 'user', content: body.data.message },
      }),
      prisma.chatMessage.create({
        data: {
          userId,
          role: 'assistant',
          content: answer.reply,
          ...(proposal ? { proposal: toJson(proposal) } : {}),
        },
      }),
    ]);

    await trimHistory(userId);
    return { reply: answer.reply, proposal };
  });
}

/** How many messages are kept, and how many of those are sent to the model. */
const HISTORY_KEPT = 40;
const HISTORY_SENT = 12;

const LEVEL_TITLES = [
  'Novice', 'Apprentice', 'Practitioner', 'Master', 'Expert',
  'Hero', 'Champion', 'Legend', 'Titan', 'God',
];

interface Proposal {
  kind: 'quest' | 'complete';
  category: string;
  level: number;
  name?: string;
  emoji?: string;
}

const chatSchema = strictSchema({
  reply: { type: 'string' },
  proposal: {
    type: ['object', 'null'],
    additionalProperties: false,
    required: ['kind', 'category', 'level', 'name', 'emoji'],
    properties: {
      kind: { type: 'string', enum: ['quest', 'complete'] },
      category: { type: 'string', enum: [...CATEGORIES] },
      level: { type: 'number' },
      name: nullable('string'),
      emoji: nullable('string'),
    },
  },
});

const toWireMessage = (m: {
  id: string;
  role: string;
  content: string;
  proposal: unknown;
  createdAt: Date;
}) => ({
  id: m.id,
  role: m.role,
  content: m.content,
  proposal: m.proposal ?? null,
  created_at: m.createdAt.toISOString(),
});

/**
 * Keeps only what a proposal needs to be actionable, and returns null if it is
 * not. A "quest" has to name a replacement; a "complete" has to point at a
 * quest that exists, or the button would tick something that is not there.
 */
function validProposal(raw: unknown, questData: unknown): Proposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Proposal>;

  if (p.kind !== 'quest' && p.kind !== 'complete') return null;
  if (typeof p.category !== 'string' || !CATEGORIES.includes(p.category as never)) return null;

  const level = Math.trunc(Number(p.level));
  if (!Number.isFinite(level) || level < 1 || level > 3) return null;

  if (p.kind === 'complete') {
    const quests = (questData as Record<string, unknown>)?.[p.category];
    const exists =
      Array.isArray(quests) &&
      quests.some((q) => q && typeof q === 'object' && (q as { level?: unknown }).level === level);
    return exists ? { kind: 'complete', category: p.category, level } : null;
  }

  const name = typeof p.name === 'string' ? p.name.trim().slice(0, 80) : '';
  if (!name) return null;
  const emoji = typeof p.emoji === 'string' && p.emoji.trim() ? p.emoji.trim().slice(0, 8) : '⭐';
  return { kind: 'quest', category: p.category, level, name, emoji };
}

/**
 * Drops everything past the newest HISTORY_KEPT messages. Trimming on write
 * caps the rows per user rather than only the rows read back.
 */
async function trimHistory(userId: string): Promise<void> {
  const keep = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_KEPT,
    select: { id: true },
  });
  if (keep.length < HISTORY_KEPT) return;
  await prisma.chatMessage.deleteMany({
    where: { userId, id: { notIn: keep.map((m) => m.id) } },
  });
}

function describeQuests(questData: unknown): string {
  const set = sanitizeQuestData(questData);
  return Object.entries(set)
    .map(([cat, quests]) => {
      const items = quests.map((q) => `L${q.level} "${q.emoji} ${q.name}"`).join(', ');
      return `${cat}: ${items || '—'}`;
    })
    .join('\n');
}

function describeCategoryLevels(levels: unknown): string {
  if (!levels || typeof levels !== 'object') return '—';
  return Object.entries(levels as Record<string, unknown>)
    .map(([cat, lvl]) => `${cat} ${lvl}`)
    .join(', ');
}

/** Today's meals only — yesterday's lunch is not what the coach is asked about. */
function describeMeals(mealHistory: unknown): string {
  if (!Array.isArray(mealHistory)) return '—';
  const today = new Date().toISOString().slice(0, 10);
  const todays = mealHistory.filter((m) => {
    const at = (m as { date?: unknown; timestamp?: unknown })?.date ?? (m as { timestamp?: unknown })?.timestamp;
    return typeof at === 'string' && at.slice(0, 10) === today;
  });
  if (todays.length === 0) return '—';
  return todays
    .map((m) => {
      const meal = m as { meal_name?: unknown; calories?: unknown };
      return `${String(meal.meal_name ?? '?')} ${Number(meal.calories ?? 0)}kcal`;
    })
    .join(', ');
}
