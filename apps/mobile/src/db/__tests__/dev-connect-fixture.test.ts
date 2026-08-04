import { eq } from 'drizzle-orm';

import { clearConnectFixtures, plantSyncedConnection } from '../dev-connect-fixture';
import { transactions, userFinancialInstitutions, userFinancialProducts } from '../schema';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

describe('plantSyncedConnection / clearConnectFixtures (issue #9, Decision 13)', () => {
  it('plants a connection with the requested product and movement counts', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      plantSyncedConnection(db, 'banco-de-chile', { productCount: 3, movementCount: 57 });

      const connection = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.id, 'dev-fixture-connection-banco-de-chile'))
        .get();
      expect(connection).toMatchObject({ status: 'active', syncStatus: 'ok' });
      expect(connection?.lastSuccessAt).not.toBeNull();

      const products = db
        .select()
        .from(userFinancialProducts)
        .where(eq(userFinancialProducts.userFinancialInstitutionId, 'dev-fixture-connection-banco-de-chile'))
        .all();
      expect(products).toHaveLength(3);

      const productIds = products.map((product) => product.id);
      const allTransactions = db.select().from(transactions).all();
      const movements = allTransactions.filter((txn) => productIds.includes(txn.userFinancialProductId));
      expect(movements).toHaveLength(57);
    } finally {
      sqlite.close();
    }
  });

  it('re-planting the same institution replaces rather than duplicates', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      plantSyncedConnection(db, 'banco-de-chile', { productCount: 3, movementCount: 57 });
      plantSyncedConnection(db, 'banco-de-chile', { productCount: 1, movementCount: 1 });

      const connections = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.financialInstitutionId, 'banco-de-chile'))
        .all();
      expect(connections).toHaveLength(1);

      const products = db
        .select()
        .from(userFinancialProducts)
        .where(eq(userFinancialProducts.userFinancialInstitutionId, 'dev-fixture-connection-banco-de-chile'))
        .all();
      expect(products).toHaveLength(1);
    } finally {
      sqlite.close();
    }
  });

  it('clearConnectFixtures removes every planted connection, cascading to its products and movements', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      plantSyncedConnection(db, 'banco-de-chile', { productCount: 3, movementCount: 57 });
      plantSyncedConnection(db, 'santander', { productCount: 2, movementCount: 31 });

      clearConnectFixtures(db, ['banco-de-chile', 'santander']);

      const connections = db.select().from(userFinancialInstitutions).all();
      expect(connections).toHaveLength(0);
      const products = db.select().from(userFinancialProducts).all();
      expect(products).toHaveLength(0);
      // Found in review (CodeRabbit PR #80): the title promises movements cascade away too —
      // assert it, so a future schema change that drops the cascade fails loudly here.
      const movements = db.select().from(transactions).all();
      expect(movements).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });
});
