import { clearConnectFixtures as clearConnectFixtureRows, plantSyncedConnection } from '../db/dev-connect-fixture';
import { getAppDatabase } from '../db/runtime';
import { deleteCredentials, writeCredentials } from '../lib/secure-store/credential-store';
import { expoSecureStoreAdapter } from '../lib/secure-store/expo-secure-store.adapter';

/**
 * `getAppDatabase()`-calling wrappers around `src/db/dev-connect-fixture.ts` plus the secure-store
 * credential functions (implementation plan Decision 13) — the `app/ → feature hooks → src/db`
 * layering applied to a `__DEV__`-only surface, mirroring `src/dev/sample-store.ts`.
 * `ConnectFlowFixtures.tsx` calls these functions and nothing else in `src/db` or
 * `src/lib/secure-store` directly, keeping `dbAccessBoundary` and `secureStoreBoundary` intact.
 */

const PRIMARY_INSTITUTION_ID = 'banco-de-chile';
const SECONDARY_INSTITUTION_ID = 'santander'; // coming-soon at the picker, legitimate at the data layer (Assumption A6)

/** `{"rut":"12.345.678-5","password":"ZZFIXTUREPASSZZ"}` — Seed Data table. `12.345.678-5` is the
 * runbook's own valid RUT (Assumption A1: the mockup's own placeholder has a wrong check digit). */
const FIXTURE_RUT = '12.345.678-5';
const FIXTURE_PASSWORD = 'ZZFIXTUREPASSZZ';

export async function plantCredentialEntry(): Promise<void> {
  await writeCredentials(expoSecureStoreAdapter, PRIMARY_INSTITUTION_ID, {
    rut: FIXTURE_RUT,
    password: FIXTURE_PASSWORD,
  });
}

export async function plantOneSyncedConnection(): Promise<void> {
  const db = await getAppDatabase();
  plantSyncedConnection(db, PRIMARY_INSTITUTION_ID, { productCount: 3, movementCount: 57 });
}

export async function plantTwoSyncedConnections(): Promise<void> {
  const db = await getAppDatabase();
  plantSyncedConnection(db, PRIMARY_INSTITUTION_ID, { productCount: 3, movementCount: 57 });
  plantSyncedConnection(db, SECONDARY_INSTITUTION_ID, { productCount: 2, movementCount: 31 });
}

export async function clearConnectFixtures(): Promise<void> {
  const db = await getAppDatabase();
  clearConnectFixtureRows(db, [PRIMARY_INSTITUTION_ID, SECONDARY_INSTITUTION_ID]);
  await deleteCredentials(expoSecureStoreAdapter, PRIMARY_INSTITUTION_ID);
  await deleteCredentials(expoSecureStoreAdapter, SECONDARY_INSTITUTION_ID);
}

export { PRIMARY_INSTITUTION_ID as FIXTURE_PRIMARY_INSTITUTION_ID };
