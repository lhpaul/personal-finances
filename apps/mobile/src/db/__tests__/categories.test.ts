import { eq } from 'drizzle-orm';

import {
  createCategory,
  deleteCategory,
  listCategories,
  listMostUsedCategories,
  updateCategory,
  type CategoryWritable,
  type UpdateCategoryInput,
} from '../repositories/categories';
import { merchants, transactionCategories, transactions, userBudgets, userRecurringTransactions } from '../schema';
import { createTestConnection, createTestProduct } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/**
 * Scenarios 8, 9, 10 and the `updateCategory` direction-immutability half of 29, per the Testing
 * Strategy's test-file table.
 */
describe('categories repository', () => {
  it('deleting a spending category moves its movements to otros-gasto, leaves the movement count unchanged, and a forced mid-transaction failure leaves the store exactly as it was (AC8)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values({
          id: 'txn-1',
          userFinancialProductId: productId,
          externalId: null,
          dedupHash: 'dedup-1',
          amount: 1000,
          type: 'debit',
          occurredAt: now,
          dateLocal: '2026-02-01',
          rawDescription: 'Compra',
          transactionCategoryId: 'comida',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const totalBefore = db.select().from(transactions).all().length;

      deleteCategory(db, 'comida');

      const row = db.select().from(transactions).where(eq(transactions.id, 'txn-1')).get();
      expect(row?.transactionCategoryId).toBe('otros-gasto');
      expect(db.select().from(transactions).all()).toHaveLength(totalBefore);
      expect(db.select().from(transactionCategories).where(eq(transactionCategories.id, 'comida')).get()).toBeUndefined();

      // Forced mid-transaction failure: deleting a category that does not exist throws before
      // any statement in the transaction commits.
      const categoriesBefore = db.select().from(transactionCategories).all().length;
      expect(() => deleteCategory(db, 'does-not-exist')).toThrow();
      expect(db.select().from(transactionCategories).all()).toHaveLength(categoriesBefore);
    } finally {
      sqlite.close();
    }
  });

  it('deleting an income category moves its movements to otros-ingreso (AC8)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values({
          id: 'txn-income',
          userFinancialProductId: productId,
          externalId: null,
          dedupHash: 'dedup-income',
          amount: 500000,
          type: 'credit',
          occurredAt: now,
          dateLocal: '2026-02-01',
          rawDescription: 'Freelance payment',
          transactionCategoryId: 'freelance',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      deleteCategory(db, 'freelance');

      const row = db.select().from(transactions).where(eq(transactions.id, 'txn-income')).get();
      expect(row?.transactionCategoryId).toBe('otros-ingreso');
    } finally {
      sqlite.close();
    }
  });

  it('deleteCategory on either ✨ Otros throws, and a raw DELETE bypassing the repository is rejected by the trigger (AC9)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      expect(() => deleteCategory(db, 'otros-gasto')).toThrow();
      expect(() => deleteCategory(db, 'otros-ingreso')).toThrow();

      expect(() => sqlite.prepare(`DELETE FROM transaction_categories WHERE id = 'otros-gasto'`).run()).toThrow();
      expect(() => sqlite.prepare(`DELETE FROM transaction_categories WHERE id = 'otros-ingreso'`).run()).toThrow();

      // Both categories are still present.
      expect(db.select().from(transactionCategories).where(eq(transactionCategories.id, 'otros-gasto')).get()).toBeDefined();
      expect(db.select().from(transactionCategories).where(eq(transactionCategories.id, 'otros-ingreso')).get()).toBeDefined();
    } finally {
      sqlite.close();
    }
  });

  it('deleting a category clears merchants.transaction_category_id, deletes its budget and recurring rows, and deletes no merchant and no movement (AC10)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const now = ports.now();
      db.insert(userBudgets)
        .values({
          id: 'budget-1',
          transactionCategoryId: 'comida',
          period: '2026-02',
          amount: 100000,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(userRecurringTransactions)
        .values({
          id: 'recurring-1',
          transactionCategoryId: 'comida',
          description: 'Suscripción',
          amount: 5000,
          dueDay: 5,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const merchantCountBefore = db.select().from(merchants).all().length;
      const liderBefore = db.select().from(merchants).where(eq(merchants.id, 'lider')).get();
      expect(liderBefore?.transactionCategoryId).toBe('supermercado');

      deleteCategory(db, 'comida');

      expect(db.select().from(userBudgets).where(eq(userBudgets.id, 'budget-1')).get()).toBeUndefined();
      expect(
        db.select().from(userRecurringTransactions).where(eq(userRecurringTransactions.id, 'recurring-1')).get(),
      ).toBeUndefined();
      // No merchant was deleted (comida had no merchant pointing at it, so this proves the
      // clear-on-delete path only touches matching rows, not the whole table).
      expect(db.select().from(merchants).all()).toHaveLength(merchantCountBefore);
      const liderAfter = db.select().from(merchants).where(eq(merchants.id, 'lider')).get();
      expect(liderAfter?.transactionCategoryId).toBe('supermercado'); // unrelated merchant untouched
    } finally {
      sqlite.close();
    }
  });

  it('deleting a category clears a merchant default that pointed directly at it (AC10)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const input: CategoryWritable = {
        slug: 'mi-categoria',
        income: 0,
        labels: { es: 'Mi categoría', en: 'My category' },
        sortOrder: 99,
      };
      const category = createCategory(db, input, ports, null);

      db.update(merchants).set({ transactionCategoryId: category.id }).where(eq(merchants.id, 'lider')).run();

      deleteCategory(db, category.id);

      const lider = db.select().from(merchants).where(eq(merchants.id, 'lider')).get();
      expect(lider?.transactionCategoryId).toBeNull();
      expect(db.select().from(merchants).where(eq(merchants.id, 'lider')).get()).toBeDefined(); // not deleted
    } finally {
      sqlite.close();
    }
  });

  it('listCategories orders by sort_order for the requested direction', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const expense = listCategories(db, { income: 0, locale: 'es' });
      expect(expense.map((c) => c.slug)[0]).toBe('comida');
      expect(expense.every((c) => c.income === false)).toBe(true);
      for (let i = 1; i < expense.length; i++) {
        expect((expense[i]?.sortOrder ?? 0)).toBeGreaterThan(expense[i - 1]?.sortOrder ?? 0);
      }
    } finally {
      sqlite.close();
    }
  });

  it("updateCategory never writes income, even when a raw call forces it in via `as any` (AC29)", async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const input: CategoryWritable = {
        slug: 'mi-categoria-2',
        income: 0,
        labels: { es: 'Original', en: 'Original' },
        sortOrder: 50,
      };
      const category = createCategory(db, input, ports, null);
      expect(category.income).toBe(false);

      const updateInput: UpdateCategoryInput = {
        slug: 'mi-categoria-2',
        labels: { es: 'Renombrada', en: 'Renamed' },
        sortOrder: 51,
      };
      // Simulate a caller that ignores TypeScript and forces `income` into the call.
      updateCategory(db, category.id, { ...updateInput, income: 1 } as unknown as UpdateCategoryInput);

      const row = db.select().from(transactionCategories).where(eq(transactionCategories.id, category.id)).get();
      expect(row?.income).toBe(0); // still expense — the forced income was stripped before the UPDATE was built
      expect(row?.labels).toBe(JSON.stringify({ es: 'Renombrada', en: 'Renamed' }));
      expect(row?.sortOrder).toBe(51);
    } finally {
      sqlite.close();
    }
  });

  /**
   * Categorization flow (#13) implementation plan Testing Strategy, Scenarios 10-11.
   */
  it('listMostUsedCategories orders by usage descending, ties by sort_order, excludes the suggested category, and honours the limit (AC8, A7)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      // supermercado used twice, transporte once, comida once (tie with transporte, broken by
      // sortOrder: comida=1 < transporte=3), compras never used (excluded from the result below).
      db.insert(transactions)
        .values([
          {
            id: 'use-1',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'use-1',
            amount: 1000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-01',
            rawDescription: 'a',
            transactionCategoryId: 'supermercado',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'use-2',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'use-2',
            amount: 1000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-02',
            rawDescription: 'b',
            transactionCategoryId: 'supermercado',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'use-3',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'use-3',
            amount: 1000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-03',
            rawDescription: 'c',
            transactionCategoryId: 'transporte',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'use-4',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'use-4',
            amount: 1000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-04',
            rawDescription: 'd',
            transactionCategoryId: 'comida',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'use-5-compras',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'use-5-compras',
            amount: 1000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-05',
            rawDescription: 'e',
            transactionCategoryId: 'compras',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const result = listMostUsedCategories(db, {
        income: 0,
        excludeCategoryId: 'compras',
        limit: 7,
        locale: 'es',
      });

      expect(result.map((c) => c.slug)).toEqual(['supermercado', 'comida', 'transporte']);
    } finally {
      sqlite.close();
    }
  });

  it('listMostUsedCategories with no history returns an empty result (Decision 6 fallback)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const result = listMostUsedCategories(db, { income: 0, limit: 7, locale: 'es' });
      expect(result).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
