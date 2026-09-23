-- Grants Pro to the five earliest accounts: the people who showed up at launch
-- get a paid account instead of a three-day trial.
--
-- This is the same selection scripts/grantPro.ts makes, written as a migration
-- because that is the only thing that reliably runs against the production
-- database: `prisma migrate deploy` is the first half of the API's start
-- command, so the grant lands on the next deploy with nobody having to open a
-- shell. The script stays for later adjustments (--count, --revoke).
--
-- Guests are excluded: GUEST_LOGIN_ENABLED mints throwaway accounts with a
-- 'guest:' google_sub, and they are not early users.
--
-- Ordered by id as well as created_at so two accounts created in the same
-- millisecond cannot swap places. `is_premium = false` in the outer predicate
-- makes this a no-op on an account that already has it.
UPDATE "users"
   SET "is_premium" = true,
       "updated_at" = now()
 WHERE "is_premium" = false
   AND "id" IN (
         SELECT "id"
           FROM "users"
          WHERE "google_sub" NOT LIKE 'guest:%'
          ORDER BY "created_at" ASC, "id" ASC
          LIMIT 5
       );
