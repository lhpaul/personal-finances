import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createMemorySecureStore } from '../../../lib/secure-store/testing/memory-secure-store';
import { createBetterSqliteCipherPort } from '../../testing/cipher-port';
import { DB_KEY_STORAGE_KEY, ENCRYPTED_DATABASE_NAME } from '../constants';
import { runEncryptionDiagnostics } from '../diagnostics';
import { getLastResolvedEncryptionState, openEncryptedStore, resetEncryptionStateMemo } from '../open-encrypted-store';

function nodeRandomBytes(byteCount: number): Promise<Uint8Array> {
  return Promise.resolve(new Uint8Array(crypto.randomBytes(byteCount)));
}

function nodeDigestSha256(input: string): Promise<string> {
  return Promise.resolve(crypto.createHash('sha256').update(input, 'utf8').digest('hex'));
}

function tempDirectory(): { directory: string; cleanup: () => void } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-diag-test-'));
  return { directory, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

beforeEach(() => {
  resetEncryptionStateMemo();
});

describe('runEncryptionDiagnostics (Decision 12)', () => {
  it('after a fresh install: reports cipher_version, key present, a fingerprint, all three open outcomes, and per-table row counts', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      const secureStore = createMemorySecureStore();
      const opened = await openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: () => '2026-01-01T00:00:00.000Z' });
      opened.handle.exec("CREATE TABLE users (id TEXT PRIMARY KEY);");
      opened.handle.exec("INSERT INTO users (id) VALUES ('u1');");
      opened.handle.close();

      const diagnostics = await runEncryptionDiagnostics({
        port,
        secureStore,
        digestSha256: nodeDigestSha256,
        resolvedState: getLastResolvedEncryptionState(),
      });

      expect(diagnostics.cipherVersion).not.toBeNull();
      expect(diagnostics.keyPresent).toBe(true);
      expect(diagnostics.keyFingerprint).toHaveLength(8);
      expect(diagnostics.resolvedState).toBe('fresh_install');
      // The labelled test double ignores keys entirely (Decision 9) — it cannot itself
      // distinguish a keyed open from a plain one, so `openWithoutKey` reads the same real
      // content `openWithStoredKey` does here. The real "no key / wrong key is rejected"
      // assertion is device-only (runbook Step 5); see `probeOpen`'s own doc comment.
      expect(diagnostics.openWithoutKey).toBe('succeeded');
      expect(diagnostics.openWithStoredKey).toBe('succeeded');
      expect(diagnostics.tableRowCounts).toBeDefined();
      expect(diagnostics.tableRowCounts?.users).toBe(1);

      cleanup();
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  it('never includes the raw key anywhere in the returned object', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      const secureStore = createMemorySecureStore();
      const opened = await openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: () => '2026-01-01T00:00:00.000Z' });
      const storedKey = secureStore.entries()[DB_KEY_STORAGE_KEY] as string;
      opened.handle.close();

      const diagnostics = await runEncryptionDiagnostics({
        port,
        secureStore,
        digestSha256: nodeDigestSha256,
        resolvedState: undefined,
      });

      const serialized = JSON.stringify(diagnostics);
      expect(serialized).not.toContain(storedKey);

      cleanup();
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  it('reports keyPresent: false and no fingerprint when no key exists', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      const secureStore = createMemorySecureStore();

      const diagnostics = await runEncryptionDiagnostics({
        port,
        secureStore,
        digestSha256: nodeDigestSha256,
        resolvedState: undefined,
      });

      expect(diagnostics.keyPresent).toBe(false);
      expect(diagnostics.keyFingerprint).toBeUndefined();
      expect(diagnostics.openWithStoredKey).toBe('failed');
      expect(diagnostics.tableRowCounts).toBeUndefined();

      cleanup();
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  it('reports cipherVersion: null when the port has no SQLCipher capability', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory, cipherVersion: null });
      const secureStore = createMemorySecureStore();

      const diagnostics = await runEncryptionDiagnostics({
        port,
        secureStore,
        digestSha256: nodeDigestSha256,
        resolvedState: undefined,
      });

      expect(diagnostics.cipherVersion).toBeNull();

      cleanup();
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  it('reports openWithStoredKey: failed when the encrypted store has content under a different key (labelled-double limitation acknowledged, real assertion is device-only)', async () => {
    // This double ignores the key entirely (Decision 9), so it cannot itself prove a wrong key is
    // rejected — that assertion is device-only (runbook Step 5). This test instead proves the
    // plumbing: an ENCRYPTED_DATABASE_NAME that genuinely cannot be read as plain SQLite (the same
    // fabrication key.test.ts and open-encrypted-store.test.ts use for unrecoverable_key_missing)
    // makes every open outcome 'failed', including the "stored key" one when no key is stored.
    const { directory, cleanup } = tempDirectory();
    try {
      fs.writeFileSync(path.join(directory, ENCRYPTED_DATABASE_NAME), crypto.randomBytes(4096));
      const port = createBetterSqliteCipherPort({ directory });
      const secureStore = createMemorySecureStore();

      const diagnostics = await runEncryptionDiagnostics({
        port,
        secureStore,
        digestSha256: nodeDigestSha256,
        resolvedState: undefined,
      });

      expect(diagnostics.openWithoutKey).toBe('failed');
      expect(diagnostics.openWithWrongKey).toBe('failed');
      expect(diagnostics.openWithStoredKey).toBe('failed');

      cleanup();
    } catch (error) {
      cleanup();
      throw error;
    }
  });
});
