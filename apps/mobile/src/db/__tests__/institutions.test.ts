import { eq } from 'drizzle-orm';

import { listBankConnections } from '../repositories/connections';
import { disconnectInstitution, listConnectableInstitutions } from '../repositories/institutions';
import { transactions, userFinancialInstitutions, userFinancialProducts } from '../schema';
import { createTestConnection, createTestProduct } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/** Scenario 22 (disconnect, credentials_key preservation, and cascade halves), per the Testing
 * Strategy's test-file table. */
describe('institutions repository', () => {
  it('listConnectableInstitutions returns only the available bank (spec "Which banks can be connected right now?")', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const connectable = listConnectableInstitutions(db);
      expect(connectable).toHaveLength(1);
      expect(connectable[0]?.id).toBe('banco-de-chile');
      expect(connectable[0]?.scraperStatus).toBe('available');
    } finally {
      sqlite.close();
    }
  });

  it('disconnectInstitution deletes nothing and leaves credentials_key byte-identical — only status changes (Business Rule 20, AC22)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const before = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.id, connectionId))
        .get();
      expect(before?.status).toBe('active');
      const credentialsKeyBefore = before?.credentialsKey;

      disconnectInstitution(db, connectionId);

      const after = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.id, connectionId))
        .get();
      expect(after?.status).toBe('disconnected');
      expect(after?.credentialsKey).toBe(credentialsKeyBefore);
      // Every other column is untouched.
      expect(after?.financialInstitutionId).toBe(before?.financialInstitutionId);
      expect(after?.syncStatus).toBe(before?.syncStatus);
      expect(after?.createdAt).toBe(before?.createdAt);
    } finally {
      sqlite.close();
    }
  });

  it('removing a connection cascades to its products and their movements (raw delete, PRAGMA foreign_keys = ON, Business Rule 20/22)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      db.insert(transactions)
        .values({
          id: 'txn-cascade',
          userFinancialProductId: productId,
          externalId: null,
          dedupHash: 'dedup-cascade',
          amount: 1000,
          type: 'debit',
          occurredAt: now,
          dateLocal: '2026-02-01',
          rawDescription: 'Cascade test',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(userFinancialInstitutions).where(eq(userFinancialInstitutions.id, connectionId)).run();

      expect(
        db.select().from(userFinancialProducts).where(eq(userFinancialProducts.id, productId)).get(),
      ).toBeUndefined();
      expect(db.select().from(transactions).where(eq(transactions.id, 'txn-cascade')).get()).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});

/** Home-screen implementation plan (issue #12) Scenario 7: `listBankConnections` returns every
 * connection regardless of status, with its full sync bookkeeping. */
describe('connections repository — listBankConnections (issue #12)', () => {
  it('returns an empty array for an empty store', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      expect(listBankConnections(db)).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('returns the institution name, logo and every sync bookkeeping column, including a disconnected connection (Decision 4 inputs)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const activeId = createTestConnection(db, ports, 'banco-de-chile');
      db.update(userFinancialInstitutions)
        .set({
          syncStatus: 'ok',
          lastSyncAt: '2026-02-27T21:14:00.000Z',
          lastSuccessAt: '2026-02-27T21:14:00.000Z',
        })
        .where(eq(userFinancialInstitutions.id, activeId))
        .run();

      const erroredId = createTestConnection(db, ports, 'santander');
      db.update(userFinancialInstitutions)
        .set({
          syncStatus: 'error',
          lastErrorCode: 'invalid_credentials',
          lastSuccessAt: '2026-02-26T10:00:00.000Z',
        })
        .where(eq(userFinancialInstitutions.id, erroredId))
        .run();
      disconnectInstitution(db, erroredId);

      const rows = listBankConnections(db).sort((a, b) => a.institutionName.localeCompare(b.institutionName));
      expect(rows).toHaveLength(2); // every connection, not only 'active' ones (unlike getConnectedBanksSummary)

      const active = rows.find((row) => row.id === activeId);
      expect(active).toMatchObject({
        institutionName: 'Banco de Chile',
        institutionShortName: 'BCH',
        status: 'active',
        syncStatus: 'ok',
        lastSyncAt: '2026-02-27T21:14:00.000Z',
        lastSuccessAt: '2026-02-27T21:14:00.000Z',
        lastErrorCode: null,
      });
      expect(typeof active?.institutionLogoUrl).toBe('string');

      const errored = rows.find((row) => row.id === erroredId);
      expect(errored).toMatchObject({
        institutionName: 'Banco Santander',
        status: 'disconnected', // disconnectInstitution only touches status; listBankConnections still reports it
        syncStatus: 'error',
        lastErrorCode: 'invalid_credentials',
        lastSuccessAt: '2026-02-26T10:00:00.000Z',
      });
    } finally {
      sqlite.close();
    }
  });
});
