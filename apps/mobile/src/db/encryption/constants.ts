/**
 * Named constants for the encryption-at-rest feature (implementation plan Decision 5, Decision 3).
 * Kept in their own file because both `client.ts` (the device adapter), the migration
 * orchestrator, the wipe (`src/features/settings/wipe-local-data.ts`) and the widened
 * `secure-store-key-namespace.test.ts` scanner need the exact same values — a copy-pasted string
 * anywhere in that set would silently split the single source of truth this item depends on.
 */

/** The plaintext store #3 created. Read-only from this item's point of view, until it is
 * deleted — never opened for a write. */
export const LEGACY_DATABASE_NAME = 'finanzas.db';

/** The encrypted store. Canonical from this item forward — every `getAppDatabase()` call
 * resolves to this file, never `LEGACY_DATABASE_NAME`. */
export const ENCRYPTED_DATABASE_NAME = 'finanzas.enc.db';

/** An `app_settings` row written **inside the encrypted store** by the migration's last step.
 * Its presence is the commit point (Decision 5) — nothing in this item ever reads it to decide
 * anything at runtime; the settings key namespace already has a `getSetting`/`setSetting` pair. */
export const ENCRYPTION_MARKER_SETTING = 'encryption_migrated_at';

/** The `ATTACH` alias used during the plaintext → encrypted copy (Decision 1, Decision 6). A
 * module constant, never user input. */
export const EXPORT_ALIAS = 'encrypted';

/**
 * The `expo-secure-store` key holding the 32-byte raw database key, hex-encoded (Decision 3).
 * The one and only entry in this second key namespace — `collectSecureStoreKeys`
 * (`src/features/settings/wipe-local-data.ts`) and the widened
 * `src/__tests__/secure-store-key-namespace.test.ts` both hold that claim mechanically.
 *
 * **Deviation from the plan's illustrative value, found on a real device (Step 0/device-tier
 * re-verification)**: the plan's Decision 3 wrote this as `'db_key:main'`. The installed
 * `expo-secure-store@15.0.8`'s own key validator — `build/SecureStore.js`'s `isValidKey`,
 * `/^[\w.-]+$/.test(key)` — rejects a colon and throws `Invalid key provided to SecureStore.
 * Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".` A real
 * device run of `openEncryptedStore()` (this session's device-tier verification) hit this thrown
 * error at `expoSecureStoreAdapter.getItem(DB_KEY_STORAGE_KEY)` on first launch — confirmed by
 * reading the exact regex above, not inferred from the stack trace alone. `.` is in the allowed
 * set, so `db_key.main` is used instead; no other part of Decision 3 depends on the literal
 * colon. **This same defect affects `credentialsKeyFor`'s `bank_creds:<institutionId>` format
 * (`src/lib/secure-store/credential-store.ts`, issue #9) — out of this item's scope to fix, and
 * reported separately as its own finding.**
 */
export const DB_KEY_STORAGE_KEY = 'db_key.main';
