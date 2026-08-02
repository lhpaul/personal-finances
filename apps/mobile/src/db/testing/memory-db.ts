import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

/**
 * Opens a `better-sqlite3` database at `':memory:'`, wrapped with
 * `drizzle-orm/better-sqlite3`, with `PRAGMA foreign_keys = ON` set immediately after opening
 * (implementation plan Decision 2, Decision 5). Every driver class this app uses —
 * `ExpoSQLiteDatabase` and `BetterSQLite3Database` — extends `BaseSQLiteDatabase<'sync', ...>`
 * from `drizzle-orm/sqlite-core`, so repository functions written against that base type run
 * unchanged in both environments (Decision 1). This is the mechanism behind AC24: the whole test
 * suite runs in Node, with no simulator and no device.
 *
 * `Step 3` replaces the placeholder single-table schema this function currently wires with the
 * full `src/db/schema.ts` declaration and runs the generated migration history here instead.
 */
export function openMemoryDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  return { sqlite, db };
}
