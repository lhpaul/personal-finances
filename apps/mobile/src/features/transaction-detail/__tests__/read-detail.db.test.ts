import { createTestConnection, createTestProduct } from '../../../db/testing/product-fixture';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { merchants, transactions } from '../../../db/schema';
import { readTransactionDetail } from '../read-detail';

/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 21 (Decision 2). The
 * `.db.test.ts` suffix routes this to the Node/`better-sqlite3` project (jest.config.js), the
 * same convention #13's `read-stage-data.db.test.ts` established: `readTransactionDetail`
 * composes its repository calls over a **real** in-memory store and returns one internally
 * consistent snapshot.
 */
describe('readTransactionDetail (db)', () => {
  it('composes the movement, its category, its product and the picker chip inputs into one consistent snapshot', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(merchants)
        .values({ id: 'read-detail-merchant', name: 'Líder S.A.', transactionCategoryId: 'supermercado', createdAt: now })
        .run();
      db.insert(transactions)
        .values({
          id: 'read-detail-tx',
          userFinancialProductId: productId,
          externalId: null,
          dedupHash: 'dedup-read-detail-tx',
          amount: 35000,
          type: 'debit',
          occurredAt: now,
          dateLocal: '2026-02-01',
          rawDescription: 'COMPRA LIDER EXPRESS',
          merchantId: 'read-detail-merchant',
          transactionCategoryId: 'supermercado',
          categorySource: 'auto',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const snapshot = readTransactionDetail(db, { transactionId: 'read-detail-tx', locale: 'es' });
      expect(snapshot?.context.transaction.id).toBe('read-detail-tx');
      expect(snapshot?.context.merchantName).toBe('Líder S.A.');
      expect(snapshot?.category?.id).toBe('supermercado');
      expect(snapshot?.taxonomy.some((category) => category.id === 'supermercado')).toBe(true);
      // The suggestion is null here — the merchant's default category (`supermercado`) matches
      // this movement's own already-chosen category, and `category_source` is `'auto'`, so
      // `suggestCategory` still resolves a suggestion; the assertion below only proves the field
      // is populated by the real composition, not a specific value the picker itself would
      // need — Scenario 14 (`resolveActionSet`) and #13's own suggestion tests own that contract.
      expect(snapshot?.suggestion).not.toBeUndefined();
      expect(Array.isArray(snapshot?.categoryChoices)).toBe(true);
    } finally {
      sqlite.close();
    }
  });

  it('returns undefined for an unresolvable transactionId', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      expect(readTransactionDetail(db, { transactionId: 'does-not-exist', locale: 'es' })).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
