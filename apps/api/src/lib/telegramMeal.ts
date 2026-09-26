import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { apiEnv } from '../env.api.js';
import { analyzeMealPhoto, type MealPhotoAnalyzer } from '../ai/meal.js';
import { HttpError } from './errors.js';
import { appendMealIn, localDay, mealBody, type MealInput } from './meals.js';
import { langFor } from './notifications.js';
import { storeUpload } from './storage.js';
import { answerCallback, call, downloadFile, editMessage, sendToChat } from './telegram.js';

/**
 * A meal photographed straight into the bot.
 *
 * Nothing here is new behaviour, only a new door: the photo is stored the way
 * an upload is, read by the same analyzer the app's photo button calls — so it
 * is gated and counted against the same quota — and saved through the same
 * appendMeal the app's "save" does. What the bot adds is only the part the app
 * does with a screen: saying what it saw, or why it could not.
 *
 * Like the app's report modal, nothing is saved until the user says so: the
 * reply is a preview with Save and Cancel under it, and the meal waits in
 * telegram_meal_previews for the tap. The numbers themselves are not editable
 * here — a chat has no good place for a form — so the preview says they can be
 * fixed in the app once saved.
 */

type Lang = 'ru' | 'en';

const COPY = {
  ru: {
    macros: (m: MealNumbers) =>
      `${m.calories} ккал · белки ${m.protein} г · жиры ${m.fat} г · углеводы ${m.carbs} г`,
    forDay: (day: string) => `Сохраню за сегодня, ${dayLabel(day, 'ru')}.`,
    confirm: 'Всё верно? Поправить цифры можно будет в приложении после сохранения.',
    save: '✅ Сохранить',
    cancel: '❌ Отмена',
    openHistory: 'Открыть историю',
    saved: (day: string) =>
      `Сохранено в дневник питания за ${dayLabel(day, 'ru')}. Поправить можно в приложении.`,
    savedToast: 'Сохранено',
    cancelled: 'Не сохранено. Фото распознано, но в дневник ничего не попало.',
    cancelledToast: 'Отменено',
    expired: 'Время на подтверждение вышло — ничего не сохранено. Пришли фото ещё раз.',
    stale: 'Это уже неактуально. Пришли фото ещё раз.',
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
    macros: (m: MealNumbers) =>
      `${m.calories} kcal · protein ${m.protein} g · fat ${m.fat} g · carbs ${m.carbs} g`,
    forDay: (day: string) => `I will log it for today, ${dayLabel(day, 'en')}.`,
    confirm: 'Look right? The numbers can be fixed in the app once it is saved.',
    save: '✅ Save',
    cancel: '❌ Cancel',
    openHistory: 'Open history',
    saved: (day: string) =>
      `Saved to your meal log for ${dayLabel(day, 'en')}. You can edit it in the app.`,
    savedToast: 'Saved',
    cancelled: 'Not saved. The photo was analyzed, but nothing went into your log.',
    cancelledToast: 'Cancelled',
    expired: 'The time to confirm ran out, so nothing was saved. Send the photo again.',
    stale: 'This is no longer active. Send the photo again.',
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

/** "26 сентября" / "26 September", for a YYYY-MM-DD day key. */
function dayLabel(day: string, lang: Lang): string {
  // Noon UTC formatted in UTC: the key is already the user's own day, and this
  // only spells it out.
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * Long enough for the preview to live on. The meal is in the chat above the
 * buttons, so a user who comes back after this can simply send it again.
 */
const PREVIEW_TTL_MS = 30 * 60 * 1000;
/** 22 characters as base64url, which keeps the button data well inside Telegram's 64 bytes. */
const TOKEN_BYTES = 16;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

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
  /** Telegram's id for the sender, the only one allowed to answer the preview. */
  fromId: string,
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

    // One pending meal per chat: this replaces any earlier one, whose buttons
    // then match nothing and expire politely when tapped.
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const preview = {
      userId,
      fromId,
      tokenHash: hash(token),
      meal: meal.data,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    };
    await prisma.telegramMealPreview.upsert({
      where: { chatId },
      create: { chatId, ...preview },
      update: preview,
    });

    await sendToChat(chatId, {
      title: `🍽️ ${meal.data.meal_name}`,
      body: `${copy.macros(meal.data)}\n${copy.forDay(meal.data.date)}\n\n${copy.confirm}`,
      buttons: [
        { text: copy.save, callback_data: `meal:save:${token}` },
        { text: copy.cancel, callback_data: `meal:cancel:${token}` },
      ],
    });
    console.log('telegram meal: preview sent', summary(userId, meal.data));
  } catch (err) {
    await sendToChat(chatId, failureCopy(err, copy));
  }
}

/** What the server log says about a meal: the numbers, never the photo. */
function summary(userId: string, meal: MealInput) {
  const { meal_name, calories, protein, fat, carbs, date } = meal;
  return { userId, meal_name, calories, protein, fat, carbs, date };
}

/** A tapped button, as much of it as this needs. */
export interface MealCallback {
  id: string;
  fromId: string;
  data: string | undefined;
  /** The preview the button sits under. Missing only on messages too old for Telegram to send. */
  message: { chatId: string; messageId: number } | undefined;
}

/**
 * Only this module's own buttons. The token is the one minted for the preview;
 * anything else — another bot's data, a hand-crafted tap — fails here.
 */
const callbackData = z
  .string()
  .regex(/^meal:(save|cancel):[A-Za-z0-9_-]{22}$/)
  .transform((data) => {
    const [, action, token] = data.split(':') as [string, 'save' | 'cancel', string];
    return { action, token };
  });

export const isMealCallback = (data: string | undefined): boolean =>
  data?.startsWith('meal:') ?? false;

/**
 * Save or Cancel under a preview.
 *
 * The button carries only the token. Which account the meal goes to comes from
 * the preview row the token's hash finds, and it is honoured only while the
 * chat is still linked to that same account, from the chat the preview was
 * sent to, and by the person who sent the photo. Anyone else's tap is answered
 * — Telegram spins the button until it is — and otherwise ignored.
 *
 * Saving claims the row and appends the meal in one transaction, so a double
 * tap or a redelivered update finds nothing to claim the second time.
 */
export async function handleMealCallback(query: MealCallback): Promise<void> {
  const parsed = callbackData.safeParse(query.data);
  const chatId = query.message?.chatId;
  const messageId = query.message?.messageId;
  if (!parsed.success || !chatId || messageId === undefined) {
    await answerCallback(query.id);
    return;
  }
  const { action, token } = parsed.data;

  const link = await prisma.telegramLink.findUnique({
    where: { chatId },
    select: { userId: true },
  });
  if (!link) {
    await answerCallback(query.id);
    return;
  }
  const copy = COPY[await langFor(link.userId)];

  const preview = await prisma.telegramMealPreview.findUnique({
    where: { tokenHash: hash(token) },
  });
  // Replaced by a newer photo, already answered, or meant for another account.
  // Only a toast: the message may be the one a first tap is editing right now.
  if (!preview || preview.chatId !== chatId || preview.userId !== link.userId) {
    await answerCallback(query.id, copy.stale);
    return;
  }
  if (preview.fromId !== query.fromId) {
    await answerCallback(query.id);
    return;
  }

  const meal = mealBody.parse(preview.meal);
  const title = `🍽️ ${meal.meal_name}`;
  const claim = { id: preview.id, tokenHash: preview.tokenHash };

  if (preview.expiresAt <= new Date()) {
    const { count } = await prisma.telegramMealPreview.deleteMany({ where: claim });
    if (count > 0) await editMessage(chatId, messageId, { title, body: copy.expired });
    await answerCallback(query.id, copy.stale);
    return;
  }

  if (action === 'cancel') {
    const { count } = await prisma.telegramMealPreview.deleteMany({ where: claim });
    if (count === 0) {
      await answerCallback(query.id, copy.stale);
      return;
    }
    await editMessage(chatId, messageId, {
      title: `❌ ${meal.meal_name}`,
      body: `${copy.macros(meal)}\n\n${copy.cancelled}`,
    });
    await answerCallback(query.id, copy.cancelledToast);
    console.log('telegram meal: cancelled', summary(link.userId, meal));
    return;
  }

  let saved: boolean;
  try {
    saved = await prisma.$transaction(async (tx) => {
      const { count } = await tx.telegramMealPreview.deleteMany({
        where: { ...claim, expiresAt: { gt: new Date() } },
      });
      if (count === 0) return false;
      await appendMealIn(tx, link.userId, meal);
      return true;
    });
  } catch (err) {
    // The claim rolled back with the meal, so the same tap can be tried again.
    const { body } = failureCopy(err, copy);
    await answerCallback(query.id, body);
    return;
  }
  if (!saved) {
    await answerCallback(query.id, copy.stale);
    return;
  }

  await editMessage(chatId, messageId, {
    title: `✅ ${meal.meal_name}`,
    body: `${copy.macros(meal)}\n\n${copy.saved(meal.date)}`,
    ...(apiEnv.APP_ORIGIN
      ? { buttons: [{ text: copy.openHistory, url: `${apiEnv.APP_ORIGIN.replace(/\/$/, '')}/History` }] }
      : {}),
  });
  await answerCallback(query.id, copy.savedToast);
  console.log('telegram meal: saved', summary(link.userId, meal));
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
