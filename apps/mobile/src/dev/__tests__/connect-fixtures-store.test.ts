import type { AppDatabase } from '../../db/types';
import type { SecureStorePort } from '../../lib/secure-store/types';
import {
  __resetConnectFixturesCredentialTrackingForTests,
  clearConnectFixtures,
  plantCredentialEntry,
} from '../connect-fixtures-store';

// `jest.mock` calls are hoisted above every import by `babel-plugin-jest-hoist`, so the mocks
// below apply to `connect-fixtures-store.ts`'s imports above regardless of source order (mirrors
// `use-home-data.test.ts`'s precedent — keeping every import together, ahead of the mocks, is
// also what keeps this file free of an `import/first` finding). This test exercises the
// credential-isolation logic only — `getAppDatabase` and the DB-row-clearing half of
// `clearConnectFixtures` are stubbed so no real SQLite instance is needed for what is a
// secure-store-only regression.
jest.mock('../../db/runtime', () => ({
  getAppDatabase: jest.fn().mockResolvedValue({} as AppDatabase),
}));
jest.mock('../../db/dev-connect-fixture', () => ({
  clearConnectFixtures: jest.fn(),
  plantSyncedConnection: jest.fn(),
}));

/**
 * Found in review (CodeRabbit PR #80, round 3): `plantCredentialEntry` was overwriting, and
 * `clearConnectFixtures` unconditionally deleting, whatever real credential a developer's own
 * device already had for either fixture institution. `plantCredentialEntry`/`clearConnectFixtures`
 * both now accept an optional `SecureStorePort`, so this suite substitutes the same in-memory fake
 * `credential-store.test.ts` uses instead of touching `expo-secure-store` (which has no Jest mock
 * and cannot be imported outside `src/lib/secure-store/`).
 */
function createFakePort(initial: Record<string, string> = {}): SecureStorePort {
  const store = new Map(Object.entries(initial));
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

describe('plantCredentialEntry / clearConnectFixtures — credential isolation (found in review)', () => {
  afterEach(() => {
    __resetConnectFixturesCredentialTrackingForTests();
  });

  it('restores a real pre-existing Banco de Chile credential after plant + clear', async () => {
    const realCredential = JSON.stringify({ rut: '11.111.111-1', password: 'REAL_PASSWORD' });
    const port = createFakePort({ 'bank_creds:banco-de-chile': realCredential });

    await plantCredentialEntry(port);
    // The fixture value is in place while the panel is being used.
    await expect(port.getItem('bank_creds:banco-de-chile')).resolves.not.toBe(realCredential);

    await clearConnectFixtures(port);
    await expect(port.getItem('bank_creds:banco-de-chile')).resolves.toBe(realCredential);
  });

  it('deletes the fixture credential on clear when there was nothing before it', async () => {
    const port = createFakePort();

    await plantCredentialEntry(port);
    await expect(port.getItem('bank_creds:banco-de-chile')).resolves.not.toBeNull();

    await clearConnectFixtures(port);
    await expect(port.getItem('bank_creds:banco-de-chile')).resolves.toBeNull();
  });

  it('never touches a real Santander credential that this module did not itself write', async () => {
    const realSantanderCredential = JSON.stringify({ rut: '22.222.222-2', password: 'SANTANDER_REAL' });
    const port = createFakePort({ 'bank_creds:santander': realSantanderCredential });

    // Only the Banco de Chile fixture credential is ever planted by this module — Santander's
    // credential is never touched by `plantCredentialEntry`.
    await plantCredentialEntry(port);
    await clearConnectFixtures(port);

    await expect(port.getItem('bank_creds:santander')).resolves.toBe(realSantanderCredential);
  });

  it('a second plant does not overwrite the captured prior credential with the fixture value', async () => {
    const realCredential = JSON.stringify({ rut: '33.333.333-3', password: 'REAL_TWICE' });
    const port = createFakePort({ 'bank_creds:banco-de-chile': realCredential });

    await plantCredentialEntry(port);
    await plantCredentialEntry(port); // e.g. the person taps "Plantar credencial" twice
    await clearConnectFixtures(port);

    await expect(port.getItem('bank_creds:banco-de-chile')).resolves.toBe(realCredential);
  });

  it('clearConnectFixtures with no prior plantCredentialEntry call leaves secure storage untouched', async () => {
    const realCredential = JSON.stringify({ rut: '44.444.444-4', password: 'UNTOUCHED' });
    const port = createFakePort({ 'bank_creds:banco-de-chile': realCredential });

    // Simulates a developer who only ran plantOneSyncedConnection / plantTwoSyncedConnections
    // (neither of which writes a credential) before clearing.
    await clearConnectFixtures(port);

    await expect(port.getItem('bank_creds:banco-de-chile')).resolves.toBe(realCredential);
  });
});
