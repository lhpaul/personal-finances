import type { EncryptionProbe, EncryptionState } from './types';

/**
 * `resolveEncryptionState` — pure; no SQLite, no I/O (implementation plan Decision 5). Dispatches
 * an {@link EncryptionProbe} to exactly one of the six states, in the priority order the probe-
 * shape table implies:
 *
 * 1. `unrecoverable_key_missing` takes priority over every other reading whenever the key is
 *    absent **and** the encrypted store already has content — a partial copy with no key
 *    (`resume_after_partial_copy`'s own shape) must never be reached by this branch, because that
 *    would let a later step delete content protected by a key nobody can locate.
 * 2. Otherwise, the encrypted store's own shape (has tables? has the commit marker?) decides
 *    between the two "already migrated" states and `resume_after_partial_copy`.
 * 3. Only when the encrypted store has no tables at all does the legacy store's shape decide
 *    between `migration_required` and `fresh_install`.
 *
 * `open-encrypted-store.ts` builds the probe from one secure-store read and two on-disk probes;
 * this module asserts nothing about how that probe was produced, except for two internal-
 * consistency invariants a correctly-built probe can never violate — checked up front so a
 * caller bug is a loud throw, not a guessed state:
 *
 * - `encryptedHasMarker` implies `encryptedHasUserTables` — the marker is a *row* inside the
 *   encrypted store's `app_settings` table (Decision 5), so it cannot be present while the probe
 *   also reports zero user tables.
 * - `encryptedHasMarker` implies `keyPresent` — the marker can only be **observed** by a keyed
 *   read (Decision 12), so a probe that reports it present without also reporting a key indicates
 *   the probe itself was built incorrectly, not a real on-disk state.
 */
export function resolveEncryptionState(probe: EncryptionProbe): EncryptionState {
  if (probe.encryptedHasMarker && !probe.encryptedHasUserTables) {
    throw new Error(
      'Impossible probe: the encryption marker cannot be present with zero encrypted-store user tables.',
    );
  }
  if (probe.encryptedHasMarker && !probe.keyPresent) {
    throw new Error(
      'Impossible probe: the encryption marker cannot have been observed without a key present.',
    );
  }

  if (!probe.keyPresent && probe.encryptedHasUserTables) {
    return 'unrecoverable_key_missing';
  }

  if (probe.encryptedHasUserTables) {
    if (!probe.encryptedHasMarker) {
      return 'resume_after_partial_copy';
    }
    return probe.legacyHasUserTables ? 'plaintext_orphan_after_success' : 'already_encrypted';
  }

  return probe.legacyHasUserTables ? 'migration_required' : 'fresh_install';
}
