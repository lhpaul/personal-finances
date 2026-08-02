import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { DatabaseMigrationError, runMigrations } from '../migrate';
import { getSetting, setSetting } from '../repositories/settings';
import { users } from '../schema';
import { MIGRATIONS_FOLDER, openMigratedMemoryDb } from '../testing/memory-db';

/**
 * Scenario 12 (AC12) and scenario 16 (AC16), per the Testing Strategy's test-file table.
 * `db:check` mode 1 (AC12) is exercised end to end in the smoke runbook and in
 * `apps/mobile/scripts/db/check.ts` itself; this file covers the foundational proof that the
 * full migration history applies cleanly to an empty in-memory store (Decision 5) and the
 * injected-failure guarantee (AC16, Business Rule 12).
 */
describe('migrations', () => {
  it('applies the full migration history to an empty store with foreign keys enforced', () => {
    const { sqlite } = openMigratedMemoryDb();
    try {
      expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);

      const tables = sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
        )
        .all() as { name: string }[];
      const tableNames = tables.map((t) => t.name).sort();

      expect(tableNames).toEqual(
        [
          '__drizzle_migrations',
          'app_settings',
          'financial_institutions',
          'merchant_aliases',
          'merchants',
          'seed_ledger',
          'transaction_categories',
          'transactions',
          'user_budgets',
          'user_financial_institutions',
          'user_financial_products',
          'user_recurring_transactions',
          'users',
        ].sort(),
      );

      const trigger = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?`)
        .get('protect_otros_categories');
      expect(trigger).toBeDefined();
    } finally {
      sqlite.close();
    }
  });

  it(
    'a failing migration leaves every pre-existing row and schema_version untouched, and ' +
      'surfaces a DatabaseMigrationError (AC16)',
    () => {
      const { sqlite, db } = openMigratedMemoryDb();
      let tempRoot: string | undefined;
      try {
        db.insert(users)
          .values({ id: 'user-1', createdAt: '2026-01-01T00:00:00.000Z' })
          .run();
        setSetting(db, 'schema_version', 1);

        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-migration-fail-'));
        fs.cpSync(MIGRATIONS_FOLDER, tempRoot, { recursive: true });
        fs.writeFileSync(
          path.join(tempRoot, '0001_broken.sql'),
          'INSERT INTO this_table_does_not_exist (col) VALUES (1);',
        );
        const journalPath = path.join(tempRoot, 'meta', '_journal.json');
        const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
          version: string;
          entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
        };
        journal.entries.push({
          idx: journal.entries.length,
          version: journal.version,
          when: Date.now(),
          tag: '0001_broken',
          breakpoints: true,
        });
        fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));

        let thrown: unknown;
        try {
          runMigrations(() => migrate(db, { migrationsFolder: tempRoot as string }), '0001_broken');
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(DatabaseMigrationError);

        const rows = db.select().from(users).all();
        expect(rows).toEqual([
          {
            id: 'user-1',
            email: null,
            firstName: null,
            lastName: null,
            nationalIdType: 'rut',
            countryCode: 'CL',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
        expect(getSetting(db, 'schema_version')).toBe(1);

        const brokenTable = sqlite
          .prepare(
            `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'this_table_does_not_exist'`,
          )
          .get();
        expect(brokenTable).toBeUndefined();
      } finally {
        if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
        sqlite.close();
      }
    },
  );
});
