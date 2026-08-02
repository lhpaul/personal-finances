import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

/**
 * The only `expo-sqlite` import in the repository (implementation plan Decision 1). Opens the
 * on-device database and sets `PRAGMA foreign_keys = ON` immediately after opening (Decision 5)
 * — SQLite disables foreign-key enforcement by default, and without this pragma every
 * `ON DELETE CASCADE` in `docs/project/4-database-model.md` is decorative.
 *
 * `src/db/bootstrap.ts` is the only caller; no screen, feature hook or shared package may open
 * this database directly (spec Business Rule 23, AC26 — enforced by `dbAccessBoundary`).
 */
const DATABASE_NAME = 'finanzas.db';

export function openAppDatabase() {
  const sqlite = openDatabaseSync(DATABASE_NAME);
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite);
  return { sqlite, db };
}
