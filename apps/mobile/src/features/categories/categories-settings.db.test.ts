import { listCategories, reorderCategories } from '../../db/repositories/categories';
import { openBootstrappedMemoryDb } from '../../db/testing/memory-db';
import { createTestConnection, createTestProduct } from '../../db/testing/product-fixture';
import { transactions } from '../../db/schema';
import { readCategoriesSettings } from './read-categories';

/**
 * Scenarios 10 and 11 of the implementation plan for issue #21's Testing Strategy — the `db`
 * project, per Decision 12's `.db.test.ts` convention (item #12's routing, already landed in
 * `jest.config.js`).
 */
describe('reorder is reflected in the pickers’ own read (scenario 10, brief AC3, residual verification)', () => {
  it('reorderCategories persists an order that listCategories(...) — the function #13/#16 read — also returns, with ✨ Otros last', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const before = listCategories(db, { income: 0, locale: 'es' });
      const fallbackId = before.find((c) => c.slug === 'otros-gasto')?.id as string;
      const movableIds = before.filter((c) => c.slug !== 'otros-gasto').map((c) => c.id);
      const shuffled = [...movableIds].reverse();

      reorderCategories(db, { income: 0, orderedIds: shuffled });

      const after = listCategories(db, { income: 0, locale: 'es' });
      expect(after.map((c) => c.id)).toEqual([...shuffled, fallbackId]);
      expect(after.at(-1)?.slug).toBe('otros-gasto');
    } finally {
      sqlite.close();
    }
  });
});

describe('readCategoriesSettings (scenario 11)', () => {
  it('returns the direction’s rows in sort_order, with the month window derived from todayDateLocal', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const rows = readCategoriesSettings(db, {
        direction: 'expense',
        locale: 'es',
        todayDateLocal: '2026-02-15',
      });

      expect(rows.map((r) => r.slug)[0]).toBe('comida');
      expect(rows.every((r) => r.income === false)).toBe(true);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]?.sortOrder ?? 0).toBeGreaterThan(rows[i - 1]?.sortOrder ?? 0);
      }
    } finally {
      sqlite.close();
    }
  });

  it('a movement dated in the previous month contributes to totalCount but not monthCount', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values({
          id: 'previous-month-txn',
          userFinancialProductId: productId,
          externalId: null,
          dedupHash: 'previous-month-txn',
          amount: 1000,
          type: 'debit',
          occurredAt: now,
          dateLocal: '2026-01-20',
          rawDescription: 'a',
          transactionCategoryId: 'comida',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = readCategoriesSettings(db, {
        direction: 'expense',
        locale: 'es',
        todayDateLocal: '2026-02-15',
      });

      const comida = rows.find((r) => r.slug === 'comida') as (typeof rows)[number];
      expect(comida.totalCount).toBe(1);
      expect(comida.monthCount).toBe(0);
    } finally {
      sqlite.close();
    }
  });
});
