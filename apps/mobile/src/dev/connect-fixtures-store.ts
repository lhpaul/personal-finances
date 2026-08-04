import { clearConnectFixtures as clearConnectFixtureRows, plantSyncedConnection } from '../db/dev-connect-fixture';
import { getAppDatabase } from '../db/runtime';
import {
  deleteCredentials,
  readCredentials,
  writeCredentials,
  type BankCredentials,
} from '../lib/secure-store/credential-store';
import { expoSecureStoreAdapter } from '../lib/secure-store/expo-secure-store.adapter';
import type { SecureStorePort } from '../lib/secure-store/types';

/**
 * `getAppDatabase()`-calling wrappers around `src/db/dev-connect-fixture.ts` plus the secure-store
 * credential functions (implementation plan Decision 13) — the `app/ → feature hooks → src/db`
 * layering applied to a `__DEV__`-only surface, mirroring `src/dev/sample-store.ts`.
 * `ConnectFlowFixtures.tsx` calls these functions and nothing else in `src/db` or
 * `src/lib/secure-store` directly, keeping `dbAccessBoundary` and `secureStoreBoundary` intact.
 *
 * `plantCredentialEntry` and `clearConnectFixtures` accept an optional `port` (defaulting to
 * {@link expoSecureStoreAdapter}) so tests can substitute an in-memory `SecureStorePort` —
 * `expo-secure-store` itself has no Jest mock, and this module's own boundary rules forbid any
 * file outside `src/lib/secure-store/` from importing it. `ConnectFlowFixtures.tsx` calls both
 * with zero arguments, exactly as before this parameter was added.
 */

const PRIMARY_INSTITUTION_ID = 'banco-de-chile';
const SECONDARY_INSTITUTION_ID = 'santander'; // coming-soon at the picker, legitimate at the data layer (Assumption A6)

/** `{"rut":"12.345.678-5","password":"ZZFIXTUREPASSZZ"}` — Seed Data table. `12.345.678-5` is the
 * runbook's own valid RUT (Assumption A1: the mockup's own placeholder has a wrong check digit). */
const FIXTURE_RUT = '12.345.678-5';
const FIXTURE_PASSWORD = 'ZZFIXTUREPASSZZ';

/**
 * Tracks, per institution, whatever secure-store credential predates this session's first
 * fixture write for that institution — `null` when there was none — so {@link clearConnectFixtures}
 * can restore it instead of unconditionally deleting (found in review, CodeRabbit PR #80 round 3:
 * `plantCredentialEntry` was overwriting, and `clearConnectFixtures` unconditionally deleting,
 * whatever real credential a developer's own device already had for either fixture institution —
 * a development profile with a genuine Banco de Chile or Santander connection could silently lose
 * its real credential, leaving the connection row behind but unable to authenticate on a later
 * sync). An institution absent from this map has never had its secure-store entry touched by this
 * module, so {@link clearConnectFixtures} leaves it alone entirely — it never deletes a credential
 * this module did not itself write.
 */
const priorCredentialsByInstitution = new Map<string, BankCredentials | null>();

/** Captures the current secure-store entry for `institutionId` exactly once per session (a
 * second capture would otherwise record this module's own fixture value as "prior" instead of
 * the real one it is about to overwrite). */
async function capturePriorCredentialOnce(port: SecureStorePort, institutionId: string): Promise<void> {
  if (priorCredentialsByInstitution.has(institutionId)) return;
  const existing = await readCredentials(port, institutionId);
  priorCredentialsByInstitution.set(institutionId, existing);
}

export async function plantCredentialEntry(port: SecureStorePort = expoSecureStoreAdapter): Promise<void> {
  await capturePriorCredentialOnce(port, PRIMARY_INSTITUTION_ID);
  await writeCredentials(port, PRIMARY_INSTITUTION_ID, {
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

export async function clearConnectFixtures(port: SecureStorePort = expoSecureStoreAdapter): Promise<void> {
  const db = await getAppDatabase();
  clearConnectFixtureRows(db, [PRIMARY_INSTITUTION_ID, SECONDARY_INSTITUTION_ID]);

  for (const institutionId of [PRIMARY_INSTITUTION_ID, SECONDARY_INSTITUTION_ID]) {
    if (!priorCredentialsByInstitution.has(institutionId)) continue;
    const prior = priorCredentialsByInstitution.get(institutionId) ?? null;
    priorCredentialsByInstitution.delete(institutionId);
    if (prior === null) {
      await deleteCredentials(port, institutionId);
    } else {
      await writeCredentials(port, institutionId, prior);
    }
  }
}

/** Test-only escape hatch — mirrors `connect-flow-store.ts`'s `__resetConnectFlowForTests`. */
export function __resetConnectFixturesCredentialTrackingForTests(): void {
  priorCredentialsByInstitution.clear();
}

export { PRIMARY_INSTITUTION_ID as FIXTURE_PRIMARY_INSTITUTION_ID, SECONDARY_INSTITUTION_ID as FIXTURE_SECONDARY_INSTITUTION_ID };
