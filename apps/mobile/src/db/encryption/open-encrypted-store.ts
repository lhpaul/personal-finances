import type { SecureStorePort } from '../../lib/secure-store/types';
import { getSetting } from '../repositories/settings';
import { DB_KEY_STORAGE_KEY, ENCRYPTED_DATABASE_NAME, ENCRYPTION_MARKER_SETTING, LEGACY_DATABASE_NAME } from './constants';
import { DatabaseEncryptionUnavailableError, DatabaseKeyMissingError } from './errors';
import { encryptedStoreHasContent, ensureDatabaseKey } from './key';
import { migratePlaintextToEncrypted } from './migrate-to-encrypted';
import { isValidRawKeyHex } from './statements';
import { resolveEncryptionState } from './state';
import type { CipherDatabasePort, CipherHandle, EncryptionProbe, EncryptionState } from './types';

export interface OpenEncryptedStoreDeps {
  port: CipherDatabasePort;
  secureStore: SecureStorePort;
  /** `Crypto.getRandomBytesAsync` on the device (V24); `node:crypto`'s equivalent in tests. */
  randomBytes: (byteCount: number) => Promise<Uint8Array>;
  now: () => string;
}

export interface OpenedEncryptedStore {
  handle: CipherHandle;
  state: EncryptionState;
}

/** The `EncryptionState` resolved and memoized at the most recent successful
 * {@link openEncryptedStore} call — set only on success, never on a throw, and only for
 * `src/dev/encryption-probe.ts`'s diagnostics to report without re-probing (Decision 12: a fresh
 * re-probe of the legacy path would recreate a file this item may have already deleted). Cleared
 * by `resetEncryptionStateMemo()`, which `src/db/runtime.ts`'s `resetAppDatabase()` calls
 * alongside its own memo clears. */
let lastResolvedState: EncryptionState | undefined;

export function getLastResolvedEncryptionState(): EncryptionState | undefined {
  return lastResolvedState;
}

export function resetEncryptionStateMemo(): void {
  lastResolvedState = undefined;
}

async function runMigration(deps: OpenEncryptedStoreDeps, existingKeyHex: string | undefined): Promise<CipherHandle> {
  const keyHex =
    existingKeyHex ?? (await ensureDatabaseKey({ secureStore: deps.secureStore, port: deps.port, randomBytes: deps.randomBytes }));
  return migratePlaintextToEncrypted({ port: deps.port, keyHex, now: deps.now });
}

/**
 * `openEncryptedStore` — the composition entry point (implementation plan Layer-by-Layer):
 * probe capability → resolve key → probe files → dispatch on `EncryptionState` → return an
 * opened, keyed `CipherHandle`. `src/db/runtime.ts`'s `getAppDatabase()` awaits this inside its
 * existing single-flight, before `ensureDatabaseReady` — which then runs unchanged against
 * whatever handle this function returns, for every state: a migrated store already carries its
 * own `__drizzle_migrations` and seed rows (copied verbatim by `sqlcipher_export`), so
 * `ensureDatabaseReady` converges to a no-op there exactly as it does on an untouched
 * `already_encrypted` store (AGENTS.md non-negotiable 4).
 */
