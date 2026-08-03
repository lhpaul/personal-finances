import { inArray } from 'drizzle-orm';

import { transactions, userFinancialInstitutions } from './schema';
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
 * table would corrupt or destroy it. Every fixture-owned id is derived by re-parsing the same
 * immutable `fixtureSql` each call, rather than tracked as separate runtime state, because the
 * fixture text is a static asset and its ids are exactly the deterministic ids `store-v1.sql`
 * documents.
 *
 * **`clearSampleFixture` never deletes a `transactions` row** (found in review, round 2 —
 * Non-negotiable 3: "Bank movements are never deleted — only excluded from analysis, with a
 * reason", which applies to every row in this table, fixture-owned or not). "Vaciar datos de
 * ejemplo" instead marks every fixture-owned movement excluded and resets the fixture-owned
 * connection's sync bookkeeping to "never synced", which is what actually makes
 * `#screen=home&state=empty` reachable again (`resolveHomeState` keys off `lastSuccessAt`, not
 * off whether any movement rows exist). `loadSampleFixture` is an `ON CONFLICT … DO UPDATE`
 * upsert rather than an `OR IGNORE` insert specifically so that a later "Cargar datos de
 * ejemplo" resets those same rows back to the fixture's own literal values — un-excluding the
 * movements and restoring the connection's original sync bookkeeping — undoing whatever a prior
 * "Simular error de sincronización" or "Vaciar datos de ejemplo" left behind.
 */
const SAMPLE_DATA_TABLES = ['user_financial_institutions', 'user_financial_products', 'transactions'] as const;

/** The default error code the "Simular error de sincronización" action writes. Not a real
 * scraper error code — this dev panel never runs a real sync. */
export const SAMPLE_SYNC_ERROR_CODE = 'dev_simulated_error';

/** The reason "Vaciar datos de ejemplo" records on every fixture movement it excludes — one of
 * the schema's real `exclusion_reason` values (`'other'`), since this action has no more specific
 * category of its own. */
const CLEAR_EXCLUSION_REASON = 'other';
const CLEAR_EXCLUSION_NOTE = 'Datos de ejemplo vaciados desde el panel de desarrollo';

interface FixtureRow {
  table: (typeof SAMPLE_DATA_TABLES)[number];
  id: string;
  columns: string[];
  statement: string;
}

/** Matches one `INSERT INTO "<table>" (col1, col2, …) VALUES ('<id>', …)` fixture line, capturing
 * the table name, its column list, and the `id` column's literal value — always the first column
 * and the first `VALUES` literal in `store-v1.sql` (verified against every table this module
 * reads). */
const INSERT_LINE_PATTERN = /^INSERT INTO "([a-z_]+)" \(([^)]*)\) VALUES \('([^']+)'/;

/** Every fixture `INSERT` line for {@link SAMPLE_DATA_TABLES}, parsed once per call. Shared by
 * {@link loadSampleFixture} (which needs the whole statement plus the column list, to build an
 * upsert) and the ownership-scoped `simulateSyncError` / `clearSampleFixture` (which only need
 * the ids). */
function parseFixtureRows(fixtureSql: string): FixtureRow[] {
  const rows: FixtureRow[] = [];
  for (const rawLine of fixtureSql.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const match = INSERT_LINE_PATTERN.exec(line);
    if (match === null) continue;
    const [, table, columnList, id] = match;
    if (table === undefined || columnList === undefined || id === undefined) continue;
    if (!(SAMPLE_DATA_TABLES as readonly string[]).includes(table)) continue;
    const columns = columnList.split(',').map((column) => column.trim().replace(/^"|"$/g, ''));
    rows.push({ table: table as (typeof SAMPLE_DATA_TABLES)[number], id, columns, statement: line });
  }
  return rows;
}

function fixtureIdsForTable(fixtureSql: string, table: (typeof SAMPLE_DATA_TABLES)[number]): string[] {
  return parseFixtureRows(fixtureSql)
    .filter((row) => row.table === table)
    .map((row) => row.id);
}

/** Rewrites a fixture `INSERT INTO "table" (id, col2, …) VALUES (…);` line into an
 * `INSERT INTO … VALUES (…) ON CONFLICT("id") DO UPDATE SET col2 = excluded.col2, …;` upsert —
 * every non-`id` column resets to the fixture's own value on conflict, so a second load restores
 * whatever a prior sync-error simulation or clear left behind. */
function toUpsertStatement(row: FixtureRow): string {
  const [idColumn, ...restColumns] = row.columns;
  if (idColumn === undefined || restColumns.length === 0) return row.statement;
  const setClause = restColumns.map((column) => `"${column}" = excluded."${column}"`).join(', ');
  const withoutTrailingSemicolon = row.statement.replace(/;\s*$/, '');
  return `${withoutTrailingSemicolon} ON CONFLICT("${idColumn}") DO UPDATE SET ${setClause};`;
}

/**
 * Upserts the {@link SAMPLE_DATA_TABLES} rows from `fixtureSql`, in one transaction. A repeat
 * "Cargar datos de ejemplo" tap (or one following a "Simular error de sincronización" / "Vaciar
 * datos de ejemplo") therefore always converges on the fixture's own literal values, instead of
 * either violating a primary/unique key (a plain `INSERT`) or silently leaving stale modified
 * state in place (`INSERT OR IGNORE`).
 */
export function loadSampleFixture(db: AppDatabase, fixtureSql: string): void {
  const statements = parseFixtureRows(fixtureSql).map(toUpsertStatement);

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

/**
 * Restores the pre-fixture (`#screen=home&state=empty`-reachable) state **without deleting
 * anything** (found in review, round 2 — Non-negotiable 3 applies to every `transactions` row,
 * fixture-owned or not): every fixture-owned movement is marked excluded (never deleted), and the
 * fixture-owned connection's sync bookkeeping is reset to "never synced" — which is what
 * `resolveHomeState` actually keys off (`lastSuccessAt`), not the presence of movement rows.
 * Never touches the seeded starter catalogue, a real connection, or a real movement a genuine
 * sync (item #10) may have written alongside the sample data.
 */
export function clearSampleFixture(db: AppDatabase, fixtureSql: string): void {
  const transactionIds = fixtureIdsForTable(fixtureSql, 'transactions');
  const institutionIds = fixtureIdsForTable(fixtureSql, 'user_financial_institutions');
  const now = new Date().toISOString();

  db.transaction((tx: AppDatabase) => {
    if (transactionIds.length > 0) {
      tx.update(transactions)
        .set({
          excludedAt: now,
          exclusionReason: CLEAR_EXCLUSION_REASON,
          exclusionNote: CLEAR_EXCLUSION_NOTE,
        })
        .where(inArray(transactions.id, transactionIds))
        .run();
    }
    if (institutionIds.length > 0) {
      tx.update(userFinancialInstitutions)
        .set({ syncStatus: 'idle', lastSyncAt: null, lastSuccessAt: null, lastErrorCode: null })
        .where(inArray(userFinancialInstitutions.id, institutionIds))
        .run();
    }
  });
}
