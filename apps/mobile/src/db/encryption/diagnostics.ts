import type { SecureStorePort } from '../../lib/secure-store/types';
import { CENSUS_TABLES } from './census';
import { DB_KEY_STORAGE_KEY, ENCRYPTED_DATABASE_NAME } from './constants';
import { quoteIdentifier } from './statements';
import type { CipherDatabasePort, CipherHandle, EncryptionDiagnostics, EncryptionState } from './types';

export interface RunEncryptionDiagnosticsDeps {
  port: CipherDatabasePort;
  secureStore: SecureStorePort;
  /** `Crypto.digestStringAsync(SHA256, …)` on the device (V24); `node:crypto`'s equivalent in
   * tests. Returns lowercase hex, matching every hash this codebase already produces
   * (`src/db/ids.ts`'s `DigestSha256`). */
  digestSha256: (input: string) => Promise<string>;
  /** `open-encrypted-store.ts`'s `getLastResolvedEncryptionState()` — the state resolved **at
   * launch**, never re-probed here (Decision 12: a fresh legacy-store probe would recreate a file
   * this item may have already deleted). */
  resolvedState: EncryptionState | undefined;
}

/** Opens `ENCRYPTED_DATABASE_NAME` with the given key (or no key at all) and reports whether a
 * real, non-empty schema was readable through it. Deliberately treats "opened cleanly but found
 * zero tables" the same as "threw" (`'failed'`): by the time this probe ever runs, the app has
 * already completed a real launch, so a genuinely correct open always finds the seeded and synced
 * content — zero tables means either the wrong key or (for the no-key case) a freshly-created,
 * still-unencrypted probe artefact, neither of which is the "succeeded" this probe is asking
 * about.
 *
 * **Always opens `{ forceNewConnection: true }`** (found in independent review). This probe runs
 * from the dev gallery *after* a successful launch, while `src/db/runtime.ts` still holds the
 * app's own live, correctly-keyed connection to this exact path open. Without forcing a new
 * connection, `expo-sqlite`'s cache-by-path-and-options behaviour (V17) would hand back that same
 * live handle regardless of the key passed here — silently reporting `'succeeded'` for the
 * no-key and wrong-key probes too — and this function's own `close()` would then tear down the
 * app's real connection out from under it. */
function probeOpen(port: CipherDatabasePort, keyHex: string | null): 'succeeded' | 'failed' {
  let handle: CipherHandle | undefined;
  try {
    handle =
      keyHex === null
        ? port.openPlain(ENCRYPTED_DATABASE_NAME, { forceNewConnection: true })
        : port.openKeyed(ENCRYPTED_DATABASE_NAME, keyHex, { forceNewConnection: true });
    return handle.userTableCount() > 0 ? 'succeeded' : 'failed';
  } catch {
    return 'failed';
  } finally {
    handle?.close();
  }
}

/** A fixed, deterministic key that is never the real stored key — used only to exercise "a wrong
 * key is rejected". Falls back to an alternate constant in the astronomically unlikely event the
 * real key happens to equal the first candidate. */
function wrongKeyDistinctFrom(realKeyHex: string | null): string {
  const candidate = '0'.repeat(64);
  return candidate === realKeyHex ? '1'.repeat(64) : candidate;
}

/** Same `forceNewConnection: true` reasoning as {@link probeOpen}: the app's own live connection
 * is open on this exact path with the exact same stored key, so a default open here would return
 * *that* handle — and this function's own `close()` would close the live app connection. */
function collectRowCounts(port: CipherDatabasePort, keyHex: string): Record<string, number> {
  const handle = port.openKeyed(ENCRYPTED_DATABASE_NAME, keyHex, { forceNewConnection: true });
  try {
    const counts: Record<string, number> = {};
    for (const table of CENSUS_TABLES) {
      try {
        const rows = handle.query<{ n: number }>(`SELECT count(*) AS n FROM ${quoteIdentifier(table)};`);
        counts[table] = rows[0]?.n ?? 0;
      } catch {
        // Defensive only — every table in CENSUS_TABLES exists on any store that reached a real
        // launch. Reported as 0 rather than throwing, so one unexpected table never blanks the
        // whole diagnostic.
        counts[table] = 0;
      }
    }
    return counts;
  } finally {
    handle.close();
  }
}

/**
 * `runEncryptionDiagnostics` — the device-tier probe's database half (implementation plan
 * Decision 12). Lives under `src/db/` because it must import through the cipher port
 * (`dbAccessBoundary`, V31); `src/dev/encryption-probe.ts` is the rendering half and imports no
 * SQL library at all.
 *
 * **Never prints the key.** Only a boolean `keyPresent` and a one-way `keyFingerprint` (the first
 * eight characters of `digestSha256(keyHex)`) ever leave this function — non-negotiable 1,
 * extended by this item to the database key.
 */
export async function runEncryptionDiagnostics(deps: RunEncryptionDiagnosticsDeps): Promise<EncryptionDiagnostics> {
  const cipherVersion = deps.port.cipherVersion();
  const storedKey = await deps.secureStore.getItem(DB_KEY_STORAGE_KEY);
  const keyPresent = storedKey !== null;
  const keyFingerprint = keyPresent ? (await deps.digestSha256(storedKey as string)).slice(0, 8) : undefined;

  const openWithoutKey = probeOpen(deps.port, null);
  const openWithWrongKey = probeOpen(deps.port, wrongKeyDistinctFrom(storedKey));
  const openWithStoredKey = keyPresent ? probeOpen(deps.port, storedKey as string) : 'failed';

  const tableRowCounts =
    keyPresent && openWithStoredKey === 'succeeded' ? collectRowCounts(deps.port, storedKey as string) : undefined;

  return {
    cipherVersion,
    keyPresent,
    keyFingerprint,
    resolvedState: deps.resolvedState,
    openWithoutKey,
    openWithWrongKey,
    openWithStoredKey,
    tableRowCounts,
  };
}
