/**
 * Typed errors for the encryption-at-rest feature, mirroring `DatabaseMigrationError`'s shape in
 * `../migrate.ts` (implementation plan Layer-by-Layer). No message here ever interpolates key
 * material or a row value (Decision 3, AGENTS.md non-negotiable 1) — every message names a state,
 * never a value.
 */

/**
 * Thrown by `open-encrypted-store.ts` when `PRAGMA cipher_version` returns no row (Decision 8) —
 * the binary was built without `useSQLCipher`. The app does not fall back to plaintext; it does
 * not open the store at all.
 */
export class DatabaseEncryptionUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DatabaseEncryptionUnavailableError';
  }
}

/**
 * Thrown when the encrypted store already has content but no key is present in
 * `expo-secure-store` (Decision 5's `unrecoverable_key_missing` state, Decision 3's one-way
 * generation rule). Unrecoverable by design: the code never generates a replacement key and never
 * deletes the store.
 */
export class DatabaseKeyMissingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DatabaseKeyMissingError';
  }
}

/**
 * Thrown when `migrate-to-encrypted.ts`'s census gate (Decision 6, step 6) finds a preservation
 * violation. `findingKinds` carries only `PreservationFinding.kind` values (e.g.
 * `'row_lost'`) plus table and column names — never a row value.
 */
export class DatabaseEncryptionMigrationError extends Error {
  readonly findingKinds: readonly string[];

  constructor(message: string, findingKinds: readonly string[], options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DatabaseEncryptionMigrationError';
    this.findingKinds = findingKinds;
  }
}
