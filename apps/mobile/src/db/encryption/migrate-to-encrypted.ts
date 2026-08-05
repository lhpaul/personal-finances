import { setSetting } from '../repositories/settings';
import { buildCensus } from './census';
import { ENCRYPTED_DATABASE_NAME, ENCRYPTION_MARKER_SETTING, EXPORT_ALIAS, LEGACY_DATABASE_NAME } from './constants';
import { DatabaseEncryptionMigrationError } from './errors';
import { findPreservationViolations } from '../checks/preservation';
import type { CipherDatabasePort, CipherHandle } from './types';

export interface MigratePlaintextToEncryptedDeps {
  port: CipherDatabasePort;
  keyHex: string;
  now: () => string;
}

/**
 * `migratePlaintextToEncrypted` — the orchestrator of Decision 6's numbered sequence, written
 * entirely against {@link CipherDatabasePort}. Every step's failure handling below is explicit
 * (the write-path error-handling standard applied to every step of this state machine, not just
 * the happy path):
 *
 * ```text
 * 1. legacy = port.openPlain(LEGACY_DATABASE_NAME)
 * 2. legacy.exec('PRAGMA wal_checkpoint(TRUNCATE);')      // no-op today (V19); cheap insurance
 * 3. legacy.attachEncrypted(EXPORT_ALIAS, ENCRYPTED_DATABASE_NAME, keyHex)
 * 4. legacy.exportMainTo(EXPORT_ALIAS)                     // SELECT sqlcipher_export('encrypted')
 * 5. legacy.copyUserVersionTo(EXPORT_ALIAS)
 * 6. before = buildCensus(legacy); after = buildCensus(legacy, EXPORT_ALIAS)
 *    findings = findPreservationViolations(before, after)
 *    findings.length > 0 -> abort: detach, close, delete the encrypted store, throw
 * 7. legacy.detach(EXPORT_ALIAS)
 * 8. legacy.close()
 * 9. encrypted = port.openKeyed(ENCRYPTED_DATABASE_NAME, keyHex)
 * 10. setSetting(encrypted.db, ENCRYPTION_MARKER_SETTING, now())    <-- COMMIT POINT
 * 11. port.deleteDatabaseIfPresent(LEGACY_DATABASE_NAME)            (non-fatal on failure — see
 *     below)
 * ```
 *
 * **Step 6 is the safety property.** It reuses `findPreservationViolations`
 * (`src/db/checks/preservation.ts`) over a census built from both schemas of the *same open
 * connection*, so the comparison reads real rows out of the real (encrypted, on the device)
 * pages, not out of a buffer. Any finding aborts the whole migration: the plaintext original is
 * never touched by this function, and the (unverified) encrypted copy is discarded.
 *
 * The encrypted handle **stays open and is returned to the caller** on success — `open-encrypted-
 * store.ts` hands it straight to `ensureDatabaseReady()`, which finds every migration and every
 * seed already present (copied verbatim by `sqlcipher_export`) and is a no-op.
 */
export async function migratePlaintextToEncrypted(
  deps: MigratePlaintextToEncryptedDeps,
): Promise<CipherHandle> {
  const legacy = deps.port.openPlain(LEGACY_DATABASE_NAME);
  let attached = false;

  try {
    legacy.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    legacy.attachEncrypted(EXPORT_ALIAS, ENCRYPTED_DATABASE_NAME, deps.keyHex);
    attached = true;
    legacy.exportMainTo(EXPORT_ALIAS);
    legacy.copyUserVersionTo(EXPORT_ALIAS);

    const before = buildCensus(legacy);
    const after = buildCensus(legacy, EXPORT_ALIAS);
    const findings = findPreservationViolations(before, after);
    if (findings.length > 0) {
      throw new DatabaseEncryptionMigrationError(
        `The plaintext-to-encrypted copy lost or changed ${findings.length} row(s)/column(s); the migration was aborted and the plaintext store is untouched.`,
        findings.map((finding) => `${finding.kind}:${finding.table}${finding.column ? `.${finding.column}` : ''}`),
      );
    }

    legacy.detach(EXPORT_ALIAS);
    attached = false;
    legacy.close();
  } catch (cause) {
    // Abort path (Decision 6): best-effort detach/close so `deleteDatabaseIfPresent` below is
    // never blocked by a still-open cached handle (V18) — a failure in either is swallowed
    // because the encrypted-store deletion that follows is what actually matters for
    // recoverability, and `legacy` (never written to by this function) is left exactly as it
    // was regardless of how this catch block itself fares.
    try {
      if (attached) legacy.detach(EXPORT_ALIAS);
    } catch {
      // best-effort; see comment above.
    }
    try {
      legacy.close();
    } catch {
      // best-effort; see comment above.
    }
    deps.port.deleteDatabaseIfPresent(ENCRYPTED_DATABASE_NAME);

    if (cause instanceof DatabaseEncryptionMigrationError) throw cause;
    throw new DatabaseEncryptionMigrationError(
      'The plaintext-to-encrypted copy failed before it could be verified; the migration was aborted and the plaintext store is untouched.',
      [],
      { cause },
    );
  }

  let encrypted: CipherHandle;
  try {
    encrypted = deps.port.openKeyed(ENCRYPTED_DATABASE_NAME, deps.keyHex);
  } catch (cause) {
    // The verified copy is on disk but could not be reopened with the very key that just wrote
    // it (an environment-level failure — disk full, permissions). No handle to close here; left
    // in place for the next launch's `resume_after_partial_copy` state to discard and retry
    // rather than guessing it is safe to delete with no open handle to prove that.
    throw new DatabaseEncryptionMigrationError(
      'Opening the freshly exported encrypted store failed; it will be discarded and retried on the next launch.',
      [],
      { cause },
    );
  }

  try {
    // COMMIT POINT (Decision 6, step 10).
    setSetting(encrypted.db, ENCRYPTION_MARKER_SETTING, deps.now());
  } catch (cause) {
    encrypted.close();
    deps.port.deleteDatabaseIfPresent(ENCRYPTED_DATABASE_NAME);
    throw new DatabaseEncryptionMigrationError(
      'Writing the migration commit marker failed; the encrypted store was discarded so the next launch retries the copy from scratch.',
      [],
      { cause },
    );
  }

  try {
    deps.port.deleteDatabaseIfPresent(LEGACY_DATABASE_NAME);
  } catch {
    // Non-fatal: the migration is already committed (the marker write above is the commit
    // point). A failure here leaves `finanzas.db` as an orphan the *next* launch's
    // `plaintext_orphan_after_success` state discovers and retries deleting — Decision 6's
    // crash-analysis table treats a failure exactly here identically to a process kill at the
    // same point (data loss: none). This call still succeeds and returns the valid, already-
    // committed encrypted handle below.
  }

  return encrypted;
}
