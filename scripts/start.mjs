/**
 * Picks what this container is: the API, or the reminders job.
 *
 * Railway's own mechanism for this is a per-service config-as-code file, and
 * `railway.reminders.json` is still there and still the primary route. This
 * exists because that setting is one field on one service that nothing in the
 * repository can assert, and getting it wrong is silent in the worst way: the
 * cron service inherits the API's start command, runs `prisma migrate deploy`,
 * binds a port, and dies on API secrets it was never meant to have. That
 * happened twice.
 *
 * So the same question is answerable a second way, by a variable:
 *
 *   SERVICE_ROLE=reminders   -> run the job and exit
 *   anything else, or unset  -> run the API
 *
 * The two do not fight. A service whose config-as-code points at
 * railway.reminders.json never reaches this file — that config names
 * `npm run reminders` directly. This only decides for a service running the
 * root railway.json's start command, where the default has to stay the API:
 * the web service is the one that must keep working if nobody sets anything.
 */

import { spawn } from 'node:child_process';

const role = (process.env.SERVICE_ROLE || '').trim().toLowerCase();
const isReminders = role === 'reminders';

/**
 * The job deliberately does not run migrations. Schema changes belong to the
 * deploy that ships them, applied once by the API, not by a cron container
 * waking up on its own schedule and racing it.
 */
const command = isReminders
  ? ['npm', ['run', 'reminders', '--workspace', 'apps/api']]
  : ['npm', ['run', 'start', '--workspace', 'apps/api']];

console.log(`starting as ${isReminders ? 'reminders job' : 'api'}`);

/**
 * `detached` puts the child in its own process group, which is the only reason
 * the signal handling below works.
 *
 * What runs underneath is `npm run` -> `sh -c` -> `node`, and npm does not pass
 * signals down. Signalling the child alone killed npm and left the server
 * running, holding its port and its database connections, until the container
 * was killed outright — verified by doing exactly that. Signalling the group
 * reaches the node process that actually matters.
 */
const child = spawn(command[0], command[1], { stdio: 'inherit', detached: true });

// Railway sends SIGTERM when it stops a container; passing it on lets the
// server close its database connections instead of being killed mid-query.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // The group is already gone, or this platform has no process groups.
      child.kill(signal);
    }
  });
}

child.on('exit', (code, signal) => {
  // A process killed by a signal has no exit code; report it the way a shell
  // would, so Railway sees a stop rather than a success.
  process.exit(signal ? 128 + (signal === 'SIGINT' ? 2 : 15) : (code ?? 1));
});
