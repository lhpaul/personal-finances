import { transactions } from '../../../db/schema';
import { createTestConnection, createTestProduct } from '../../../db/testing/product-fixture';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { readHomeData } from '../read-home-data';

/**
 * Scenario 25 of the home-screen implementation plan's Testing Strategy: `readHomeData` composes
 * its eight repository calls over a real in-memory store and returns one internally consistent
 * snapshot. Routed to the `db` Jest project by its `.db.test.ts` suffix (jest.config.js).
 */
describe('readHomeData (issue #12, Scenario 25)', () => {
  const period = { start: '2026-02-01', end: '2026-02-28' };
  const previousPeriod = { start: '2026-01-01', end: '2026-01-31' };

  it('returns one internally consistent snapshot across totals, buckets and the trend series', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values([
          {
            id: 'snap-debit-comida',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'snap-debit-comida',
            amount: 42000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-05',
            rawDescription: 'LIDER SUPERMERCADO',
            merchantId: 'lider',
            transactionCategoryId: 'comida',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'snap-debit-excluded',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'snap-debit-excluded',
            amount: 15000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-06',
            rawDescription: 'Excluded expense',
            transactionCategoryId: 'comida',
            excludedAt: now,
            exclusionReason: 'not_relevant',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'snap-credit-uncategorized',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'snap-credit-uncategorized',
            amount: 500000,
            type: 'credit',
            occurredAt: now,
            dateLocal: '2026-02-10',
            rawDescription: 'CONSULTORIA DIGITAL SPA',
            transactionCategoryId: null,
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'snap-previous-month',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'snap-previous-month',
            amount: 20000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-01-15',
            rawDescription: 'January expense',
            transactionCategoryId: 'comida',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const data = readHomeData(db, { period, previousPeriod, locale: 'es' });

      // The uncategorized, non-excluded credit is the only row countUncategorized should see.
      expect(data.uncategorizedCount).toBe(1);

      const debitComida = data.categoryTotals.find(
        (row) => row.type === 'debit' && row.transactionCategoryId === 'comida',
      );
      expect(debitComida).toEqual({
        type: 'debit',
        transactionCategoryId: 'comida',
        total: 42000, // the excluded 15000 is absent
        movementCount: 1,
      });

      const creditUncategorized = data.categoryTotals.find(
        (row) => row.type === 'credit' && row.transactionCategoryId === null,
      );
      expect(creditUncategorized).toEqual({
        type: 'credit',
        transactionCategoryId: null,
        total: 500000,
        movementCount: 1,
      });

      // Internal consistency: the trend series' per-day totals sum to the same figure as the
      // category buckets, per direction — both are the same underlying included set.
      const debitCategoryTotal = data.categoryTotals
        .filter((row) => row.type === 'debit')
        .reduce((sum, row) => sum + row.total, 0);
      const debitDailyTotal = data.dailyTotals
        .filter((row) => row.type === 'debit')
        .reduce((sum, row) => sum + row.total, 0);
      expect(debitDailyTotal).toBe(debitCategoryTotal);
      expect(debitDailyTotal).toBe(42000);

      const creditCategoryTotal = data.categoryTotals
        .filter((row) => row.type === 'credit')
        .reduce((sum, row) => sum + row.total, 0);
      const creditDailyTotal = data.dailyTotals
        .filter((row) => row.type === 'credit')
        .reduce((sum, row) => sum + row.total, 0);
      expect(creditDailyTotal).toBe(creditCategoryTotal);
      expect(creditDailyTotal).toBe(500000);

      // previousDailyTotals only sees January's movement, never February's.
      expect(data.previousDailyTotals).toEqual([
        { dateLocal: '2026-01-15', type: 'debit', total: 20000 },
      ]);

      // listRecentMovements includes the excluded movement, dimmed, not filtered out.
      expect(data.recentMovements.some((row) => row.id === 'snap-debit-excluded' && row.excluded)).toBe(
        true,
      );

      expect(data.connections).toHaveLength(1);
      expect(data.connections[0]?.institutionName).toBe('Banco de Chile');

      // Both directions of the seeded catalogue are present.
      expect(data.categories.some((category) => category.income)).toBe(true);
      expect(data.categories.some((category) => !category.income)).toBe(true);
    } finally {
      sqlite.close();
    }
  });
});
