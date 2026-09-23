/**
 * Grants Pro to the earliest accounts.
 *
 * A one-off for the launch: the people who showed up first get a paid account
 * rather than a three-day trial. Run it from the API service, where
 * DATABASE_URL already points at the right database:
 *
 *   npm run grant-pro --workspace apps/api               # the first 5
 *   npm run grant-pro --workspace apps/api -- --count=10
 *   npm run grant-pro --workspace apps/api -- --dry-run  # look, change nothing
 *   npm run grant-pro --workspace apps/api -- --revoke   # undo it
 *
 * It always prints the accounts it matched before touching anything, because
 * "the first five" is a guess about who those people are until you see the
 * emails.
 *
 * Nothing here is baked into a session: the access gate reads is_premium from
 * the database on every AI call, so a user who is signed in right now gets
 * access without signing in again. The badge in the app follows on the next
 * time it loads its quest data.
 */

import { prisma } from '../db.js';

/** Guests are throwaway accounts from GUEST_LOGIN_ENABLED, not early users. */
const GUEST_PREFIX = 'guest:';

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : '';
}

async function main() {
  const dryRun = arg('dry-run') !== undefined;
  const revoke = arg('revoke') !== undefined;
  const count = Number(arg('count') || 5);

  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    console.error('--count must be a whole number between 1 and 1000');
    process.exit(2);
  }

  /**
   * Oldest first, guests excluded. Ordered by id as well as time so two
   * accounts created in the same millisecond cannot swap places between a
   * dry run and the real one.
   */
  const users = await prisma.user.findMany({
    where: { NOT: { googleSub: { startsWith: GUEST_PREFIX } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: count,
    select: { id: true, email: true, fullName: true, isPremium: true, createdAt: true },
  });

  if (users.length === 0) {
    console.log('No accounts yet — nothing to grant.');
    return;
  }

  const want = !revoke;
  console.log(`${revoke ? 'Revoking' : 'Granting'} Pro for the first ${users.length} account(s):\n`);
  for (const [index, user] of users.entries()) {
    const already = user.isPremium === want;
    console.log(
      `  ${String(index + 1).padStart(2)}. ${user.email.padEnd(34)} ` +
        `${user.createdAt.toISOString().slice(0, 10)}  ` +
        `${already ? 'already ' + (want ? 'Pro' : 'free') : want ? '→ Pro' : '→ free'}`,
    );
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was changed.');
    return;
  }

  // Only the rows that actually need it, so the count printed below is the
  // number of people whose access changed rather than the number matched.
  const { count: changed } = await prisma.user.updateMany({
    where: { id: { in: users.map((u) => u.id) }, isPremium: !want },
    data: { isPremium: want },
  });

  console.log(`\n${changed} account(s) changed, ${users.length - changed} already were.`);
}

main()
  .catch((err) => {
    console.error('grant-pro failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
