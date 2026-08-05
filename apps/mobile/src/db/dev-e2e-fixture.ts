import { and, eq, ne } from 'drizzle-orm';

import { setSetting } from './repositories/settings';
import { userFinancialInstitutions } from './schema';
import type { AppDatabase } from './types';

/**
 * `__DEV__`-only fixture support for the Maestro E2E suite (implementation plan for issue #22,
 * Decision 6, Decision 8, Layer-by-Layer "Database / Data Layer"). Lives in `src/db` — not
 * `src/dev` — because it is the one place allowed to touch SQL directly (`dbAccessBoundary`);
 * `src/dev/e2e-fixture-store.ts` is a thin `getAppDatabase()`-calling wrapper around the
 * functions here, mirroring the `app/ → feature hooks → src/db` layering `src/db/dev-fixture.ts`
 * and `src/db/dev-connect-fixture.ts` already established for the other `__DEV__` fixture
 * surfaces.
 *
 * `stage-queue-v1.sql` and `transaction-detail-v1.sql` are already `INSERT OR REPLACE` deltas
 * (their own header comments say re-applying is a no-op) — unlike `store-v1.sql`, they need no
 * upsert-rewriting the way `src/db/dev-fixture.ts`'s `loadSampleFixture` performs. Applying them
 * is therefore just "run every statement in the file", once per line, inside one transaction.
 */

/** Matches one non-empty, non-comment `INSERT OR REPLACE INTO … VALUES (…);` fixture line. Both
 * `stage-queue-v1.sql` and `transaction-detail-v1.sql` write exactly one statement per line
 * (verified against both committed files), so a per-line split is sufficient — no SQL parser is
 * needed. */
function splitFixtureStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--'));
}

/**
 * Applies an inlined `.sql` delta — `stage-queue-v1.sql` or `transaction-detail-v1.sql` — against
 * an already-bootstrapped store, in one transaction. Idempotent by construction: every statement
 * in both files is `INSERT OR REPLACE`, so a repeat application converges rather than
 * accumulates (implementation plan D6's "idempotent because" column).
 */
export function applyFixtureSql(db: AppDatabase, sql: string): void {
  const statements = splitFixtureStatements(sql);
  db.transaction((tx: AppDatabase) => {
    for (const statement of statements) {
      tx.run(statement);
    }
  });
}

/**
 * Deletes any `user_financial_institutions` row for `institutionId` whose id is not
 * `fixtureOwnedId` — found on device (implementation plan for issue #22, first real run):
 * `user_financial_institutions_institution_unique` (`schema.ts`) allows at most one row per
 * institution, but `loadSampleFixture`'s upsert (`src/db/dev-fixture.ts`) is scoped only to its
 * own literal `id`, not to that separate unique index. Applying `synced-home` after `scripted-read`
 * (or after a real connect, both of which reach the same institution row through
 * `upsertConnection`, keyed on the institution) would otherwise throw a unique-constraint
 * violation instead of converging. Reclaiming the row first is the "synced-home" fixture's own
 * idempotent-because guarantee (D6): the fixture always ends up owning exactly the row its own
 * `.sql` file names, regardless of what another fixture surface planted first.
 */
export function reclaimInstitutionRowForFixture(
  db: AppDatabase,
  institutionId: string,
  fixtureOwnedId: string,
): void {
  db.delete(userFinancialInstitutions)
    .where(
      and(
        eq(userFinancialInstitutions.financialInstitutionId, institutionId),
        ne(userFinancialInstitutions.id, fixtureOwnedId),
      ),
    )
    .run();
}

/**
 * Sets `app_settings.onboarding_completed` to an explicit literal value (implementation plan D6).
 * `src/db/repositories/settings.ts` only exports a one-way `markOnboardingCompleted()` (`→ true`,
 * item #8's launch gate never needs to go back to `false`) — the `reset` fixture state is the one
 * caller in this codebase that legitimately needs the reverse, to simulate a first launch.
 */
export function setOnboardingCompleted(db: AppDatabase, value: boolean): void {
  setSetting(db, 'onboarding_completed', value);
}
