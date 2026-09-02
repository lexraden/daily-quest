import { prisma } from '../db.js';
import { apiEnv } from '../env.api.js';
import { forbidden, HttpError, unauthorized } from './errors.js';

export const TRIAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The same rule as the frontend's usePremiumStatus, evaluated against the
 * database instead of client state. The browser copy drives what the UI offers;
 * this one decides whether the call actually runs, so flipping a local flag no
 * longer buys anyone OpenAI credit.
 *
 * The clock starts at the first AI call rather than at onboarding completion.
 * Generating the opening set of quests is itself an AI call made before any
 * quest data exists, so gating on that row would lock new users out — but
 * simply never onboarding must not buy an unexpiring trial either.
 */
export async function requireAiAccess(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, trialStartedAt: true },
  });

  if (!user) throw unauthorized('Account no longer exists');
  if (user.isPremium) return;

  if (!user.trialStartedAt) {
    // First AI call: start the trial now and let this one through. The
    // conditional update means concurrent first calls cannot restart it.
    await prisma.user.updateMany({
      where: { id: userId, trialStartedAt: null },
      data: { trialStartedAt: new Date() },
    });
    return;
  }

  if (Date.now() - user.trialStartedAt.getTime() < TRIAL_DAYS * MS_PER_DAY) return;

  throw forbidden('Your free trial has ended — upgrade to keep using this', 'premium_required');
}

const period = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/**
 * Monthly ceiling per user. Checked before the call and incremented only after
 * it succeeds, so a failed OpenAI request costs the user nothing and an
 * over-limit caller cannot inflate the counter by retrying.
 */
export async function assertAiQuota(userId: string): Promise<void> {
  const usage = await prisma.aiUsage.findUnique({
    where: { userId_period: { userId, period: period() } },
    select: { calls: true },
  });

  if ((usage?.calls ?? 0) >= apiEnv.AI_MONTHLY_CALL_LIMIT) {
    throw new HttpError(
      429,
      'You have reached this month’s limit for AI features',
      'ai_quota_exceeded',
    );
  }
}

export async function recordAiCall(userId: string): Promise<void> {
  await prisma.aiUsage.upsert({
    where: { userId_period: { userId, period: period() } },
    create: { userId, period: period(), calls: 1 },
    update: { calls: { increment: 1 } },
  });
}
