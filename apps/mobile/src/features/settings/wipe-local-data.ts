import { listInstitutions, listConnectionsForCredentialLookup } from '../../db/repositories/institutions';
import type { AppDatabase } from '../../db/types';
import { credentialsKeyFor, deleteAllCredentials } from '../../lib/secure-store/credential-store';
import type { SecureStorePort } from '../../lib/secure-store/types';

/**
 * Every `bank_creds:<institutionId>` key this device could ever hold (implementation plan for
 * issue #19, Decision 2) — a **derivation**, not a runtime enumeration, because
 * `SecureStorePort` deliberately has no "list every key" method (item #9's Decision 4: a real
 * keychain offers no such API).
 *
 * Two sources, because each covers the other's blind spot:
 * - {@link listConnectionsForCredentialLookup} — the key that was actually written, for every
 *   connection this device has ever made, **including** a `disconnected` one (the derivation
 *   must not filter by `status`).
 * - {@link listInstitutions} — the full seeded catalogue. `credentialsKeyFor` is deterministic
 *   (`'bank_creds:' + id`), so this sweeps an **orphan** key: one whose connection row was
 *   already deleted, or that was written by a connect attempt that crashed before its
 *   transaction committed.
 *
 * The claim "`bank_creds:<institutionId>` is the only key namespace this app ever writes" is held
 * by a test, not by this comment — `src/__tests__/secure-store-key-namespace.test.ts` scans every
 * `setItem(` call site under `src/**` and fails if one bypasses `credentialsKeyFor(...)`.
 */
export function collectCredentialKeys(db: AppDatabase): string[] {
  const fromConnections = listConnectionsForCredentialLookup(db).map(
    (connection) => connection.credentialsKey,
  );
  const fromCatalogue = listInstitutions(db).map((institution) => credentialsKeyFor(institution.id));
  return Array.from(new Set([...fromConnections, ...fromCatalogue]));
}

/**
 * A closed union with **no message, no key name and no cause payload** (implementation plan
 * Decision 1) — an error string that interpolated a key would put `bank_creds:banco-de-chile` in
 * a log line. The union carries only enough for the UI to pick one of two catalogue keys.
 */
export type WipeResult =
  | { status: 'ok' }
  | { status: 'credentials_failed' }
  | { status: 'store_failed' };

export interface WipeLocalDataDeps {
  db: AppDatabase;
  secureStore: SecureStorePort;
  /** Closes the database handle, deletes the file, and clears the memoized handle and bootstrap
   * single-flight (`resetAppDatabase()`, `src/db/runtime.ts`). Injected so this module has no
   * `expo-*` import of its own (Decision 17) — the real assembly lives in
   * `use-wipe-local-data.ts`. */
  resetStore: () => Promise<void>;
}

/**
 * The product's only destructive operation (implementation plan for issue #19, Decision 1) — an
 * ordered, fail-closed sequence over injected ports, so a Node-tier test can run the real thing
 * against a real `better-sqlite3` store and a fully enumerable in-memory secure-store fake:
 *
 * 1. Read the credential key space from the database **first** — it is the only enumerable index
 *    of what the keychain might hold, so it must be read while the store still exists.
 * 2. Delete every key.
 * 3. Read each key back. If **any** survives, stop here and return `'credentials_failed'` —
 *    **before** touching the database. The database is deliberately not deleted in this branch:
 *    if the file went first and a keychain delete then failed, the surviving secret would become
 *    an un-enumerable orphan (AGENTS.md non-negotiable 1). Failing closed here leaves the device
 *    in a fully consistent, retryable pre-wipe state.
 * 4. Close/delete the database file and clear the memoized handle and bootstrap single-flight
 *    (`resetStore`). A rejection here is caught and reported as `'store_failed'` — this function
 *    never throws, so a caller can never receive an unhandled rejection from the only operation
 *    in the product that cannot be undone.
 *
 * No `DELETE` statement is issued anywhere in this module — the store is destroyed as a file, not
 * as a set of rows (Decision 11). That is what keeps this operation from ever being reusable to
 * delete a single movement, which Business Rule 3 forbids.
 */
export async function wipeLocalData(deps: WipeLocalDataDeps): Promise<WipeResult> {
  const keys = collectCredentialKeys(deps.db);

  await deleteAllCredentials(deps.secureStore, keys);

  for (const key of keys) {
    const survivor = await deps.secureStore.getItem(key);
    if (survivor !== null) {
      return { status: 'credentials_failed' };
    }
  }

  try {
    await deps.resetStore();
  } catch {
    return { status: 'store_failed' };
  }

  return { status: 'ok' };
}
