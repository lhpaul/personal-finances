import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { setSetting } from '../../repositories/settings';
import { createMemorySecureStore } from '../../../lib/secure-store/testing/memory-secure-store';
import { createBetterSqliteCipherPort } from '../../testing/cipher-port';
import { openFileBackedLegacyStore } from '../../testing/memory-db';
import { DB_KEY_STORAGE_KEY, ENCRYPTED_DATABASE_NAME, ENCRYPTION_MARKER_SETTING, LEGACY_DATABASE_NAME } from '../constants';
import { DatabaseKeyMissingError } from '../errors';
import { getLastResolvedEncryptionState, openEncryptedStore, resetEncryptionStateMemo } from '../open-encrypted-store';

const FIXTURE_PATH = path.resolve(__dirname, '../../__fixtures__/store-v1.sql');

function nodeRandomBytes(byteCount: number): Promise<Uint8Array> {
  return Promise.resolve(new Uint8Array(crypto.randomBytes(byteCount)));
}

function deterministicNow(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `2026-03-01T00:00:0${counter}.000Z`;
  };
}

beforeEach(() => {
  resetEncryptionStateMemo();
});

describe('openEncryptedStore — fresh_install', () => {
  it('resolves fresh_install, generates a key, and returns an open store with zero user tables', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-open-test-'));
    const port = createBetterSqliteCipherPort({ directory });
    const secureStore = createMemorySecureStore();

    const { handle, state } = await openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: deterministicNow() });

    expect(state).toBe('fresh_install');
    expect(handle.userTableCount()).toBe(0);
    expect(secureStore.entries()[DB_KEY_STORAGE_KEY]).toBeDefined();

    handle.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe('openEncryptedStore — migration_required, and a second call is a no-op (already_encrypted)', () => {
  it('migrates a real legacy store, then a second call resolves already_encrypted without re-running the migration', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: store.directory });
    const secureStore = createMemorySecureStore();

    const first = await openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: deterministicNow() });
    expect(first.state).toBe('migration_required');
    expect(first.handle.userTableCount()).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toBe(false);
    const rowCountAfterFirst = first.handle.userTableCount();
    first.handle.close();

    const second = await openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: deterministicNow() });
    expect(second.state).toBe('already_encrypted');
    expect(second.handle.userTableCount()).toBe(rowCountAfterFirst);

    second.handle.close();
    store.cleanup();
  });
});

describe('openEncryptedStore — plaintext_orphan_after_success', () => {
  it('deletes the orphaned legacy store and opens the already-committed encrypted store', async () => {
    // Builds the "crash between commit and cleanup" shape directly: an encrypted store with the
    // marker already written, plus a legacy store that a real crash would have left behind.
    const legacyStore = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: legacyStore.directory });
    const keyHex = 'd'.repeat(64);
    const encryptedHandle = port.openKeyed(ENCRYPTED_DATABASE_NAME, keyHex);
    encryptedHandle.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
    setSetting(encryptedHandle.db, ENCRYPTION_MARKER_SETTING, '2026-01-01T00:00:00.000Z');
    encryptedHandle.close();

    const secureStore = createMemorySecureStore({ [DB_KEY_STORAGE_KEY]: keyHex });

    const { handle, state } = await openEncryptedStore({
      port,
      secureStore,
      randomBytes: nodeRandomBytes,
      now: deterministicNow(),
    });

    expect(state).toBe('plaintext_orphan_after_success');
    expect(fs.existsSync(path.join(legacyStore.directory, LEGACY_DATABASE_NAME))).toBe(false);
    expect(handle.userTableCount()).toBeGreaterThan(0);

    handle.close();
    legacyStore.cleanup();
  });
});

