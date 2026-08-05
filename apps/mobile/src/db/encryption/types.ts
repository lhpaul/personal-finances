import type { AppDatabase } from '../types';

/**
 * The encryption seam is adapter-level (implementation plan Decision 9): `better-sqlite3` bundles
 * plain SQLite and cannot execute `PRAGMA key` for effect, so every module in this folder is
 * written against this port instead of importing `expo-sqlite` or `better-sqlite3` directly.
 * `src/db/client.ts` builds the real port over `expo-sqlite`; `src/db/testing/cipher-port.ts`
 * builds a labelled test double over `better-sqlite3`.
 */
export interface CipherHandle {
  /** The Drizzle wrapper over this same connection — used only by `setSetting`/`getSetting`
   * (`src/db/repositories/settings.ts`) to write and read the commit marker. Every other read in
   * this folder goes through {@link CipherHandle.query} instead, because the marker's table
   * (`app_settings`) is the only one a Drizzle-typed query needs to touch; the migration and
   * census code must read tables Drizzle has no schema for once they live behind the `encrypted`
   * `ATTACH` alias. */
  db: AppDatabase;
  /** Executes a statement that produces no rows — DDL, `PRAGMA`, `ATTACH`, `DETACH`, or a bare
   * `SELECT` run only for its side effect (`sqlcipher_export(...)`). */
  exec(sql: string): void;
  /** Runs a read-only `SELECT` and returns every row. `sql` is always built by
   * `statements.ts` from this module's own fixed constants and mechanically-retrieved
   * identifiers (a `DUMP_TABLE_ORDER` table name, a `PRAGMA table_info` column name) — never from
   * user input. */
  query<T = Record<string, unknown>>(sql: string): T[];
  /** `SELECT count(*) FROM [<schema>.]sqlite_schema WHERE type = 'table' AND name NOT LIKE
   * 'sqlite_%'` (Decision 7's existence probe, extended to accept a second-schema alias). */
  userTableCount(schema?: string): number;
  /** `ATTACH DATABASE '<resolved path>' AS <alias> KEY "x'<keyHex>'"` (Decision 1). The device
   * adapter resolves `databaseName` against `expo-sqlite`'s own database directory before
   * building the statement; the Node test double resolves it against its own temp directory. */
  attachEncrypted(alias: string, databaseName: string, keyHex: string): void;
  /** `SELECT sqlcipher_export('<alias>')` on the device (V11, V12); a plain-SQLite schema-and-rows
   * copy that mirrors the same statement set on the Node test double (Decision 9 — a labelled
   * double, not a proof that the device statement works). */
  exportMainTo(alias: string): void;
  /** Copies `PRAGMA user_version` from `main` to `<alias>` (Decision 1) — `sqlcipher_export`
   * itself does not carry it (V12). */
  copyUserVersionTo(alias: string): void;
  /** `DETACH DATABASE <alias>`. */
  detach(alias: string): void;
  /** Closes the underlying connection. Every code path in this folder calls this from a
   * `finally` (concurrent-event-source addendum): `deleteDatabase` throws while a cached handle
   * for that path is still open (V18), so a leaked handle turns a recoverable retry into a
   * permanent failure. */
  close(): void;
}

/**
 * The two implementations (Decision 9): the device adapter over `expo-sqlite`
 * (`src/db/client.ts`) and the Node test double over `better-sqlite3`
 * (`src/db/testing/cipher-port.ts`).
 */
