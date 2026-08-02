import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { __resetBootstrapForTests, ensureDatabaseReady } from '../bootstrap';
import { runMigrations } from '../migrate';
import * as schema from '../schema';
import { createDeterministicPorts } from './ports';

/**
 * Three levels of readiness, opened over a `better-sqlite3` database at `':memory:'`, wrapped
 * with `drizzle-orm/better-sqlite3`, with `PRAGMA foreign_keys = ON` set immediately after
 * opening (implementation plan Decision 2, Decision 5). Every driver class this app uses —
 * `ExpoSQLiteDatabase` and `BetterSQLite3Database` — extends `BaseSQLiteDatabase<'sync', ...>`
 * from `drizzle-orm/sqlite-core`, so repository functions written against that base type run
 * unchanged in both environments (Decision 1). This is the mechanism behind AC24: the whole test
 * suite runs in Node, with no simulator and no device.
 *
 * - `openMemoryDb()` — raw: opened, pragma set, **no migration applied**. Used to test the full
 *   fresh-install bootstrap flow itself (`bootstrap.test.ts`).
 * - `openMigratedMemoryDb()` — raw + the full committed migration history applied (the same
 *   `drizzle/` folder `src/db/client.ts`'s Expo runtime bundles). Tables exist; nothing is
 *   seeded. Used by schema/migration/constraint tests.
 * - `openBootstrappedMemoryDb()` — migrated, the single `users` row created, and all starter
 *   content seeded, exactly as `ensureDatabaseReady()` leaves a fresh install. Used by repository
 *   tests that need real seeded categories, institutions and merchants to reference.
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
  return { sqlite, db };
}

export function openMigratedMemoryDb() {
  const { sqlite, db } = openMemoryDb();
  runMigrations(
    () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    latestJournalEntryTag(),
  );
  return { sqlite, db };
}

export async function openBootstrappedMemoryDb() {
  // Each call opens a brand-new in-memory store, so the module-level single-flight promise in
  // bootstrap.ts must be cleared first — otherwise a second test in the same process would reuse
  // the first test's already-resolved bootstrap and never touch its own fresh database.
  __resetBootstrapForTests();
  const { sqlite, db } = openMemoryDb();
  const ports = createDeterministicPorts();
  await ensureDatabaseReady({
    db,
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    latestMigrationTag: latestJournalEntryTag(),
    newId: ports.newId,
    now: ports.now,
  });
  return { sqlite, db, ports };
}

export { latestJournalEntryTag, MIGRATIONS_FOLDER };
