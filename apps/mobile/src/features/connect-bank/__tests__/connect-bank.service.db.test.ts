import { userFinancialInstitutions } from '../../../db/schema';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { readCredentials } from '../../../lib/secure-store/credential-store';
import type { SecureStorePort } from '../../../lib/secure-store/types';
import { connectBank } from '../connect-bank.service';

/**
 * Implementation plan Testing Strategy scenarios 3-4 (AC4, AC17, AC19, AC20, AC21, AC22).
 *
 * No `drizzle-orm` import here — `apps/mobile/src/db/` is the only directory allowed to import
 * it (`dbAccessBoundary`). Every row is fetched with an unfiltered `db.select().from(...).all()`
 * and narrowed in plain JS, and every "simulate a later sync outcome" write goes through the raw
 * `sqlite` handle `openBootstrappedMemoryDb()` already hands back — no new import needed for it.
 */

interface ConnectionRow {
  id: string;
  financialInstitutionId: string;
  status: string;
  credentialsKey: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
}

function createFakePort(): SecureStorePort {
  const store = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    deleteItem: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

describe('connectBank (issue #9)', () => {
  it('creates exactly one connection, holding the key and no credential value (AC19)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      const result = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: '12.345.678-5', password: 'clave-uno' },
      );

      const rows = db.select().from(userFinancialInstitutions).all() as ConnectionRow[];
      const forThisBank = rows.filter((row) => row.financialInstitutionId === 'banco-de-chile');
      expect(forThisBank).toHaveLength(1);
      expect(forThisBank[0]).toMatchObject({
        id: result.userFinancialInstitutionId,
        status: 'active',
        credentialsKey: result.credentialsKey,
        syncStatus: 'syncing',
      });
      // The connection row never carries a column literally holding a RUT or password value —
      // only the key name.
      expect(Object.values(forThisBank[0] as object)).not.toContain('12.345.678-5');
      expect(Object.values(forThisBank[0] as object)).not.toContain('clave-uno');
    } finally {
      sqlite.close();
    }
  });

  it('connecting the same bank twice leaves one secure-store key and one connection (AC4, AC17, AC20)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      const first = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: '12.345.678-5', password: 'clave-uno' },
      );
      const second = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: '12.345.678-5', password: 'clave-dos' },
      );

      expect(second.userFinancialInstitutionId).toBe(first.userFinancialInstitutionId);
      expect(second.credentialsKey).toBe(first.credentialsKey);

      const rows = db.select().from(userFinancialInstitutions).all() as ConnectionRow[];
      const forThisBank = rows.filter((row) => row.financialInstitutionId === 'banco-de-chile');
      expect(forThisBank).toHaveLength(1);

      // The stored credential was replaced by the second call (AC17).
      await expect(readCredentials(port, 'banco-de-chile')).resolves.toEqual({
        rut: '12.345.678-5',
        password: 'clave-dos',
      });
    } finally {
      sqlite.close();
    }
  });

  it('connecting a second institution creates a second connection and a second secure-store entry (AC4)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      const first = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: '12.345.678-5', password: 'clave-uno' },
      );
      const second = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'santander', rut: '12.345.678-5', password: 'clave-dos' },
      );

      expect(second.userFinancialInstitutionId).not.toBe(first.userFinancialInstitutionId);
      expect(second.credentialsKey).not.toBe(first.credentialsKey);

      const rows = db.select().from(userFinancialInstitutions).all();
      expect(rows).toHaveLength(2);

      await expect(readCredentials(port, 'banco-de-chile')).resolves.toEqual({
        rut: '12.345.678-5',
        password: 'clave-uno',
      });
      await expect(readCredentials(port, 'santander')).resolves.toEqual({
        rut: '12.345.678-5',
        password: 'clave-dos',
      });
    } finally {
      sqlite.close();
    }
  });

  it('the connection genuinely passes idle -> syncing (Business Rule 17)', async () => {
    // item #10's canonical markConnectionSyncing (merged after this item's implementation
    // started) writes only sync_status — last_sync_at is written once by whichever exit
    // function (recordSyncOutcomeInTx / recordSyncOutcome) eventually resolves this attempt,
    // never at connect time. AC22's "two separate facts" still holds: neither is set yet.
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      const result = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: '12.345.678-5', password: 'clave-uno' },
      );
      const rows = db.select().from(userFinancialInstitutions).all() as ConnectionRow[];
      const row = rows.find((candidate) => candidate.id === result.userFinancialInstitutionId);
      expect(row?.syncStatus).toBe('syncing');
      expect(row?.lastSyncAt).toBeNull();
      expect(row?.lastSuccessAt).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('a later failed attempt never clobbers an earlier success — two separate facts (AC22)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      const result = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: '12.345.678-5', password: 'clave-uno' },
      );

      const successAt = '2026-02-01T00:00:00.000Z';
      sqlite
        .prepare('UPDATE user_financial_institutions SET sync_status = ?, last_success_at = ? WHERE id = ?')
        .run('ok', successAt, result.userFinancialInstitutionId);

      // A later re-connect attempt (a retry) re-marks the connection syncing, but must not touch
      // last_success_at.
      await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: '12.345.678-5', password: 'clave-corregida' },
      );

      const rows = db.select().from(userFinancialInstitutions).all() as ConnectionRow[];
      const row = rows.find((candidate) => candidate.id === result.userFinancialInstitutionId);
      expect(row?.syncStatus).toBe('syncing');
      expect(row?.lastSuccessAt).toBe(successAt); // untouched by the later attempt
    } finally {
      sqlite.close();
    }
  });

  it('a connection whose first sync failed still exists, with its stored credentials intact (AC21)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      const result = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: '12.345.678-5', password: 'clave-uno' },
      );
      // Simulate item #10 recording a failed first sync.
      sqlite
        .prepare('UPDATE user_financial_institutions SET sync_status = ?, last_error_code = ? WHERE id = ?')
        .run('error', 'invalid_credentials', result.userFinancialInstitutionId);

      const rows = db.select().from(userFinancialInstitutions).all() as ConnectionRow[];
      const row = rows.find((candidate) => candidate.id === result.userFinancialInstitutionId);
      expect(row).toBeDefined();
      expect(row?.status).toBe('active');
      await expect(readCredentials(port, 'banco-de-chile')).resolves.toEqual({
        rut: '12.345.678-5',
        password: 'clave-uno',
      });
    } finally {
      sqlite.close();
    }
  });
});
