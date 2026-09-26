import { prisma } from '../db.js';
import { apiEnv } from '../env.api.js';
import { analyzeMealPhoto, type MealPhotoAnalyzer } from '../ai/meal.js';
import { HttpError } from './errors.js';
import { appendMeal, localDay, mealBody } from './meals.js';
import { langFor } from './notifications.js';
import { storeUpload } from './storage.js';
import { call, downloadFile, sendToChat } from './telegram.js';

/**
 * A meal photographed straight into the bot.
 *
 * Nothing here is new behaviour, only a new door: the photo is stored the way
 * an upload is, read by the same analyzer the app's photo button calls — so it
 * is gated and counted against the same quota — and saved through the same
 * appendMeal the app's "save" does. What the bot adds is only the part the app
 * does with a screen: saying what it saw, or why it could not.
 *
 * There is no confirm step, unlike the app's report modal. A chat has no good
 * place for one, and a meal the model got wrong is one tap to fix in the app.
 */

type Lang = 'ru' | 'en';

const COPY = {
  ru: {
    saved: 'Сохранено в дневник питания. Поправить можно в приложении.',
    macros: (m: MealNumbers) => `${m.calories} ккал · Б ${m.protein} г · Ж ${m.fat} г · У ${m.carbs} г`,
    tooLarge: {
      title: 'Фото слишком большое',
      body: `Максимум ${maxMb()} МБ. Отправь его как фото, а не файлом — Telegram сам его сожмёт.`,
    },
    premium: { title: 'DailyQ Pro', body: 'Оформи Premium, чтобы продолжить пользоваться AI-функциями' },
    quota: { title: 'Лимит на этот месяц', body: 'Лимит AI-функций на этот месяц исчерпан.' },
    unavailable: {
      title: 'Не получилось распознать',
      body: 'Ассистент сейчас недоступен. Попробуй отправить фото ещё раз чуть позже.',
    },
    downloadFailed: {
      title: 'Не получилось загрузить фото',
      body: 'Telegram не отдал файл. Попробуй отправить его ещё раз.',
    },
    badFormat: { title: 'Не тот формат', body: 'Подходят JPEG, PNG, WebP или HEIC.' },
    onboarding: {
      title: 'Сначала настрой DailyQ',
      body: 'Заверши онбординг в приложении — после этого еду можно будет присылать сюда.',
    },
  },
  en: {
    saved: 'Saved to your meal log. You can edit it in the app.',
    macros: (m: MealNumbers) => `${m.calories} kcal · P ${m.protein} g · F ${m.fat} g · C ${m.carbs} g`,
    tooLarge: {
      title: 'That photo is too large',
      body: `The limit is ${maxMb()} MB. Send it as a photo rather than a file and Telegram will shrink it.`,
    },
    premium: { title: 'DailyQ Pro', body: 'Upgrade to Premium to keep using AI features' },
    quota: { title: 'Monthly limit reached', body: 'You have reached this month’s limit for AI features.' },
    unavailable: {
      title: 'Could not read that',
      body: 'The assistant is unavailable right now. Try sending the photo again in a little while.',
    },
    downloadFailed: {
      title: 'Could not fetch the photo',
      body: 'Telegram did not hand the file over. Try sending it again.',
    },
    badFormat: { title: 'Unsupported format', body: 'JPEG, PNG, WebP or HEIC work.' },
    onboarding: {
      title: 'Set up DailyQ first',
      body: 'Finish onboarding in the app, and then meals can be sent here.',
    },
  },
} as const;

/** For people the bot cannot put a language to yet. */
export const MEAL_BILINGUAL = {
  notLinked: {
    title: 'DailyQ',
    body:
      'Чтобы сохранять еду по фото, сначала подключи этот чат: профиль в приложении → «Подключить Telegram».\n\n' +
      'To log meals by photo, connect this chat first: your profile in the app → "Connect Telegram".',
  },
  photosOnly: {
    title: 'Пока только фото / Photos only for now',
    body:
      'Пришли фото еды — я посчитаю калории и сохраню приём пищи.\n\n' +
      'Send a photo of your meal and I will count the calories and log it.',
  },
} as const;

function maxMb(): number {
  return Math.floor(apiEnv.MAX_UPLOAD_BYTES / 1024 / 1024);
}

