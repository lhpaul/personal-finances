import fs from 'node:fs';

import type Database from 'better-sqlite3';

/**
 * Executes a committed `store-v*.sql` snapshot (implementation plan Decision 18) against an
 * already-migrated, empty in-memory store. The file is nothing but semicolon-separated `INSERT`
 * statements in dependency order (`scripts/db/dump.ts`), so a single `exec` call is sufficient —
 * `PRAGMA foreign_keys = ON` (set by every client in this codebase) is what makes the insertion
 * order matter.
 */
export function loadFixture(sqlite: Database.Database, fixturePath: string): void {
  const sqlText = fs.readFileSync(fixturePath, 'utf8');
  sqlite.exec(sqlText);
}
