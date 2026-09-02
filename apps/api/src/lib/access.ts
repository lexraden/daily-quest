import { prisma } from '../db.js';
import { env } from '../env.js';
import { forbidden, HttpError } from './errors.js';

const TRIAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The same rule as the frontend's usePremiumStatus, evaluated against the
 * database instead of client state. The browser copy drives what the UI offers;
 * this one decides whether the call actually runs, so flipping a local flag no
 * longer buys anyone OpenAI credit.
 */
export async function requireAiAccess(userId: string): Promise<void> {
  const row = await prisma.questData.findUnique({
    where: { userId },
    select: { isPremium: true, trialStartedAt: true },
  });

  if (!row) throw forbidden('Finish onboarding first', 'onboarding_required');
  if (row.isPremium) return;

  const startedAt = row.trialStartedAt?.getTime();
  if (startedAt && Date.now() - startedAt < TRIAL_DAYS * MS_PER_DAY) return;

  throw forbidden('Your free trial has ended — upgrade to keep using this', 'premium_required');
}

const period = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/**
 * Monthly ceiling per user, counted after the access check and before the call.
 * A burst is handled by the per-route rate limit; this is the spend backstop.
 */
export async function countAiCall(userId: string): Promise<void> {
  const usage = await prisma.aiUsage.upsert({
    where: { userId_period: { userId, period: period() } },
    create: { userId, period: period(), calls: 1 },
    update: { calls: { increment: 1 } },
  });

  if (usage.calls > env.AI_MONTHLY_CALL_LIMIT) {
    throw new HttpError(
      429,
      'You have reached this month’s limit for AI features',
      'ai_quota_exceeded',
    );
  }
}
