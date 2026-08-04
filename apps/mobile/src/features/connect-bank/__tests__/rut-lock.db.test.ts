import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { createTestConnection } from '../../../db/testing/product-fixture';
import { writeCredentials } from '../../../lib/secure-store/credential-store';
import type { SecureStorePort } from '../../../lib/secure-store/types';
import { resolveLockedRut } from '../rut-lock';

/** Implementation plan Testing Strategy scenario 5 (AC18). */

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

describe('resolveLockedRut (Decision 6, AC18)', () => {
  it('returns null (unlocked) with no connections at all', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      expect(await resolveLockedRut(db, port)).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('returns the stored RUT for a single connection with a credential entry', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      createTestConnection(db, ports, 'banco-de-chile');
      await writeCredentials(port, 'banco-de-chile', { rut: '12.345.678-5', password: 'clave' });

      expect(await resolveLockedRut(db, port)).toBe('12.345.678-5');
    } finally {
      sqlite.close();
    }
  });

  it('returns null again once every entry has been deleted (the disconnect-everything edge)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      createTestConnection(db, ports, 'banco-de-chile');
      await writeCredentials(port, 'banco-de-chile', { rut: '12.345.678-5', password: 'clave' });
      await port.deleteItem('bank_creds:banco-de-chile');

      expect(await resolveLockedRut(db, port)).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('with two connections, the older connection (by created_at) wins', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      createTestConnection(db, ports, 'banco-de-chile'); // created first
      createTestConnection(db, ports, 'santander'); // created second
      await writeCredentials(port, 'banco-de-chile', { rut: '11.111.111-1', password: 'clave-1' });
      await writeCredentials(port, 'santander', { rut: '22.222.222-2', password: 'clave-2' });

      expect(await resolveLockedRut(db, port)).toBe('11.111.111-1');
    } finally {
      sqlite.close();
    }
  });

  it("finds the second connection's entry when the first (older) connection's entry was deleted", async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort();
    try {
      createTestConnection(db, ports, 'banco-de-chile');
      createTestConnection(db, ports, 'santander');
      await writeCredentials(port, 'santander', { rut: '22.222.222-2', password: 'clave-2' });
      // No credential entry was ever written for banco-de-chile in this scenario.

      expect(await resolveLockedRut(db, port)).toBe('22.222.222-2');
    } finally {
      sqlite.close();
    }
  });
});
