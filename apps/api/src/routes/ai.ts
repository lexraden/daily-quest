import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { requireAuth, currentUserId } from '../auth/middleware.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireAiAccess, countAiCall } from '../lib/access.js';
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
  app.addHook('preHandler', requireAuth);

  // Burst protection. The monthly ceiling in countAiCall is the spend backstop;
  // this stops one user hammering the endpoint in a loop.
  await app.register(import('@fastify/rate-limit'), {
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.userId ?? request.ip,
  });

  const gate = async (userId: string) => {
    await requireAiAccess(userId);
    await countAiCall(userId);
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

    const userId = currentUserId(request);
    await gate(userId);

    const result = await completeJson<Record<string, unknown>>({
      model: env.OPENAI_MODEL_QUESTS,
      prompt: prompts.questGeneration(body.data.lang, body.data.answers),
      schemaName: 'quest_set',
      schema: questSchema,
      maxTokens: 3000,
    });

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
    await gate(userId);

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

    return completeJson({
      model: env.OPENAI_MODEL_MEAL,
      prompt: prompts.voiceIntent(body.data.lang, body.data.text, existingQuestsList),
      schemaName: 'voice_intent',
      schema: intentSchema,
    });
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

    const userId = currentUserId(request);
    await gate(userId);

    return completeJson<{ cleaned_text: string }>({
      model: env.OPENAI_MODEL_MEAL,
      prompt: prompts.transcriptCleanup(body.data.lang, body.data.question, body.data.text),
      schemaName: 'cleaned_text',
      schema: strictSchema({ cleaned_text: { type: 'string' } }),
    });
  });

  app.post('/meal/text', async (request) => {
    const body = z
      .object({ text: z.string().trim().min(1).max(2000), lang })
      .safeParse(request.body);
    if (!body.success) throw badRequest('Describe what you ate');

    const userId = currentUserId(request);
    await gate(userId);

    return completeJson<MealResult>({
      model: env.OPENAI_MODEL_MEAL,
      prompt: prompts.mealFromText(body.data.lang, body.data.text),
      schemaName: 'meal',
      schema: mealSchema,
    });
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

    const userId = currentUserId(request);
    await gate(userId);

    return completeJson<MealResult>({
      model: env.OPENAI_MODEL_MEAL,
      prompt: prompts.mealCorrection(body.data.lang, body.data),
      schemaName: 'meal',
      schema: mealSchema,
    });
  });

  app.post('/meal/photo', async (request) => {
    const body = z
      .object({ file_ids: z.array(z.string()).min(1).max(4), lang })
      .safeParse(request.body);
    if (!body.success) throw badRequest('Attach at least one photo');

    const userId = currentUserId(request);
    await gate(userId);

    const images: ImagePart[] = [];
    for (const id of body.data.file_ids) {
      const file = await readFileForUser(id, userId);
      if (!file) throw notFound('That photo is no longer available');
      images.push({ mimeType: file.mimeType, base64: file.bytes.toString('base64') });
    }

    return completeJson<MealResult>({
      model: env.OPENAI_MODEL_VISION,
      prompt: prompts.mealFromPhoto(body.data.lang),
      schemaName: 'meal',
      schema: mealSchema,
      images,
    });
  });
}
