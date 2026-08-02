/**
 * The deterministic SQL dumper (implementation plan Decision 18). Produces a text `.sql` file —
 * tables in a **fixed dependency order** (not alphabetical), every parent table before any table
 * whose foreign key references it, rows sorted by primary key within each table, one `INSERT` per
 * row, `__drizzle_migrations` included. This matters because `PRAGMA foreign_keys = ON` is set on
 * every connection (Decision 5), including the in-memory client `db:check` mode 3 restores this
 * file into: an alphabetical dump would insert `merchant_aliases` before `merchants` and
 * `transactions` before `user_financial_products`, and the restore would fail on the first
 * foreign-key violation before mode 3 could test anything.
 *
 * The dependency order is a fixed constant here, not derived at dump time, so it cannot silently
 * drift if a table is added — `db:check` mode 1's schema-introspection already catches a
 * genuinely new table, and adding one to this constant is a one-line reviewable change alongside
 * it.
 */
import type Database from 'better-sqlite3';

export const DUMP_TABLE_ORDER = [
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
] as const;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

interface ColumnInfo {
  name: string;
  pk: number;
}

function primaryKeyColumn(sqlite: Database.Database, table: string): string {
  const columns = sqlite.prepare<[], ColumnInfo>(`PRAGMA table_info(${quoteIdent(table)})`).all();
  const pk = columns.find((c) => c.pk === 1);
  if (!pk) throw new Error(`Table '${table}' has no single-column primary key to order by.`);
  return pk.name;
}

function columnNames(sqlite: Database.Database, table: string): string[] {
  return sqlite
    .prepare<[], ColumnInfo & { name: string }>(`PRAGMA table_info(${quoteIdent(table)})`)
    .all()
    .map((c) => c.name);
}

function dumpTable(sqlite: Database.Database, table: string): string[] {
  const pkColumn = primaryKeyColumn(sqlite, table);
  const columns = columnNames(sqlite, table);
  const rows = sqlite
    .prepare(`SELECT * FROM ${quoteIdent(table)} ORDER BY ${quoteIdent(pkColumn)}`)
    .all() as Record<string, unknown>[];

  const columnList = columns.map(quoteIdent).join(', ');
  return rows.map((row) => {
    const values = columns.map((c) => sqlLiteral(row[c])).join(', ');
    return `INSERT INTO ${quoteIdent(table)} (${columnList}) VALUES (${values});`;
  });
}

/**
 * Dumps every declared table in `DUMP_TABLE_ORDER`, plus `__drizzle_migrations`, as deterministic
 * `INSERT` statements — one dependency-ordered, primary-key-sorted line per row.
 */
export function dumpDatabase(sqlite: Database.Database): string {
  const lines: string[] = [];
  for (const table of DUMP_TABLE_ORDER) {
    lines.push(...dumpTable(sqlite, table));
  }
  // `__drizzle_migrations` has no declared Drizzle schema (it is Drizzle's own bookkeeping
  // table), so it is dumped by direct introspection rather than through `DUMP_TABLE_ORDER`.
  const migColumns = sqlite
    .prepare<[], { name: string }>(`PRAGMA table_info(${quoteIdent('__drizzle_migrations')})`)
    .all()
    .map((c) => c.name);
  const migRows = sqlite
    .prepare(`SELECT * FROM ${quoteIdent('__drizzle_migrations')} ORDER BY id`)
    .all() as Record<string, unknown>[];
  const migColumnList = migColumns.map(quoteIdent).join(', ');
  for (const row of migRows) {
    const values = migColumns.map((c) => sqlLiteral(row[c])).join(', ');
    lines.push(`INSERT INTO ${quoteIdent('__drizzle_migrations')} (${migColumnList}) VALUES (${values});`);
  }

  return `${lines.join('\n')}\n`;
}
