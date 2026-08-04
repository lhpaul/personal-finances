import { deleteDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
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

/**
 * The only place in the repository that may call `expo-sqlite`'s deletion API (implementation
 * plan for issue #19, Decision 3) — the full local wipe's second-to-last step, after every
 * credential key has been deleted from the secure store (`src/features/settings/wipe-local-
 * data.ts`). Closes the handle first (`closeAsync`), then deletes the file named by the private
 * `DATABASE_NAME` constant above — no caller outside this module ever learns the filename.
 */
export async function deleteAppDatabaseFile(sqlite: SQLiteDatabase): Promise<void> {
  await sqlite.closeAsync();
  await deleteDatabaseAsync(DATABASE_NAME);
}