export async function openEncryptedStore(deps: OpenEncryptedStoreDeps): Promise<OpenedEncryptedStore> {
  const version = deps.port.cipherVersion();
  if (version === null) {
    // Decision 8: a plain-SQLite build silently ignores every `PRAGMA key` this item would ever
    // issue. No plaintext fallback exists — the app does not open the store at all.
    throw new DatabaseEncryptionUnavailableError(
      'PRAGMA cipher_version reported no row: this binary was built without useSQLCipher. Rebuild the dev client (npx expo prebuild --clean) before relaunching.',
    );
  }

  const storedKey = await deps.secureStore.getItem(DB_KEY_STORAGE_KEY);
  const keyPresent = storedKey !== null;
  if (keyPresent && !isValidRawKeyHex(storedKey as string)) {
    throw new DatabaseKeyMissingError('The stored database key is not well-formed.');
  }

  const legacyProbe = deps.port.openPlain(LEGACY_DATABASE_NAME);
  let legacyHasUserTables: boolean;
  try {
    legacyHasUserTables = legacyProbe.userTableCount() > 0;
  } finally {
    legacyProbe.close();
  }
  if (!legacyHasUserTables) {
    // Decision 7: the probe above may have just created (or reused) a zero-table artefact —
    // clean it up so a legacy store never lingers once it is genuinely empty or absent.
    deps.port.deleteDatabaseIfPresent(LEGACY_DATABASE_NAME);
  }

  let encryptedHasUserTables: boolean;
  let encryptedHasMarker: boolean;
  if (keyPresent) {
    const encryptedProbe = deps.port.openKeyed(ENCRYPTED_DATABASE_NAME, storedKey as string);
    try {
      encryptedHasUserTables = encryptedProbe.userTableCount() > 0;
      if (!encryptedHasUserTables) {
        encryptedHasMarker = false;
      } else {
        try {
          encryptedHasMarker = getSetting(encryptedProbe.db, ENCRYPTION_MARKER_SETTING) !== undefined;
        } catch {
          // A partial `sqlcipher_export` copy can be interrupted before `app_settings` itself
          // exists yet (its `CREATE TABLE` is one statement among many in Decision 6 step 4) —
          // `getSetting` then fails with "no such table", not with a clean "no row". Treated
          // identically to "no marker": the store has *some* tables but is unmarked, which is
          // exactly `resume_after_partial_copy`'s own shape.
          encryptedHasMarker = false;
        }
      }
    } finally {
      encryptedProbe.close();
    }
  } else {
    // No key yet — the only signal available is whether a plain, unkeyed open can read the file
    // at all (`key.ts`'s `encryptedStoreHasContent`). The marker itself is unobservable without a
    // key, but that never matters here: whenever this heuristic reports `true`,
    // `resolveEncryptionState` resolves `unrecoverable_key_missing` regardless of the marker
    // value (`state.ts`'s own precedence), and whenever it reports `false` the marker cannot be
    // present either (the same module's "impossible probe" guard).
    encryptedHasUserTables = encryptedStoreHasContent(deps.port);
    encryptedHasMarker = false;
  }

  const probe: EncryptionProbe = { encryptedHasUserTables, encryptedHasMarker, legacyHasUserTables, keyPresent };
  const state = resolveEncryptionState(probe);

  let handle: CipherHandle;
  switch (state) {
    case 'unrecoverable_key_missing':
      // R2: never generate a replacement key, never delete the store. Stop.
      throw new DatabaseKeyMissingError(
        'The database key is missing from secure storage, but the encrypted store already has content.',
      );

    case 'fresh_install': {
      const keyHex = await ensureDatabaseKey({
        secureStore: deps.secureStore,
        port: deps.port,
        randomBytes: deps.randomBytes,
      });
      handle = deps.port.openKeyed(ENCRYPTED_DATABASE_NAME, keyHex);
      break;
    }

    case 'already_encrypted': {
      handle = deps.port.openKeyed(ENCRYPTED_DATABASE_NAME, storedKey as string);
      break;
    }

    case 'plaintext_orphan_after_success': {
      // Recovers a crash between the migration's commit marker and its plaintext-deletion step.
      deps.port.deleteDatabaseIfPresent(LEGACY_DATABASE_NAME);
      handle = deps.port.openKeyed(ENCRYPTED_DATABASE_NAME, storedKey as string);
      break;
    }

    case 'resume_after_partial_copy': {
      // The partial copy is worthless; the plaintext original is untouched. Discard, then
      // re-enter `migration_required`'s own action.
      deps.port.deleteDatabaseIfPresent(ENCRYPTED_DATABASE_NAME);
      handle = await runMigration(deps, keyPresent ? (storedKey as string) : undefined);
      break;
    }

    case 'migration_required': {
      handle = await runMigration(deps, keyPresent ? (storedKey as string) : undefined);
      break;
    }
  }

  lastResolvedState = state;
  return { handle, state };
}