export interface CipherDatabasePort {
  /** `PRAGMA cipher_version` (Decision 8, V14). Returns the version string on a SQLCipher build,
   * `null` on a plain SQLite build (which returns no row and no error — SQLite silently ignores
   * unknown pragmas). Runs on a throwaway `:memory:`-shaped connection; never opens the real
   * store. */
  cipherVersion(): string | null;
  /** Opens `databaseName` with no key issued. Used only for the legacy plaintext store (which
   * needs no key) and, internally to `key.ts`, as the "does the encrypted store already have
   * content" probe (Decision 3, Decision 7). */
  openPlain(databaseName: string, options?: CipherOpenOptions): CipherHandle;
  /** Opens `databaseName` and issues `PRAGMA key = "x'<keyHex>'"` as the connection's first
   * statement (V15), before `PRAGMA foreign_keys = ON`. */
  openKeyed(databaseName: string, keyHex: string, options?: CipherOpenOptions): CipherHandle;
  /** Deletes `databaseName` if it exists; a missing file is treated as success (Decision 7, V18).
   * Rethrows any other failure — most notably "currently open", which is a code defect (every
   * handle in this folder is closed before deletion is ever attempted). */
  deleteDatabaseIfPresent(databaseName: string): void;
}

/**
 * **Found in independent review**: `openDatabaseSync(name)` with no options caches connections by
 * `path + options` (V17) — a second open of the *same, still-open* path returns the identical
 * live handle, not a fresh one. That is correct and desired for every caller in this folder
 * except one: `src/db/encryption/diagnostics.ts`'s device probe, which must open
 * `ENCRYPTED_DATABASE_NAME` with **no key** and with a **wrong key** while the app's own live
 * keyed connection to that exact path is still open (Decision 12's whole premise — the probe
 * runs from the dev gallery *after* a successful launch). Without forcing a new connection, the
 * "no key" and "wrong key" opens would silently reuse the live, already-unlocked handle —
 * reporting `'succeeded'` regardless of the key supplied — and the probe's own `close()` would
 * then close the app's real, in-use connection out from under it.
 */
export interface CipherOpenOptions {
  /** `true` forces a genuinely new native connection (`useNewConnection: true`, V16) even if a
   * cached one already exists for this path. `false`/omitted (every caller except the
   * diagnostics probe) keeps the default caching behaviour, which every other code path in this
   * folder already satisfies correctly by always closing its own handle before a same-path
   * reopen. */
  forceNewConnection?: boolean;
}

/**
 * The six-value union `resolveEncryptionState` (`state.ts`) resolves to (Decision 5). Every
 * state is derived from what is on disk plus one secure-store read — there is no marker file, no
 * extra bookkeeping table, and no state that only exists in memory, so a process killed at any
 * instant resumes correctly on the next launch.
 */
export type EncryptionState =
  | 'fresh_install'
  | 'already_encrypted'
  | 'plaintext_orphan_after_success'
  | 'migration_required'
  | 'resume_after_partial_copy'
  | 'unrecoverable_key_missing';

/**
 * The pure input `resolveEncryptionState` dispatches on (Decision 5's probe-shape table). Built
 * by `open-encrypted-store.ts` from a `keyPresent` secure-store read, a legacy-store probe (via
 * `openPlain`), and an encrypted-store probe (via `openKeyed` when a key is available, or the
 * "does a plain open throw" heuristic in `key.ts` when it is not — see that module's doc comment
 * for why `unrecoverable_key_missing` must never fall through to key generation).
 */
export interface EncryptionProbe {
  encryptedHasUserTables: boolean;
  encryptedHasMarker: boolean;
  legacyHasUserTables: boolean;
  keyPresent: boolean;
}

/** The four active device-tier probes (Decision 12), serialised for `src/dev/encryption-probe.ts`
 * to render — no database import, no key material, ever. */
export interface EncryptionDiagnostics {
  cipherVersion: string | null;
  keyPresent: boolean;
  /** The first eight characters of `digestSha256(keyHex)` — one-way, carries no usable key
   * material. `undefined` when no key is present. */
  keyFingerprint: string | undefined;
  /** The `EncryptionState` resolved and memoized at launch (`open-encrypted-store.ts`) — not a
   * fresh re-probe (Decision 12: re-probing would recreate a deleted legacy file). */
  resolvedState: EncryptionState | undefined;
  openWithoutKey: 'succeeded' | 'failed';
  openWithWrongKey: 'succeeded' | 'failed';
  openWithStoredKey: 'succeeded' | 'failed';
  /** Populated only when {@link openWithStoredKey} is `'succeeded'`. */
  tableRowCounts: Record<string, number> | undefined;
}
