import { inArray } from 'drizzle-orm';

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
 *
 * Ownership (found in review): `simulateSyncError` and `clearSampleFixture` must never touch a
 * row this fixture did not create — once item #10 (sync engine) ships, a real connection or a
 * real movement could coexist with the loaded sample data, and blindly updating/deleting by
 * table would corrupt or destroy it (Non-negotiable 3 — a movement is only ever excluded, never
 * deleted). Every fixture-owned id is derived by re-parsing the same immutable `fixtureSql` each
 * call, rather than tracked as separate runtime state, because the fixture text is a static
 * asset and its ids are exactly the deterministic ids `store-v1.sql` documents.
 */
const SAMPLE_DATA_TABLES = ['user_financial_institutions', 'user_financial_products', 'transactions'] as const;

/** The default error code the "Simular error de sincronización" action writes. Not a real
 * scraper error code — this dev panel never runs a real sync. */
export const SAMPLE_SYNC_ERROR_CODE = 'dev_simulated_error';

/** Matches one `INSERT INTO "<table>" (...) VALUES ('<id>', ...)` fixture line, capturing the
 * table name and the `id` column's literal value — always the first column and the first
 * `VALUES` literal in `store-v1.sql` (verified against every table `loadSampleFixture` reads). */
const INSERT_LINE_PATTERN = /^INSERT INTO "([a-z_]+)" \([^)]*\) VALUES \('([^']+)'/;

/** Every fixture `INSERT` line, parsed once per call into `{ table, id }` pairs. Shared by
 * {@link loadSampleFixture} (which needs the whole statement) and the ownership-scoped
 * `simulateSyncError` / `clearSampleFixture` (which only need the ids). */
function parseFixtureRows(fixtureSql: string): { table: string; id: string; statement: string }[] {
  const rows: { table: string; id: string; statement: string }[] = [];
  for (const rawLine of fixtureSql.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const match = INSERT_LINE_PATTERN.exec(line);
    if (match === null) continue;
    const [, table, id] = match;
    if (table === undefined || id === undefined) continue;
    if (!(SAMPLE_DATA_TABLES as readonly string[]).includes(table)) continue;
    rows.push({ table, id, statement: line });
  }
  return rows;
}

function fixtureIdsForTable(fixtureSql: string, table: (typeof SAMPLE_DATA_TABLES)[number]): string[] {
  return parseFixtureRows(fixtureSql)
    .filter((row) => row.table === table)
    .map((row) => row.id);
}

/**
 * Executes only the `INSERT OR IGNORE INTO` statements for {@link SAMPLE_DATA_TABLES}, in one
 * transaction. `OR IGNORE` makes a second "Cargar datos de ejemplo" tap a safe no-op instead of a
 * primary/unique-key violation (found in review) — the fixture's ids are deterministic, so a
 * repeat load can only ever re-describe rows that already exist, never create duplicates.
 */
export function loadSampleFixture(db: AppDatabase, fixtureSql: string): void {
  const statements = parseFixtureRows(fixtureSql).map((row) =>
    row.statement.replace(/^INSERT INTO/, 'INSERT OR IGNORE INTO'),
  );

  db.transaction((tx: AppDatabase) => {
    for (const statement of statements) {
      tx.run(statement);
    }
  });
}

/** Marks only the fixture-owned connection(s) as failed, so `#screen=home&state=sync-error` is
 * reachable — never a real connection (found in review). */
export function simulateSyncError(
  db: AppDatabase,
  fixtureSql: string,
  errorCode: string = SAMPLE_SYNC_ERROR_CODE,
): void {
  const ids = fixtureIdsForTable(fixtureSql, 'user_financial_institutions');
  if (ids.length === 0) return;
  db.update(userFinancialInstitutions)
    .set({ syncStatus: 'error', lastErrorCode: errorCode })
    .where(inArray(userFinancialInstitutions.id, ids))
    .run();
}

/** Removes only the fixture-owned connection, products and movements, restoring the pre-fixture
 * (`#screen=home&state=empty`-reachable) state. Never touches the seeded starter catalogue, and —
 * per Non-negotiable 3 and item #12's Decision 11 — never touches a real connection or a real
 * movement a genuine sync (item #10) may have written alongside the sample data. */
export function clearSampleFixture(db: AppDatabase, fixtureSql: string): void {
  const transactionIds = fixtureIdsForTable(fixtureSql, 'transactions');
  const productIds = fixtureIdsForTable(fixtureSql, 'user_financial_products');
  const institutionIds = fixtureIdsForTable(fixtureSql, 'user_financial_institutions');

  db.transaction((tx: AppDatabase) => {
    if (transactionIds.length > 0) {
      tx.delete(transactions).where(inArray(transactions.id, transactionIds)).run();
    }
    if (productIds.length > 0) {
      tx.delete(userFinancialProducts).where(inArray(userFinancialProducts.id, productIds)).run();
    }
    if (institutionIds.length > 0) {
      tx.delete(userFinancialInstitutions).where(inArray(userFinancialInstitutions.id, institutionIds)).run();
    }
  });
}
