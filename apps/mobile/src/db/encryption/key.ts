import type { SecureStorePort } from '../../lib/secure-store/types';
import { DB_KEY_STORAGE_KEY, ENCRYPTED_DATABASE_NAME } from './constants';
import { DatabaseKeyMissingError } from './errors';
import { isValidRawKeyHex } from './statements';
import type { CipherDatabasePort } from './types';

export interface EnsureDatabaseKeyDeps {
  secureStore: SecureStorePort;
  port: CipherDatabasePort;
  /** `Crypto.getRandomBytesAsync` on the device (V24); `node:crypto`'s equivalent in tests. */
  randomBytes: (byteCount: number) => Promise<Uint8Array>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Exported so `open-encrypted-store.ts` can reuse the exact same "does a plain open throw"
 * heuristic for its own `!keyPresent` probe branch, rather than duplicating this logic.
 *
 * "Does the encrypted store already have content?" without a key to open it with (Decision 7's
 * existence probe, applied to the one file it was **not** originally written for). Opening a
 * genuinely SQLCipher-encrypted file with no key and then querying it fails — SQLite cannot
 * decode its first page as a valid header — while opening a missing or already-plaintext file
 * succeeds cleanly. That failure/success split is the only signal available before a key is
 * known, and it is exactly what makes the `unrecoverable_key_missing` fail-closed branch below
 * possible without ever needing `expo-file-system` (Decision 7).
 *
 * The "succeeds cleanly" branch may have just created (or reused) a zero-table plaintext artefact
 * at `ENCRYPTED_DATABASE_NAME` — the same connection-caching hazard `fresh_install`'s legacy probe
 * has (V17: a second `openDatabaseSync` of the same path returns the same, now-unkeyed, cached
 * handle). It is deleted here, immediately, before this function returns, so a subsequent
 * `openKeyed` call for the same path always gets a genuinely fresh, never-before-written file —
 * required for `PRAGMA key` to be the connection's true first statement (V15).
 *
 * **Found in independent review**: a bare "did `userTableCount()` throw?" check treats a
 * clean-but-*non-zero* result identically to a genuinely empty artefact — "didn't throw" is not
 * the same claim as "no content". The count itself is checked (`> 0`), mirroring
 * `open-encrypted-store.ts`'s own legacy-store probe (`legacyProbe.userTableCount() > 0`), so a
 * future invariant break that leaves a plain-readable file with real rows at
 * `ENCRYPTED_DATABASE_NAME` is treated as content — never deleted, never silently paved over by a
 * newly generated key.
 */
export function encryptedStoreHasContent(port: CipherDatabasePort): boolean {
  const handle = port.openPlain(ENCRYPTED_DATABASE_NAME);
  let hasContent: boolean;
  try {
    hasContent = handle.userTableCount() > 0;
  } catch {
    hasContent = true;
  } finally {
    handle.close();
  }
  if (!hasContent) {
    port.deleteDatabaseIfPresent(ENCRYPTED_DATABASE_NAME);
  }
  return hasContent;
}

/**
 * `ensureDatabaseKey` — the one-way generation rule (implementation plan Decision 3, Decision 5).
 * A key already in secure storage is always reused as-is. A key is generated **only** when
 * `getItem(DB_KEY_STORAGE_KEY)` returns `null` **and** {@link encryptedStoreHasContent} confirms
 * there is nothing yet to destroy. Any other absent-key shape — the encrypted store already has
 * content — is `unrecoverable_key_missing`: this function never generates a replacement key and
 * never deletes the store; it throws {@link DatabaseKeyMissingError} and stops.
 *
 * No log line, no error message and no return-value wrapper in this module ever contains the key
 * itself (AGENTS.md non-negotiable 1, extended by this item to the database key) — every failure
 * path names a state, never a value.
 */
export async function ensureDatabaseKey(deps: EnsureDatabaseKeyDeps): Promise<string> {
  const existing = await deps.secureStore.getItem(DB_KEY_STORAGE_KEY);
  if (existing !== null) {
    if (!isValidRawKeyHex(existing)) {
      // Fail closed rather than silently generating a replacement over content this key may
      // still be the only way to read (Decision 3's one-way rule applies to a malformed stored
      // value exactly as it does to a missing one).
      throw new DatabaseKeyMissingError('The stored database key is not well-formed.');
    }
    return existing;
  }

  if (encryptedStoreHasContent(deps.port)) {
    throw new DatabaseKeyMissingError(
      'The database key is missing from secure storage, but the encrypted store already has content.',
    );
  }

  const bytes = await deps.randomBytes(32);
  const keyHex = bytesToHex(bytes);
  await deps.secureStore.setItem(DB_KEY_STORAGE_KEY, keyHex, {
    accessibility: 'after_first_unlock_this_device',
  });
  return keyHex;
}