describe('openEncryptedStore — resume_after_partial_copy', () => {
  it('discards a partial copy interrupted before app_settings itself existed, and re-runs the migration from the untouched plaintext original', async () => {
    const legacyStore = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: legacyStore.directory });
    const keyHex = 'e'.repeat(64);
    // A partial copy interrupted early — some other table exists, but `app_settings` (one
    // `CREATE TABLE` among many in Decision 6 step 4) does not yet. `getSetting`'s "no such
    // table" failure must resolve identically to "no marker", not crash the launch.
    const partialHandle = port.openKeyed(ENCRYPTED_DATABASE_NAME, keyHex);
    partialHandle.exec('CREATE TABLE some_partial_table (id TEXT PRIMARY KEY);');
    partialHandle.close();

    const secureStore = createMemorySecureStore({ [DB_KEY_STORAGE_KEY]: keyHex });

    const { handle, state } = await openEncryptedStore({
      port,
      secureStore,
      randomBytes: nodeRandomBytes,
      now: deterministicNow(),
    });

    expect(state).toBe('resume_after_partial_copy');
    // The plaintext original is deleted only as the last step of a *successful, verified*
    // migration (Decision 6 step 11) — its non-mutation along the way is covered directly by
    // `migrate-to-encrypted.test.ts`'s own abort-path assertions; here it is enough to confirm
    // deletion happened at all, proving the retry actually completed.
    expect(fs.existsSync(path.join(legacyStore.directory, LEGACY_DATABASE_NAME))).toBe(false);
    expect(handle.userTableCount()).toBeGreaterThan(0);
    const marker = handle.query<{ value: string }>(`SELECT value FROM app_settings WHERE key = '${ENCRYPTION_MARKER_SETTING}';`);
    expect(marker).toHaveLength(1);

    handle.close();
    legacyStore.cleanup();
  });

  it('discards a partial copy interrupted after app_settings existed but before the marker row was written', async () => {
    const legacyStore = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: legacyStore.directory });
    const keyHex = 'f'.repeat(64);
    // A partial copy interrupted later — `app_settings` exists (with an unrelated row) but the
    // migration's own marker was never written.
    const partialHandle = port.openKeyed(ENCRYPTED_DATABASE_NAME, keyHex);
    partialHandle.exec("CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    partialHandle.exec("INSERT INTO app_settings (key, value) VALUES ('some_other_setting', '\"x\"');");
    partialHandle.close();

    const secureStore = createMemorySecureStore({ [DB_KEY_STORAGE_KEY]: keyHex });

    const { handle, state } = await openEncryptedStore({
      port,
      secureStore,
      randomBytes: nodeRandomBytes,
      now: deterministicNow(),
    });

    expect(state).toBe('resume_after_partial_copy');
    const marker = handle.query<{ value: string }>(`SELECT value FROM app_settings WHERE key = '${ENCRYPTION_MARKER_SETTING}';`);
    expect(marker).toHaveLength(1);

    handle.close();
    legacyStore.cleanup();
  });
});

describe('openEncryptedStore — unrecoverable_key_missing (R2)', () => {
  it('throws DatabaseKeyMissingError and never deletes or opens the encrypted store', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-open-test-'));
    const encryptedPath = path.join(directory, ENCRYPTED_DATABASE_NAME);
    fs.writeFileSync(encryptedPath, crypto.randomBytes(4096));
    const sizeBefore = fs.statSync(encryptedPath).size;

    const port = createBetterSqliteCipherPort({ directory });
    const secureStore = createMemorySecureStore();

    await expect(
      openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: deterministicNow() }),
    ).rejects.toBeInstanceOf(DatabaseKeyMissingError);

    expect(secureStore.entries()[DB_KEY_STORAGE_KEY]).toBeUndefined();
    expect(fs.existsSync(encryptedPath)).toBe(true);
    expect(fs.statSync(encryptedPath).size).toBe(sizeBefore);

    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe('openEncryptedStore — resolved state memo (Decision 12)', () => {
  it('is undefined before the first call, and set only after a successful resolution', async () => {
    expect(getLastResolvedEncryptionState()).toBeUndefined();

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-open-test-'));
    const port = createBetterSqliteCipherPort({ directory });
    const secureStore = createMemorySecureStore();

    const { handle } = await openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: deterministicNow() });
    expect(getLastResolvedEncryptionState()).toBe('fresh_install');

    handle.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('is cleared by resetEncryptionStateMemo()', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-open-test-'));
    const port = createBetterSqliteCipherPort({ directory });
    const secureStore = createMemorySecureStore();

    const { handle } = await openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: deterministicNow() });
    handle.close();

    resetEncryptionStateMemo();

    expect(getLastResolvedEncryptionState()).toBeUndefined();

    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('is not set when the resolution throws', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-open-test-'));
    const encryptedPath = path.join(directory, ENCRYPTED_DATABASE_NAME);
    fs.writeFileSync(encryptedPath, crypto.randomBytes(4096));
    const port = createBetterSqliteCipherPort({ directory });
    const secureStore = createMemorySecureStore();

    await expect(
      openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: deterministicNow() }),
    ).rejects.toBeInstanceOf(DatabaseKeyMissingError);

    expect(getLastResolvedEncryptionState()).toBeUndefined();

    fs.rmSync(directory, { recursive: true, force: true });
  });
});
