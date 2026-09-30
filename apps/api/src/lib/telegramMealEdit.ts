import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { apiEnv } from '../env.api.js';
import { HttpError } from './errors.js';
import { mealId, mealPatchBody, updateMealIn, type MealPatch } from './meals.js';
import { langFor } from './notifications.js';
import { answerCallback, editMessage, sendToChat, type Button, type Message } from './telegram.js';

/**
 * Fixing a meal the bot just saved, without leaving the chat.
 *
 * The confirmation under a saved meal carries an Edit button. It opens a menu
 * of the meal's fields; tapping one makes the bot wait for the user's next
 * message, which becomes that field's value. The change goes through
 * updateMealIn — the same lookup by id, row lock and merge the app's PATCH
 * /meals/:id runs — so the bot cannot write anything the app could not, and a
 * meal the app has meanwhile deleted is found missing rather than recreated.
 *
 * The state lives in telegram_meal_edits rather than in memory: a deploy
 * restarts the process, and a user halfway through typing a number should not
 * notice.
 */

type Lang = 'ru' | 'en';

export type MealField = 'name' | 'kcal' | 'protein' | 'fat' | 'carbs';
const FIELDS: readonly MealField[] = ['name', 'kcal', 'protein', 'fat', 'carbs'];

/** Which key of the meal each button changes. */
const KEY = {
  name: 'meal_name',
  kcal: 'calories',
  protein: 'protein',
  fat: 'fat',
  carbs: 'carbs',
} as const satisfies Record<MealField, keyof MealPatch>;

