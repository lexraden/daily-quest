import { apiEnv } from '../env.api.js';
import { requireAiAccess, assertAiQuota, recordAiCall } from '../lib/access.js';
import { completeJson, strictSchema, nullable, type ImagePart } from './openai.js';
import * as prompts from './prompts.js';

export const mealSchema = strictSchema({
  meal_name: { type: 'string' },
  calories: { type: 'number' },
  protein: { type: 'number' },
  fat: { type: 'number' },
  carbs: { type: 'number' },
  description: nullable('string'),
});

export interface MealResult {
  meal_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  description: string | null;
}

export type MealPhotoAnalyzer = (
  userId: string,
  lang: 'ru' | 'en',
  loadImages: () => Promise<ImagePart[]>,
) => Promise<MealResult>;

/**
 * A meal read off one or more photos, under the access gate and the quota.
 *
 * Shared by POST /ai/meal/photo and the Telegram bot so a photo sent to either
 * costs the same, is refused for the same reasons, and is read by the same
 * prompt. The images come in as a loader rather than as bytes because both
 * callers have work to skip for someone the gate refuses — the route reading
 * files off disk, the bot downloading from Telegram — and the gate has to be
 * what answers first.
 *
 * The quota is charged only once the call succeeds, so an OpenAI outage costs
 * the user nothing.
 */
export const analyzeMealPhoto: MealPhotoAnalyzer = async (userId, lang, loadImages) => {
  await requireAiAccess(userId);
  await assertAiQuota(userId);

  const images = await loadImages();

  const result = await completeJson<MealResult>({
    model: apiEnv.OPENAI_MODEL_VISION,
    prompt: prompts.mealFromPhoto(lang),
    schemaName: 'meal',
    schema: mealSchema,
    images,
  });
  await recordAiCall(userId);
  return result;
};
