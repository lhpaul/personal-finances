import { resolveEncryptionState } from '../state';
import type { EncryptionProbe } from '../types';

/** Every field explicit on every probe (implementation plan Decision 5's Testing Strategy row) —
 * no default relied on, so a reader never has to cross-reference this file against `types.ts` to
 * know what a given test actually asserts. */
function probe(overrides: EncryptionProbe): EncryptionProbe {
  return overrides;
}

describe('resolveEncryptionState — the six states (Decision 5)', () => {
  it('fresh_install: encrypted has no user tables; legacy has no user tables', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: false, encryptedHasMarker: false, legacyHasUserTables: false, keyPresent: true }),
      ),
    ).toBe('fresh_install');
  });

  it('fresh_install: also reachable with no key present yet (the key is generated in this branch)', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: false, encryptedHasMarker: false, legacyHasUserTables: false, keyPresent: false }),
      ),
    ).toBe('fresh_install');
  });

  it('already_encrypted: encrypted has user tables and the marker; no legacy store', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: true, encryptedHasMarker: true, legacyHasUserTables: false, keyPresent: true }),
      ),
    ).toBe('already_encrypted');
  });

  it('plaintext_orphan_after_success: encrypted has user tables and the marker; legacy store still present', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: true, encryptedHasMarker: true, legacyHasUserTables: true, keyPresent: true }),
      ),
    ).toBe('plaintext_orphan_after_success');
  });

  it('migration_required: encrypted has no user tables; legacy has user tables', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: false, encryptedHasMarker: false, legacyHasUserTables: true, keyPresent: true }),
      ),
    ).toBe('migration_required');
  });

  it('resume_after_partial_copy: encrypted has user tables but no marker', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: true, encryptedHasMarker: false, legacyHasUserTables: false, keyPresent: true }),
      ),
    ).toBe('resume_after_partial_copy');
  });

  it('resume_after_partial_copy: legacy presence does not change the outcome', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: true, encryptedHasMarker: false, legacyHasUserTables: true, keyPresent: true }),
      ),
    ).toBe('resume_after_partial_copy');
  });

  it('unrecoverable_key_missing: no key, but the encrypted store has content (no marker)', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: true, encryptedHasMarker: false, legacyHasUserTables: false, keyPresent: false }),
      ),
    ).toBe('unrecoverable_key_missing');
  });

  it('unrecoverable_key_missing takes priority over legacy presence too', () => {
    expect(
      resolveEncryptionState(
        probe({ encryptedHasUserTables: true, encryptedHasMarker: false, legacyHasUserTables: true, keyPresent: false }),
      ),
    ).toBe('unrecoverable_key_missing');
  });
});

describe('resolveEncryptionState — impossible probe shapes throw rather than guess', () => {
  it('the marker cannot be present with zero encrypted-store user tables', () => {
    expect(() =>
      resolveEncryptionState(
        probe({ encryptedHasUserTables: false, encryptedHasMarker: true, legacyHasUserTables: false, keyPresent: true }),
      ),
    ).toThrow(/Impossible probe/);
  });

  it('the marker cannot have been observed without a key present', () => {
    expect(() =>
      resolveEncryptionState(
        probe({ encryptedHasUserTables: true, encryptedHasMarker: true, legacyHasUserTables: false, keyPresent: false }),
      ),
    ).toThrow(/Impossible probe/);
  });
});
