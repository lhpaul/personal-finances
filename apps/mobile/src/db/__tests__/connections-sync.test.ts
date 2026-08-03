import { eq } from 'drizzle-orm';

import {
  clearStuckSyncingConnections,
  getConnection,
  listSyncableConnections,
  markConnectionSyncing,
  recordSyncOutcome,
  recordSyncOutcomeInTx,
} from '../repositories/institutions';
import { userFinancialInstitutions } from '../schema';
import { createTestConnection } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/**
 * Implementation plan Decisions 8, 11 (issue #10): the connection's sync bookkeeping. Spec
 * Business Rules 23-26; AC10-AC13, AC26.
 */

describe('connection sync bookkeeping (Decision 8, AC10-AC13)', () => {
  it('getConnection joins the institution\'s country code, so a ScraperRunner call needs no second lookup', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const connection = getConnection(db, connectionId);
      expect(connection?.financialInstitutionId).toBe('banco-de-chile');
      expect(connection?.countryCode).toBe('CL');
    } finally {
      sqlite.close();
    }
  });

  it('markConnectionSyncing writes only sync_status — last_sync_at is untouched (Decision 8)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const before = getConnection(db, connectionId);
      expect(before?.lastSyncAt).toBeNull();

      markConnectionSyncing(db, connectionId);

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('syncing');
      expect(after?.lastSyncAt).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('a failed read records the attempt and the failure reason, leaves last_success_at untouched, and moves to error (AC10)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      markConnectionSyncing(db, connectionId);

      // A prior successful sync, so "untouched" is a meaningful assertion, not vacuously null.
      recordSyncOutcome(db, connectionId, { outcome: 'complete' }, '2026-02-01T10:00:00.000Z');
      const priorSuccess = getConnection(db, connectionId)?.lastSuccessAt;
      expect(priorSuccess).toBe('2026-02-01T10:00:00.000Z');

      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(
        db,
        connectionId,
        { outcome: 'failed', errorCode: 'invalid_credentials', errorMessage: 'sync.errors.invalid_credentials' },
        '2026-02-02T10:00:00.000Z',
      );

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('error');
      expect(after?.lastSyncAt).toBe('2026-02-02T10:00:00.000Z');
      expect(after?.lastSuccessAt).toBe(priorSuccess); // untouched
      expect(after?.lastErrorCode).toBe('invalid_credentials');
      expect(after?.lastErrorMessage).toBe('sync.errors.invalid_credentials');
    } finally {
      sqlite.close();
    }
  });

  it('a partial read is recorded exactly like a failed read: error state, last_success_at not advanced (AC11)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(
        db,
        connectionId,
        { outcome: 'partial', errorCode: 'parse_failed', errorMessage: 'sync.errors.parse_failed' },
        '2026-02-03T10:00:00.000Z',
      );

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('error');
      expect(after?.lastSuccessAt).toBeNull();
      expect(after?.lastErrorCode).toBe('parse_failed');
    } finally {
      sqlite.close();
    }
  });

  it('a successful read is ok, with last_success_at exactly equal to last_sync_at, and clears a previous failure (AC12)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(
        db,
        connectionId,
        { outcome: 'failed', errorCode: 'network', errorMessage: 'sync.errors.network' },
        '2026-02-04T10:00:00.000Z',
      );
      expect(getConnection(db, connectionId)?.lastErrorCode).toBe('network');

      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(db, connectionId, { outcome: 'complete' }, '2026-02-05T10:00:00.000Z');

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('ok');
      expect(after?.lastSyncAt).toBe('2026-02-05T10:00:00.000Z');
      expect(after?.lastSuccessAt).toBe('2026-02-05T10:00:00.000Z');
      expect(after?.lastSyncAt).toBe(after?.lastSuccessAt);
      expect(after?.lastErrorCode).toBeNull();
      expect(after?.lastErrorMessage).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('a stopped (cancelled) read returns to idle, records no failure, and does not advance last_success_at (AC13)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(db, connectionId, { outcome: 'complete' }, '2026-02-06T10:00:00.000Z');

      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(db, connectionId, { outcome: 'cancelled' }, '2026-02-07T10:00:00.000Z');

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('idle');
      expect(after?.lastSyncAt).toBe('2026-02-07T10:00:00.000Z');
      expect(after?.lastSuccessAt).toBe('2026-02-06T10:00:00.000Z'); // untouched
      expect(after?.lastErrorCode).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('a cancelled sync leaves an older failure alone — the connection does not silently become auto-sync-eligible again (Decision 10, Assumption A2)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(
        db,
        connectionId,
        { outcome: 'failed', errorCode: 'invalid_credentials', errorMessage: 'sync.errors.invalid_credentials' },
        '2026-02-08T10:00:00.000Z',
      );

      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(db, connectionId, { outcome: 'cancelled' }, '2026-02-09T10:00:00.000Z');

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('idle');
      // Planted-negative proof: if a stop cleared the failure, this would be null.
      expect(after?.lastErrorCode).toBe('invalid_credentials');
    } finally {
      sqlite.close();
    }
  });

  it('recordSyncOutcomeInTx runs inside a caller-supplied transaction, with the same semantics as the standalone wrapper', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      markConnectionSyncing(db, connectionId);

      db.transaction((tx) => {
        recordSyncOutcomeInTx(tx, connectionId, { outcome: 'complete' }, '2026-02-10T10:00:00.000Z');
      });

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('ok');
      expect(after?.lastSuccessAt).toBe('2026-02-10T10:00:00.000Z');
    } finally {
      sqlite.close();
    }
  });
});

