import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { openMemoryDb } from './memory-db';

/**
 * Implementation plan Step 2 — "prove the test driver before building on it". Throwaway
 * one-table schema, deleted once Step 3's real schema tests (`src/db/__tests__/schema.test.ts`)
 * cover the same guarantees (`PRAGMA foreign_keys = ON`, a partial index, an insert) against the
 * actual declared shape. Not listed in the Testing Strategy's test-file table because it is not
 * a permanent scenario file.
 */
const proofTable = sqliteTable(
  'proof_table',
  {
    id: integer('id').primaryKey(),
    parentId: integer('parent_id'),
    excludedAt: text('excluded_at'),
  },
  (t) => [index('proof_table_partial_idx').on(t.parentId).where(sql`${t.excludedAt} is null`)],
);

describe('driver proof (Step 2, throwaway)', () => {
  it('opens an in-memory better-sqlite3 store with foreign keys enforced, creates a partial index and inserts a row', () => {
    const { sqlite, db } = openMemoryDb();
    try {
      expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);

      sqlite.exec(`
        CREATE TABLE proof_table (
          id INTEGER PRIMARY KEY,
          parent_id INTEGER,
          excluded_at TEXT
        );
        CREATE INDEX proof_table_partial_idx ON proof_table (parent_id) WHERE excluded_at IS NULL;
      `);

      db.insert(proofTable).values({ id: 1, parentId: 42, excludedAt: null }).run();

      const row = db.select().from(proofTable).all();
      expect(row).toEqual([{ id: 1, parentId: 42, excludedAt: null }]);
    } finally {
      sqlite.close();
    }
  });
});
