import type { Census, CensusTable } from '../checks/preservation';
import { selectAllStatement, tableInfoStatement } from './statements';
import type { CipherHandle } from './types';

/**
 * The tables the migration's census gate covers (implementation plan Decision 6, V22): the same
 * 12 tables `apps/mobile/scripts/db/dump.ts`'s `DUMP_TABLE_ORDER` declares, plus
 * `__drizzle_migrations`. This is a **separate, cross-checked** copy rather than an import of
 * `DUMP_TABLE_ORDER` itself — `scripts/db/dump.ts` is a Node CLI script (`tsx`-run, never
 * bundled), and this module runs on-device, in production, on every migration (Decision 6's
 * whole point); importing a `scripts/` module from `src/db/` would risk pulling build-tooling
 * into the Metro graph. `__tests__/census.test.ts` asserts the two lists stay in sync.
 */
export const CENSUS_TABLES = [
  'users',
  'financial_institutions',
  'user_financial_institutions',
  'transaction_categories',
  'user_financial_products',
  'merchants',
  'merchant_aliases',
  'transactions',
  'app_settings',
  'user_budgets',
  'user_recurring_transactions',
  'seed_ledger',
  '__drizzle_migrations',
] as const;

interface ColumnInfoRow {
  name: string;
  pk: number;
}

function primaryKeyColumn(handle: CipherHandle, table: string, schema?: string): string {
  const columns = handle.query<ColumnInfoRow>(tableInfoStatement(table, schema));
  const pk = columns.find((column) => column.pk === 1);
  if (pk) return pk.name;
  // `__drizzle_migrations` is Drizzle's own bookkeeping table, not one of this app's declared
  // schema tables — `scripts/db/dump.ts` orders it by `id` without relying on a `pk` flag, and
  // this mirrors that same fallback rather than assuming every driver reports one.
  if (table === '__drizzle_migrations') return 'id';
  throw new Error(`Table '${table}' has no single-column primary key to census by.`);
}

/**
 * `buildCensus(handle, schema)` — the device-side counterpart of
 * `apps/mobile/scripts/db/check.ts`'s own `buildCensus` (mode 3), built against a
 * {@link CipherHandle} instead of a raw `better-sqlite3.Database` so it runs identically against
 * `main` (the plaintext legacy connection) and `EXPORT_ALIAS` (the attached encrypted target) of
 * the *same open connection* — the comparison this item's Decision 6 step 6 runs reads real rows
 * out of real pages, not out of a buffer.
 *
 * `schema` is the optional `ATTACH` alias to qualify every query with (`undefined` reads the
 * connection's own default schema).
 */
export function buildCensus(handle: CipherHandle, schema?: string): Census {
  const tables: CensusTable[] = CENSUS_TABLES.map((table) => {
    const pkColumn = primaryKeyColumn(handle, table, schema);
    const rows = handle.query<Record<string, unknown>>(selectAllStatement(table, schema));
    const byPk: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      byPk[String(row[pkColumn])] = row;
    }
    return { name: table, rows: byPk };
  });
  return { tables };
}