/** The meal as the menu shows it. */
interface ShownMeal {
  meal_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const COPY = {
  ru: {
    edit: '✏️ Изменить',
    done: '❌ Готово',
    openHistory: 'Открыть историю',
    button: { name: 'Название', kcal: 'ккал', protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы' },
    /** "для …" — the field in the prompt. */
    fieldName: { name: 'названия', kcal: 'калорий', protein: 'белков', fat: 'жиров', carbs: 'углеводов' },
    values: (m: ShownMeal) =>
      `Название: ${m.meal_name}\nКалории: ${m.calories} ккал\nБелки: ${m.protein} г\nЖиры: ${m.fat} г\nУглеводы: ${m.carbs} г`,
    pick: 'Выбери, что поправить.',
    prompt: (f: MealField) => `Пришли новое значение ${COPY.ru.fieldName[f]}.`,
    waiting: (f: MealField) => `Жду новое значение ${COPY.ru.fieldName[f]} следующим сообщением.`,
    updated: (f: MealField) => `Обновлено ✓ (${COPY.ru.button[f].toLowerCase()})`,
    macros: (m: ShownMeal) =>
      `${m.calories} ккал · белки ${m.protein} г · жиры ${m.fat} г · углеводы ${m.carbs} г`,
    finished: (changed: boolean) =>
      changed ? 'Сохранено в дневник питания, изменения внесены.' : 'Сохранено в дневник питания.',
    finishedToast: 'Готово',
    stale: 'Это уже неактуально. Поправить можно в приложении.',
    gone: {
      title: 'Приём пищи уже изменён',
      body: 'Его уже изменили или удалили в приложении — обнови историю.',
    },
    goneToast: 'Уже изменено в приложении',
    badName: { title: 'Не подходит', body: 'Название — от 1 до 200 символов. Пришли ещё раз.' },
    badNumber: { title: 'Не подходит', body: 'Нужно число, например 250 или 12,5. Пришли ещё раз.' },
    pendingExpired: {
      title: 'Время вышло',
      body: 'Слишком долго ждал значение — ничего не изменено. Нажми поле в меню ещё раз.',
    },
    pickFirst: { title: 'Сначала выбери поле', body: 'Нажми в меню выше, что поправить, потом пришли значение.' },
    stopped: {
      title: 'Изменение отменено',
      body: 'Больше не жду значение, ничего не изменено. /stop ещё раз — отключить бота.',
    },
    photoInterrupts: {
      title: 'Изменение отменено',
      body: 'Больше не жду значение — смотрю новое фото.',
    },
    failed: 'Не получилось сохранить. Попробуй ещё раз чуть позже.',
  },
  en: {
    edit: '✏️ Edit',
    done: '❌ Done',
    openHistory: 'Open history',
    button: { name: 'Name', kcal: 'kcal', protein: 'Protein', fat: 'Fat', carbs: 'Carbs' },
    fieldName: { name: 'the name', kcal: 'calories', protein: 'protein', fat: 'fat', carbs: 'carbs' },
    values: (m: ShownMeal) =>
      `Name: ${m.meal_name}\nCalories: ${m.calories} kcal\nProtein: ${m.protein} g\nFat: ${m.fat} g\nCarbs: ${m.carbs} g`,
    pick: 'Pick what to change.',
    prompt: (f: MealField) => `Send the new value for ${COPY.en.fieldName[f]}.`,
    waiting: (f: MealField) => `Waiting for the new value for ${COPY.en.fieldName[f]} in your next message.`,
    updated: (f: MealField) => `Updated ✓ (${COPY.en.fieldName[f]})`,
    macros: (m: ShownMeal) =>
      `${m.calories} kcal · protein ${m.protein} g · fat ${m.fat} g · carbs ${m.carbs} g`,
    finished: (changed: boolean) =>
      changed ? 'Saved to your meal log, with your changes.' : 'Saved to your meal log.',
    finishedToast: 'Done',
    stale: 'This is no longer active. You can edit it in the app.',
    gone: {
      title: 'This meal has changed',
      body: 'It was already changed or deleted in the app — refresh your history.',
    },
    goneToast: 'Already changed in the app',
    badName: { title: 'That does not fit', body: 'The name takes 1 to 200 characters. Send it again.' },
    badNumber: { title: 'That does not fit', body: 'A number is needed, like 250 or 12.5. Send it again.' },
    pendingExpired: {
      title: 'Time ran out',
      body: 'That took a while, so nothing was changed. Tap the field in the menu again.',
    },
    pickFirst: { title: 'Pick a field first', body: 'Tap what to change in the menu above, then send the value.' },
    stopped: {
      title: 'Edit cancelled',
      body: 'No longer waiting for a value; nothing was changed. Send /stop again to disconnect the bot.',
    },
    photoInterrupts: {
      title: 'Edit cancelled',
      body: 'No longer waiting for a value — looking at the new photo.',
    },
    failed: 'Could not save that. Try again in a little while.',
  },
} as const;

/**
 * How long the Edit button under a saved meal keeps working. The meal is in the
 * app either way; this only bounds how long a row sits here for it.
 */
const EDIT_TTL_MS = 24 * 60 * 60 * 1000;
/** How long the bot waits for the value after a field is tapped. */
export const PENDING_TTL_MS = 15 * 60 * 1000;
/** 22 characters as base64url, the same as the preview's. */
const TOKEN_BYTES = 16;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

function historyButton(text: string): Button[] {
  return apiEnv.APP_ORIGIN ? [{ text, url: `${apiEnv.APP_ORIGIN.replace(/\/$/, '')}/History` }] : [];
}

/**
 * Opens the edit session for a meal the bot has just saved, inside the save's
 * own transaction, and returns the confirmation's buttons: Edit, and the link
 * to the history. One session per chat — this replaces any earlier one.
 */
export async function openMealEdit(
  tx: Prisma.TransactionClient,
  session: { chatId: string; userId: string; fromId: string; mealId: string; messageId: number },
  lang: Lang,
): Promise<Button[]> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const row = {
    ...session,
    tokenHash: hash(token),
    field: null,
    pendingUntil: null,
    changed: false,
    expiresAt: new Date(Date.now() + EDIT_TTL_MS),
  };
  await tx.telegramMealEdit.upsert({
    where: { chatId: session.chatId },
    create: row,
    update: row,
  });
  return [{ text: COPY[lang].edit, callback_data: `mealedit:open:${token}` }, ...historyButton(COPY[lang].openHistory)];
}

/** The meal as it is now in meal_history, or null once it is not there. */
async function currentMeal(userId: string, id: string): Promise<ShownMeal | null> {
  const row = await prisma.questData.findUnique({ where: { userId }, select: { mealHistory: true } });
  const meals = Array.isArray(row?.mealHistory) ? (row.mealHistory as Record<string, unknown>[]) : [];
  const meal = meals.find((m) => mealId(m) === id);
  if (!meal) return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    meal_name: typeof meal.meal_name === 'string' ? meal.meal_name : '',
    calories: n(meal.calories),
    protein: n(meal.protein),
    fat: n(meal.fat),
    carbs: n(meal.carbs),
  };
}

/** The field menu: current values, an optional note, a row per field and Done. */
function menu(lang: Lang, meal: ShownMeal, token: string, note: string): Message {
  const copy = COPY[lang];
  return {
    title: `✏️ ${meal.meal_name}`,
    body: `${copy.values(meal)}\n\n${note}`,
    rows: [
      ...FIELDS.map((f) => [{ text: copy.button[f], callback_data: `mealedit:${f}:${token}` }]),
      [{ text: copy.done, callback_data: `mealedit:done:${token}` }],
    ],
  };
}