describe('crash recovery (Decision 11, Business Rule 25, AC26)', () => {
  it('a connection stuck at syncing is returned to idle, the attempt time is recorded, and no failure is written', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      markConnectionSyncing(db, connectionId);

      const cleared = clearStuckSyncingConnections(db, '2026-02-11T08:00:00.000Z');
      expect(cleared).toBe(1);

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('idle');
      expect(after?.lastSyncAt).toBe('2026-02-11T08:00:00.000Z');
      expect(after?.lastErrorCode).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('leaves last_success_at and an existing failure reason exactly as they were', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(db, connectionId, { outcome: 'complete' }, '2026-02-11T09:00:00.000Z');

      markConnectionSyncing(db, connectionId);
      recordSyncOutcome(
        db,
        connectionId,
        { outcome: 'failed', errorCode: 'session_closed', errorMessage: 'sync.errors.session_closed' },
        '2026-02-11T09:30:00.000Z',
      );

      markConnectionSyncing(db, connectionId); // simulates the app being killed mid-sync
      clearStuckSyncingConnections(db, '2026-02-11T10:00:00.000Z');

      const after = getConnection(db, connectionId);
      expect(after?.syncStatus).toBe('idle');
      expect(after?.lastSuccessAt).toBe('2026-02-11T09:00:00.000Z');
      expect(after?.lastErrorCode).toBe('session_closed');
    } finally {
      sqlite.close();
    }
  });

  it('a connection not stuck at syncing is left alone', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const before = getConnection(db, connectionId);
      expect(before?.syncStatus).toBe('idle');

      const cleared = clearStuckSyncingConnections(db, '2026-02-12T00:00:00.000Z');
      expect(cleared).toBe(0);

      const after = getConnection(db, connectionId);
      expect(after?.lastSyncAt).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('listSyncableConnections returns every connection regardless of status — filtering belongs to the eligibility predicate', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const activeId = createTestConnection(db, ports);
      db.update(userFinancialInstitutions).set({ status: 'inactive' }).where(eq(userFinancialInstitutions.id, activeId)).run();

      const rows = listSyncableConnections(db);
      expect(rows.map((r) => r.id)).toContain(activeId);
      expect(rows.find((r) => r.id === activeId)?.status).toBe('inactive');
    } finally {
      sqlite.close();
    }
  });
});
