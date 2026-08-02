import { transactions, userFinancialInstitutions, userFinancialProducts } from './schema';
import type { AppDatabase } from './types';

/**
 * `__DEV__`-only sample-data support for the home-screen smoke runbook (implementation plan for
 * issue #12, Decision 11). Lives in `src/db` — not `src/dev` — because it is the one place
 * allowed to touch SQL directly (`dbAccessBoundary`); `src/dev/sample-store.ts` is a thin
 * `getAppDatabase()`-calling wrapper around the three functions here, mirroring the
 * `app/ → feature hooks → src/db` layering for this dev-only surface.
 *
 * `apps/mobile/src/db/__fixtures__/store-v1.sql` is a **full bootstrapped-store snapshot** —
 * `users`, the seeded catalogue (`financial_institutions`, `transaction_categories`,
 * `merchants`, `merchant_aliases`), `seed_ledger` and `app_settings` are already present on a
 * real device from `ensureDatabaseReady()`. Loading the whole fixture verbatim would violate
 * every one of those tables' primary/unique keys. Only the three tables that describe a bank
 * *sync result* — connection, products, movements — are genuinely new; everything else is
 * filtered out.
 */
const SAMPLE_DATA_TABLES = ['user_financial_institutions', 'user_financial_products', 'transactions'] as const;

/** The default error code the "Simular error de sincronización" action writes. Not a real
 * scraper error code — this dev panel never runs a real sync. */
export const SAMPLE_SYNC_ERROR_CODE = 'dev_simulated_error';

/**
 * Executes only the `INSERT INTO` statements for {@link SAMPLE_DATA_TABLES}, in one transaction.
 * Each fixture line is already a complete, semicolon-terminated statement with literal values —
 * no parameterization is needed, so `db.run(statement)` executes it directly.
 */
export function loadSampleFixture(db: AppDatabase, fixtureSql: string): void {
  const statements = fixtureSql
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        SAMPLE_DATA_TABLES.some((table) => line.startsWith(`INSERT INTO "${table}"`)),
    );

  db.transaction((tx: AppDatabase) => {
    for (const statement of statements) {
      tx.run(statement);
    }
  });
}

/** Marks every loaded connection as failed, so `#screen=home&state=sync-error` is reachable. */
export function simulateSyncError(db: AppDatabase, errorCode: string = SAMPLE_SYNC_ERROR_CODE): void {
  db.update(userFinancialInstitutions).set({ syncStatus: 'error', lastErrorCode: errorCode }).run();
}

/** Removes every sample connection, product and movement, restoring the pre-fixture
 * (`#screen=home&state=empty`-reachable) state. Never touches the seeded starter catalogue. */
export function clearSampleFixture(db: AppDatabase): void {
  db.transaction((tx: AppDatabase) => {
    tx.delete(transactions).run();
    tx.delete(userFinancialProducts).run();
    tx.delete(userFinancialInstitutions).run();
  });
}