function goneMessage(lang: Lang): Message {
  return { ...COPY[lang].gone, rows: [historyButton(COPY[lang].openHistory)] };
}

/** What the server log says about a change: which meal, which field, the value — no ids of Telegram's. */
function logUpdate(userId: string, id: string, patch: MealPatch) {
  console.log('telegram meal: updated', { userId, mealId: id, ...patch });
}

/** A tapped button of this module's, as much of it as this needs. */
export interface MealEditCallback {
  id: string;
  fromId: string;
  data: string | undefined;
  message: { chatId: string; messageId: number } | undefined;
}

const callbackData = z
  .string()
  .regex(/^mealedit:(open|done|name|kcal|protein|fat|carbs):[A-Za-z0-9_-]{22}$/)
  .transform((data) => {
    const [, action, token] = data.split(':') as [string, 'open' | 'done' | MealField, string];
    return { action, token };
  });

export const isMealEditCallback = (data: string | undefined): boolean =>
  data?.startsWith('mealedit:') ?? false;

/**
 * Edit, a field, or Done under a saved meal.
 *
 * The same gatekeeping as the preview's buttons: the token finds the session,
 * and it is honoured only in the chat it was opened in, while that chat is
 * still linked to the same account, and from the person who saved the meal.
 * Every tap is answered, whoever it is from.
 *
 * Tapping a field only arms the wait; nothing is written until the value
 * arrives. A second tap — on the same field or another — just re-arms it, so
 * there is nothing to apply twice.
 */
export async function handleMealEditCallback(query: MealEditCallback): Promise<void> {
  const parsed = callbackData.safeParse(query.data);
  const chatId = query.message?.chatId;
  const messageId = query.message?.messageId;
  if (!parsed.success || !chatId || messageId === undefined) {
    await answerCallback(query.id);
    return;
  }
  const { action, token } = parsed.data;

  const link = await prisma.telegramLink.findUnique({ where: { chatId }, select: { userId: true } });
  if (!link) {
    await answerCallback(query.id);
    return;
  }
  const lang: Lang = await langFor(link.userId);
  const copy = COPY[lang];

  const session = await prisma.telegramMealEdit.findUnique({ where: { tokenHash: hash(token) } });
  if (!session || session.chatId !== chatId || session.userId !== link.userId) {
    await answerCallback(query.id, copy.stale);
    return;
  }
  if (session.fromId !== query.fromId) {
    await answerCallback(query.id);
    return;
  }
  const claim = { id: session.id, tokenHash: session.tokenHash };

  if (session.expiresAt <= new Date()) {
    await prisma.telegramMealEdit.deleteMany({ where: claim });
    await answerCallback(query.id, copy.stale);
    return;
  }

  const meal = await currentMeal(link.userId, session.mealId);
  if (!meal) {
    const { count } = await prisma.telegramMealEdit.deleteMany({ where: claim });
    if (count > 0) await editMessage(chatId, messageId, goneMessage(lang));
    await answerCallback(query.id, copy.goneToast);
    return;
  }

  if (action === 'done') {
    const { count } = await prisma.telegramMealEdit.deleteMany({ where: claim });
    if (count === 0) {
      await answerCallback(query.id, copy.stale);
      return;
    }
    await editMessage(chatId, messageId, {
      title: `✅ ${meal.meal_name}`,
      body: `${copy.macros(meal)}\n\n${copy.finished(session.changed)}`,
      rows: [historyButton(copy.openHistory)],
    });
    await answerCallback(query.id, copy.finishedToast);
    console.log('telegram meal: edit finished', { userId: link.userId, mealId: session.mealId });
    return;
  }

  const field = action === 'open' ? null : action;
  const { count } = await prisma.telegramMealEdit.updateMany({
    where: claim,
    data: {
      messageId,
      field,
      pendingUntil: field ? new Date(Date.now() + PENDING_TTL_MS) : null,
    },
  });
  if (count === 0) {
    await answerCallback(query.id, copy.stale);
    return;
  }
  await editMessage(chatId, messageId, menu(lang, meal, token, field ? copy.waiting(field) : copy.pick));
  await answerCallback(query.id, field ? copy.prompt(field) : undefined);
}

/**
 * Stops waiting for a value, if the bot was. For /stop and a new photo, which
 * both mean the user has moved on; the menu itself stays usable. Says so, and
 * returns whether there was anything to stop.
 */
