import { transactions } from '../../../db/schema';
import { createTestConnection, createTestProduct } from '../../../db/testing/product-fixture';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { readTransactionsPage } from '../read-transactions-page';

/**
 * Scenario 15 of the transactions-list implementation plan's Testing Strategy:
 * `readTransactionsPage` composes its four repository calls over a real in-memory store and
 * returns one internally consistent snapshot. Routed to the `db` Jest project by its
 * `.db.test.ts` suffix (jest.config.js).
 */
describe('readTransactionsPage (issue #15, Scenario 15)', () => {
  const DEFAULT_FILTERS = {
    direction: 'all' as const,
    categorization: 'all' as const,
    productId: null,
    showExcluded: true,
  };

  it('returns one internally consistent snapshot: month counts, page rows, categories and products all describe the same store state', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      const productId = createTestProduct(db, ports, connectionId, {
        externalId: 'checking',
        type: 'checking',
        name: 'Cuenta Corriente',
      });
      const now = ports.now();

      db.insert(transactions)
        .values([
          {
            id: 'snap-jan-1',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'snap-jan-1',
            amount: 42000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-01-05',
            rawDescription: 'LIDER SUPERMERCADO',
            merchantId: 'lider',
            transactionCategoryId: 'comida',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'snap-jan-2',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'snap-jan-2',
            amount: 12000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-01-10',
            rawDescription: 'UBER BV',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'snap-dec-1',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'snap-dec-1',
            amount: 180000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2025-12-29',
            rawDescription: 'Cena Año Nuevo',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const params = { filters: DEFAULT_FILTERS, search: null, cursor: null, limit: 50 };
      const data = readTransactionsPage(db, params, 'es');

      // The month counts agree exactly with the page's rows, grouped by month.
      expect(data.monthCounts).toEqual([
        { monthKey: '2026-01', count: 2 },
        { monthKey: '2025-12', count: 1 },
      ]);
      expect(data.page.rows).toHaveLength(3);
      expect(data.page.nextCursor).toBeNull();

      const janRows = data.page.rows.filter((row) => row.dateLocal.startsWith('2026-01'));
      expect(janRows).toHaveLength(2);

      // The category catalogue carries both directions, resolved for the requested locale.
      expect(data.categories.some((category) => category.income)).toBe(true);
      expect(data.categories.some((category) => !category.income)).toBe(true);
      expect(data.categories.find((category) => category.slug === 'comida')?.name).toBe('Comida');

      // The product list describes the same store — the one product just created.
      expect(data.products).toEqual([{ id: productId, name: 'Cuenta Corriente', type: 'checking' }]);

      // Merchant/category resolution landed on the page row, same as the repository test proves.
      const liderRow = data.page.rows.find((row) => row.id === 'snap-jan-1');
      expect(liderRow?.merchantName).toBe('Líder');
      expect(liderRow?.categoryName).toBe('Comida');
    } finally {
      sqlite.close();
    }
  });
});