interface MealNumbers {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** The image in a message, as Telegram describes it before anything is fetched. */
export interface IncomingImage {
  fileId: string;
  /** Telegram's own figure. Missing on some updates, so the download re-checks. */
  fileSize?: number;
}

/** Thrown from inside the loader so the analyzer stops before the model call. */
class DownloadFailed extends Error {
  constructor(readonly reason: 'too_large' | 'failed') {
    super(reason);
  }
}

/**
 * Handles one photo from one chat, end to end, and always answers.
 *
 * Every failure becomes a reply rather than an exception: the webhook has
 * already said 200 by the time this runs, so there is nobody left to throw to,
 * and a bot that goes quiet after a photo reads as broken.
 */
export async function handleMealPhoto(
  chatId: string,
  image: IncomingImage,
  analyze: MealPhotoAnalyzer = analyzeMealPhoto,
): Promise<void> {
  const link = await prisma.telegramLink.findUnique({
    where: { chatId },
    select: { userId: true },
  });
  if (!link) {
    await sendToChat(chatId, MEAL_BILINGUAL.notLinked);
    return;
  }
  const { userId } = link;
  const lang: Lang = await langFor(userId);
  const copy = COPY[lang];

  // Refused before anything is downloaded: Telegram knows the size up front,
  // and fetching eight megabytes to say no to them is waste.
  if (image.fileSize !== undefined && image.fileSize > apiEnv.MAX_UPLOAD_BYTES) {
    await sendToChat(chatId, copy.tooLarge);
    return;
  }

  // Checked before the model call rather than left to appendMeal: a meal that
  // cannot be saved should not cost a call from the monthly quota.
  const row = await prisma.questData.findUnique({
    where: { userId },
    select: { notificationSettings: true },
  });
  if (!row) {
    await sendToChat(chatId, copy.onboarding);
    return;
  }
  const timezone = (row.notificationSettings as { timezone?: unknown } | null)?.timezone;

  let photoUrl = '';
  try {
    // Telegram's "typing…" while the model looks. Best effort: its absence
    // costs nothing but the hint.
    void call('sendChatAction', { chat_id: chatId, action: 'typing' });

    const result = await analyze(userId, lang, async () => {
      const download = await downloadFile(image.fileId, apiEnv.MAX_UPLOAD_BYTES);
      if (!download.ok) throw new DownloadFailed(download.reason);
      const stored = await storeUpload(userId, download.bytes);
      photoUrl = stored.url;
      return [{ mimeType: stored.mimeType, base64: download.bytes.toString('base64') }];
    });

    // Rounded the way the app's save rounds, and then held to the same schema
    // the app's POST /meals is, so the model cannot write anything the app
    // could not.
    const meal = mealBody.safeParse({
      meal_name: String(result.meal_name ?? '').trim().slice(0, 200),
      calories: nonNegative(result.calories),
      protein: nonNegative(result.protein),
      fat: nonNegative(result.fat),
      carbs: nonNegative(result.carbs),
      photo_urls: photoUrl ? [photoUrl] : [],
      date: localDay(typeof timezone === 'string' ? timezone : undefined),
    });
    if (!meal.success) {
      console.error('telegram meal: analyzer returned an unsaveable meal', meal.error.issues[0]?.path);
      await sendToChat(chatId, copy.unavailable);
      return;
    }

    await appendMeal(userId, meal.data);
    await sendToChat(chatId, {
      title: `🍽️ ${meal.data.meal_name}`,
      body: `${copy.macros(meal.data)}\n\n${copy.saved}`,
    });
  } catch (err) {
    await sendToChat(chatId, failureCopy(err, copy));
  }
}

function nonNegative(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function failureCopy(err: unknown, copy: (typeof COPY)[Lang]): { title: string; body: string } {
  if (err instanceof DownloadFailed) {
    return err.reason === 'too_large' ? copy.tooLarge : copy.downloadFailed;
  }
  if (err instanceof HttpError) {
    switch (err.code) {
      case 'premium_required':
        return copy.premium;
      case 'ai_quota_exceeded':
        return copy.quota;
      case 'not_found':
        // Onboarding undone between the check above and the save.
        return copy.onboarding;
    }
    // storeUpload refuses a file that does not sniff as an image it accepts.
    if (err.statusCode === 400) return copy.badFormat;
    return copy.unavailable;
  }
  console.error('telegram meal photo failed:', err instanceof Error ? err.message : err);
  return copy.unavailable;
}
