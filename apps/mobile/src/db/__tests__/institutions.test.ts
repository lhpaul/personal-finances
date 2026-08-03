import { eq } from 'drizzle-orm';

import { listBankConnections } from '../repositories/connections';
import {
  deleteConnectionIfNeverSynced,
  disconnectInstitution,
  getConnectionByInstitution,
  listConnectableInstitutions,
  listConnectedBankSummaries,
  listConnectionsForCredentialLookup,
  listInstitutions,
  markConnectionSyncing,
  upsertConnection,
} from '../repositories/institutions';
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

/** Implementation plan for issue #9, Testing Strategy scenario 3-4: connect-time writes. */
describe('institutions repository — connect-a-bank writes (issue #9)', () => {
  it('listInstitutions returns every seeded bank, available and coming-soon alike (AC7, AC8)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const institutions = listInstitutions(db);
      expect(institutions).toHaveLength(6);
      const banco = institutions.find((row) => row.id === 'banco-de-chile');
      expect(banco).toMatchObject({ name: 'Banco de Chile', scraperStatus: 'available', shortName: 'BCH' });
      const santander = institutions.find((row) => row.id === 'santander');
      expect(santander).toMatchObject({ scraperStatus: 'coming_soon' });
    } finally {
      sqlite.close();
    }
  });

  it('upsertConnection inserts a new connection with status active, sync_status idle (AC19)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const { id, created } = upsertConnection(db, {
        institutionId: 'banco-de-chile',
        credentialsKey: 'bank_creds:banco-de-chile',
        newId: ports.newId,
        now: ports.now,
      });
      expect(created).toBe(true);

      const row = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.id, id))
        .get();
      expect(row).toMatchObject({
        financialInstitutionId: 'banco-de-chile',
        status: 'active',
        credentialsKey: 'bank_creds:banco-de-chile',
        syncStatus: 'idle',
        lastSyncAt: null,
        lastSuccessAt: null,
      });
    } finally {
      sqlite.close();
    }
  });

  it('upsertConnection called twice for the same bank leaves exactly one connection (AC20)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const first = upsertConnection(db, {
        institutionId: 'banco-de-chile',
        credentialsKey: 'bank_creds:banco-de-chile',
        newId: ports.newId,
        now: ports.now,
      });
      const second = upsertConnection(db, {
        institutionId: 'banco-de-chile',
        credentialsKey: 'bank_creds:banco-de-chile',
        newId: ports.newId,
        now: ports.now,
      });

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.id).toBe(first.id);

      const rows = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.financialInstitutionId, 'banco-de-chile'))
        .all();
      expect(rows).toHaveLength(1);
    } finally {
      sqlite.close();
    }
  });

  it('upsertConnection on an existing connection leaves credentials_key, last_sync_at and last_success_at untouched (Business Rules 14-15, AC21)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      db.update(userFinancialInstitutions)
        .set({
          lastSyncAt: '2026-02-01T00:00:00.000Z',
          lastSuccessAt: '2026-02-01T00:00:00.000Z',
          lastErrorCode: 'invalid_credentials',
        })
        .where(eq(userFinancialInstitutions.id, connectionId))
        .run();

      const { id, created } = upsertConnection(db, {
        institutionId: 'banco-de-chile',
        credentialsKey: 'a-different-key-is-ignored-on-update',
        newId: ports.newId,
        now: ports.now,
      });
      expect(created).toBe(false);
      expect(id).toBe(connectionId);

      const row = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.id, connectionId))
        .get();
      expect(row).toMatchObject({
        status: 'active',
        credentialsKey: `secure-store-key-${connectionId}`, // untouched — createTestConnection's original value
        lastSyncAt: '2026-02-01T00:00:00.000Z',
        lastSuccessAt: '2026-02-01T00:00:00.000Z',
        lastErrorCode: 'invalid_credentials',
      });
    } finally {
      sqlite.close();
    }
  });

  it('markConnectionSyncing sets sync_status syncing and last_sync_at, without touching last_success_at (AC22)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      db.update(userFinancialInstitutions)
        .set({ lastSuccessAt: '2026-02-01T00:00:00.000Z' })
        .where(eq(userFinancialInstitutions.id, connectionId))
        .run();

      markConnectionSyncing(db, connectionId, '2026-02-05T00:00:00.000Z');

      const row = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.id, connectionId))
        .get();
      expect(row).toMatchObject({
        syncStatus: 'syncing',
        lastSyncAt: '2026-02-05T00:00:00.000Z',
        lastSuccessAt: '2026-02-01T00:00:00.000Z', // untouched
      });
    } finally {
      sqlite.close();
    }
  });

  it('deleteConnectionIfNeverSynced removes a connection with no last_success_at (Decision 7 compensating delete)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      deleteConnectionIfNeverSynced(db, connectionId);
      expect(
        db.select().from(userFinancialInstitutions).where(eq(userFinancialInstitutions.id, connectionId)).get(),
      ).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });

  it('deleteConnectionIfNeverSynced refuses to delete a connection that has completed a sync (Business Rule 19)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      db.update(userFinancialInstitutions)
        .set({ lastSuccessAt: '2026-02-01T00:00:00.000Z' })
        .where(eq(userFinancialInstitutions.id, connectionId))
        .run();

      deleteConnectionIfNeverSynced(db, connectionId);

      expect(
        db.select().from(userFinancialInstitutions).where(eq(userFinancialInstitutions.id, connectionId)).get(),
      ).toBeDefined();
    } finally {
      sqlite.close();
    }
  });

  it('getConnectionByInstitution returns undefined when no connection exists, and the connection once one does', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      expect(getConnectionByInstitution(db, 'banco-de-chile')).toBeUndefined();
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      const found = getConnectionByInstitution(db, 'banco-de-chile');
      expect(found?.id).toBe(connectionId);
      expect(found?.institutionName).toBe('Banco de Chile');
    } finally {
      sqlite.close();
    }
  });

  it('listConnectionsForCredentialLookup orders by created_at, oldest first (Decision 6)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const firstId = createTestConnection(db, ports, 'banco-de-chile');
      const secondId = createTestConnection(db, ports, 'santander');
      const rows = listConnectionsForCredentialLookup(db);
      expect(rows.map((row) => row.id)).toEqual([firstId, secondId]);
      expect(rows[0]).toMatchObject({ institutionId: 'banco-de-chile' });
    } finally {
      sqlite.close();
    }
  });

  it('listConnectedBankSummaries returns nothing until a connection has completed a sync (Business Rule 23, Decision 15)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      createTestConnection(db, ports, 'banco-de-chile');
      expect(listConnectedBankSummaries(db)).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('listConnectedBankSummaries reports the product and movement counts the sync actually stored (AC24, AC25)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      db.update(userFinancialInstitutions)
        .set({ lastSuccessAt: ports.now() })
        .where(eq(userFinancialInstitutions.id, connectionId))
        .run();
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      db.insert(transactions)
        .values([
          {
            id: 'summary-txn-1',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'summary-txn-1',
            amount: 1000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-01',
            rawDescription: 'One',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'summary-txn-2',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'summary-txn-2',
            amount: 2000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-02',
            rawDescription: 'Two',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      // A second, unsynced connection must not appear and must not pollute the counts.
      createTestConnection(db, ports, 'santander');

      const summaries = listConnectedBankSummaries(db);
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        id: connectionId,
        institutionName: 'Banco de Chile',
        institutionShortName: 'BCH',
        productCount: 1,
        movementCount: 2,
      });
    } finally {
      sqlite.close();
    }
  });
});
