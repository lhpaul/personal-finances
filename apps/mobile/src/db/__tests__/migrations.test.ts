import { openMemoryDb } from '../testing/memory-db';

/**
 * Scenario 12 (AC12) and scenario 16 (AC16), per the Testing Strategy's test-file table.
 * `db:check` mode 1 (AC12) and the injected-failure test (AC16) are added in Steps 5 and 6; this
 * file starts with the foundational proof that the full migration history applies cleanly to an
 * empty in-memory store and that `PRAGMA foreign_keys` reads back `1` (Decision 5).
 */
describe('migrations', () => {
  it('applies the full migration history to an empty store with foreign keys enforced', () => {
    const { sqlite } = openMemoryDb();
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
});
