import { setUserCategory } from '../../../db/repositories/transactions';
import { transactions } from '../../../db/schema';
import { createTestConnection, createTestProduct } from '../../../db/testing/product-fixture';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { readStageData } from '../read-stage-data';

/**
 * Categorization flow (#13) implementation plan Testing Strategy, Scenario 21. The `.db.test.ts`
 * suffix routes this file to the Node/`better-sqlite3` `db` Jest project (Tooling / configuration
 * — the two additive `jest.config.js` lines), because `readStageData` composes repository calls
 * that need a real SQLite driver.
 */
describe('readStageData (Decision 16)', () => {
  it('composes one internally consistent snapshot: the batch, the pending count and the chip inputs describe the same set of movements', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values([
          {
            id: 'pending-1',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'dedup-pending-1',
            amount: 5000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-01',
            rawDescription: 'Pending expense',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'pending-2',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'dedup-pending-2',
            amount: 7000,
            type: 'credit',
            occurredAt: now,
            dateLocal: '2026-02-02',
            rawDescription: 'Pending income',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();
      setUserCategory(db, 'pending-1', 'comida', ports);
      // Two separate, already-categorized rows build the "used categories" history read below —
      // one expense, one income, so both directions get the same regression protection.
      db.insert(transactions)
        .values([
          {
            id: 'history-comida',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'dedup-history-comida',
            amount: 3000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-01-20',
            rawDescription: 'History expense',
            transactionCategoryId: 'comida',
            categorySource: 'user',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'history-sueldo',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'dedup-history-sueldo',
            amount: 500000,
            type: 'credit',
            occurredAt: now,
            dateLocal: '2026-01-20',
            rawDescription: 'History income',
            transactionCategoryId: 'sueldo',
            categorySource: 'user',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const snapshot = readStageData(db, { locale: 'es' });

      // `pending-1` was categorized above, so the pending batch holds only `pending-2`.
      expect(snapshot.batch.map((m) => m.id)).toEqual(['pending-2']);
      expect(snapshot.pendingCount).toBe(snapshot.batch.length);
      expect(snapshot.expenseCategories.some((c) => c.slug === 'comida')).toBe(true);
      expect(snapshot.incomeCategories.every((c) => c.income === true)).toBe(true);
      expect(snapshot.usedExpenseCategories.map((c) => c.slug)).toContain('comida');
      expect(snapshot.usedIncomeCategories.map((c) => c.slug)).toContain('sueldo');
    } finally {
      sqlite.close();
    }
  });
});
