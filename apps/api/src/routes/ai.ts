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
}
