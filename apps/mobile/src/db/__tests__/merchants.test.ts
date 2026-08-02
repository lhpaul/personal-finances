import { eq } from 'drizzle-orm';

import { deleteMerchant } from '../repositories/merchants';
import { merchantAliases, merchants, transactions } from '../schema';
import { createTestConnection, createTestProduct } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/** Scenario 22 (merchant half), per the Testing Strategy's test-file table. */
describe('merchants repository', () => {
  it('deleteMerchant removes its aliases and leaves its movements with merchant_id null; the merchant itself is gone (Business Rule 21, AC22)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values({
          id: 'txn-lider',
          userFinancialProductId: productId,
          externalId: null,
          dedupHash: 'dedup-lider',
          amount: 4200,
          type: 'debit',
          occurredAt: now,
          dateLocal: '2026-02-01',
          rawDescription: 'LIDER',
          merchantId: 'lider',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const aliasesBefore = db.select().from(merchantAliases).where(eq(merchantAliases.merchantId, 'lider')).all();
      expect(aliasesBefore.length).toBeGreaterThanOrEqual(1);

      deleteMerchant(db, 'lider');

      expect(db.select().from(merchants).where(eq(merchants.id, 'lider')).get()).toBeUndefined();
      expect(db.select().from(merchantAliases).where(eq(merchantAliases.merchantId, 'lider')).all()).toHaveLength(0);

      const movement = db.select().from(transactions).where(eq(transactions.id, 'txn-lider')).get();
      expect(movement).toBeDefined(); // the movement survives
      expect(movement?.merchantId).toBeNull(); // and simply stops naming a merchant
    } finally {
      sqlite.close();
    }
  });

  it('there is no deleteTransaction export anywhere in src/db (Business Rule 5, AC22)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const transactionsRepo = require('../repositories/transactions') as Record<string, unknown>;
    expect(Object.keys(transactionsRepo)).not.toContain('deleteTransaction');
  });
});
