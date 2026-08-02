import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { runMigrations } from '../migrate';
import * as schema from '../schema';

/**
 * Opens a `better-sqlite3` database at `':memory:'`, wrapped with
 * `drizzle-orm/better-sqlite3`, with `PRAGMA foreign_keys = ON` set immediately after opening
 * (implementation plan Decision 2, Decision 5), then applies the full committed migration
 * history from `drizzle/` (the same folder `src/db/client.ts`'s Expo runtime bundles). Every
 * driver class this app uses — `ExpoSQLiteDatabase` and `BetterSQLite3Database` — extends
 * `BaseSQLiteDatabase<'sync', ...>` from `drizzle-orm/sqlite-core`, so repository functions
 * written against that base type run unchanged in both environments (Decision 1). This is the
 * mechanism behind AC24: the whole test suite runs in Node, with no simulator and no device.
 */
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../../drizzle');

function latestJournalEntryTag(): string {
  // Reads a committed JSON fixture at test time; `import` would require a JSON module
  // resolution config this file does not otherwise need.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const journal = require(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json')) as {
    entries: { tag: string }[];
  };
  const last = journal.entries[journal.entries.length - 1];
  if (!last) throw new Error('drizzle/meta/_journal.json has no entries');
  return last.tag;
}

export function openMemoryDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  runMigrations(
    () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    latestJournalEntryTag(),
  );
  return { sqlite, db };
}