export async function cancelPendingEdit(chatId: string, reason: 'stop' | 'photo'): Promise<boolean> {
  const { count } = await prisma.telegramMealEdit.updateMany({
    where: { chatId, field: { not: null }, pendingUntil: { gt: new Date() } },
    data: { field: null, pendingUntil: null },
  });
  if (count === 0) return false;
  const session = await prisma.telegramMealEdit.findUnique({ where: { chatId }, select: { userId: true } });
  const lang: Lang = session ? await langFor(session.userId) : 'ru';
  await sendToChat(chatId, reason === 'stop' ? COPY[lang].stopped : COPY[lang].photoInterrupts);
  return true;
}

/**
 * "250", "250 kcal", "12,5 g" — a number, perhaps with its unit. Rounded the way
 * the app's save rounds; the range is mealPatchBody's to judge.
 */
const NUMBER = /^(\d{1,7}(?:[.,]\d+)?)\s*(?:kcal|cal|ккал|кал|g|gr|г|гр)?\.?$/i;

/** The patch a message means for a field, or null when it means nothing valid. */
export function parseValue(field: MealField, text: string): MealPatch | null {
  let value: string | number;
  if (field === 'name') {
    value = text.trim();
  } else {
    const match = NUMBER.exec(text.trim());
    if (!match) return null;
    value = Math.round(Number(match[1]!.replace(',', '.')));
  }
  const parsed = mealPatchBody.safeParse({ [KEY[field]]: value });
  return parsed.success ? parsed.data : null;
}

/**
 * A text message, which may be the value the bot is waiting for. Returns false
 * when this chat has no edit going on, so the caller answers it as it would
 * have anyway.
 *
 * Applying claims the wait and changes the meal in one transaction: two
 * messages arriving together find one wait to claim, and a change that fails
 * leaves the wait armed for the user to try again.
 */
export async function handleMealEditText(chatId: string, fromId: string, text: string): Promise<boolean> {
  const link = await prisma.telegramLink.findUnique({ where: { chatId }, select: { userId: true } });
  if (!link) return false;
  const session = await prisma.telegramMealEdit.findUnique({ where: { chatId } });
  const now = new Date();
  if (
    !session ||
    session.userId !== link.userId ||
    session.fromId !== fromId ||
    session.expiresAt <= now
  ) {
    return false;
  }
  const lang: Lang = await langFor(link.userId);
  const copy = COPY[lang];

  const field = FIELDS.find((f) => f === session.field);
  if (!field || !session.pendingUntil) {
    await sendToChat(chatId, copy.pickFirst);
    return true;
  }
  if (session.pendingUntil <= now) {
    await prisma.telegramMealEdit.updateMany({
      where: { id: session.id, field: session.field },
      data: { field: null, pendingUntil: null },
    });
    await sendToChat(chatId, copy.pendingExpired);
    return true;
  }

  const patch = parseValue(field, text);
  if (!patch) {
    // Still waiting: the next message gets another go.
    await sendToChat(chatId, field === 'name' ? copy.badName : copy.badNumber);
    return true;
  }

  // Only the token's hash is kept, so the menu drawn after the change carries a
  // fresh one, swapped in by the same claim. The buttons it replaces are in the
  // same message and go with the edit.
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  let outcome: 'updated' | 'stale' | 'gone';
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const { count } = await tx.telegramMealEdit.updateMany({
        where: { id: session.id, tokenHash: session.tokenHash, field, pendingUntil: { gt: new Date() } },
        data: { field: null, pendingUntil: null, changed: true, tokenHash: hash(token) },
      });
      if (count === 0) return 'stale';
      const row = await updateMealIn(tx, link.userId, session.mealId, patch);
      return row ? 'updated' : 'gone';
    });
  } catch (err) {
    // Onboarding undone underneath the edit: lockMeals finds no row at all.
    if (err instanceof HttpError && err.code === 'not_found') {
      outcome = 'gone';
    } else {
      console.error('telegram meal edit failed:', err instanceof Error ? err.message : err);
      await sendToChat(chatId, { title: '⚠️', body: copy.failed });
      return true;
    }
  }

  // Another message got there first and is answering already.
  if (outcome === 'stale') return true;

  if (outcome === 'gone') {
    await prisma.telegramMealEdit.deleteMany({ where: { id: session.id } });
    const edited = await editMessage(chatId, session.messageId, goneMessage(lang));
    if (!edited) await sendToChat(chatId, copy.gone);
    console.log('telegram meal: edit found the meal gone', { userId: link.userId, mealId: session.mealId });
    return true;
  }

  logUpdate(link.userId, session.mealId, patch);
  const meal = await currentMeal(link.userId, session.mealId);
  if (meal) {
    await editMessage(chatId, session.messageId, menu(lang, meal, token, `${copy.updated(field)}\n${copy.pick}`));
  }
  return true;
}
