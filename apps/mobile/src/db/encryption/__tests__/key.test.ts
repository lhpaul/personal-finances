import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createMemorySecureStore } from '../../../lib/secure-store/testing/memory-secure-store';
import { createBetterSqliteCipherPort } from '../../testing/cipher-port';
import { DB_KEY_STORAGE_KEY, ENCRYPTED_DATABASE_NAME } from '../constants';
import { DatabaseKeyMissingError } from '../errors';
import { isValidRawKeyHex } from '../statements';
import { encryptedStoreHasContent, ensureDatabaseKey } from '../key';

function nodeRandomBytes(byteCount: number): Promise<Uint8Array> {
  return Promise.resolve(new Uint8Array(crypto.randomBytes(byteCount)));
}

function tempDirectory(): { directory: string; cleanup: () => void } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-key-test-'));
  return { directory, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

describe('ensureDatabaseKey — reuse (Decision 3)', () => {
  it('returns the exact stored key, unchanged, without writing a new one', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const storedKey = 'b'.repeat(64);
      const secureStore = createMemorySecureStore({ [DB_KEY_STORAGE_KEY]: storedKey });
      const port = createBetterSqliteCipherPort({ directory });

      const keyHex = await ensureDatabaseKey({ secureStore, port, randomBytes: nodeRandomBytes });

      expect(keyHex).toBe(storedKey);
      expect(secureStore.entries()[DB_KEY_STORAGE_KEY]).toBe(storedKey);
    } finally {
      cleanup();
    }
  });

  it('throws DatabaseKeyMissingError rather than silently regenerating over a malformed stored value', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const secureStore = createMemorySecureStore({ [DB_KEY_STORAGE_KEY]: 'not-well-formed-hex' });
      const port = createBetterSqliteCipherPort({ directory });

      await expect(ensureDatabaseKey({ secureStore, port, randomBytes: nodeRandomBytes })).rejects.toBeInstanceOf(
        DatabaseKeyMissingError,
      );
    } finally {
      cleanup();
    }
  });
});

describe('ensureDatabaseKey — generation when absent and no encrypted content (Decision 3)', () => {
  it('generates a 64-character lowercase-hex key and writes it after_first_unlock_this_device', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const secureStore = createMemorySecureStore();
      const port = createBetterSqliteCipherPort({ directory });

      const keyHex = await ensureDatabaseKey({ secureStore, port, randomBytes: nodeRandomBytes });

      expect(isValidRawKeyHex(keyHex)).toBe(true);
      expect(keyHex).toHaveLength(64);
      expect(secureStore.entries()[DB_KEY_STORAGE_KEY]).toBe(keyHex);
      expect(secureStore.accessibilityOf(DB_KEY_STORAGE_KEY)).toBe('after_first_unlock_this_device');
    } finally {
      cleanup();
    }
  });

  it('cleans up the zero-table probe artefact it creates at ENCRYPTED_DATABASE_NAME, so a later openKeyed gets a genuinely fresh file', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const secureStore = createMemorySecureStore();
      const port = createBetterSqliteCipherPort({ directory });

      await ensureDatabaseKey({ secureStore, port, randomBytes: nodeRandomBytes });

      expect(fs.existsSync(path.join(directory, ENCRYPTED_DATABASE_NAME))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('two independent calls (two profiles) never produce the same key', async () => {
    const dirA = tempDirectory();
    const dirB = tempDirectory();
    try {
      const keyA = await ensureDatabaseKey({
        secureStore: createMemorySecureStore(),
        port: createBetterSqliteCipherPort({ directory: dirA.directory }),
        randomBytes: nodeRandomBytes,
      });
      const keyB = await ensureDatabaseKey({
        secureStore: createMemorySecureStore(),
        port: createBetterSqliteCipherPort({ directory: dirB.directory }),
        randomBytes: nodeRandomBytes,
      });

      expect(keyA).not.toBe(keyB);
    } finally {
      dirA.cleanup();
      dirB.cleanup();
    }
  });
});

describe('ensureDatabaseKey — unrecoverable_key_missing (Decision 5, R2)', () => {
  it('throws DatabaseKeyMissingError when no key is present but the encrypted store already has content, and never writes a key or deletes the store', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      // Fabricates "the encrypted store already has content" the same way a real SQLCipher file
      // would present to a plain, unkeyed open: bytes that are not a valid plain-SQLite header,
      // so a query against it throws rather than reporting a clean zero-table result.
      const encryptedPath = path.join(directory, ENCRYPTED_DATABASE_NAME);
      fs.writeFileSync(encryptedPath, crypto.randomBytes(4096));
      const sizeBefore = fs.statSync(encryptedPath).size;

      const secureStore = createMemorySecureStore();
      const port = createBetterSqliteCipherPort({ directory });

      await expect(ensureDatabaseKey({ secureStore, port, randomBytes: nodeRandomBytes })).rejects.toBeInstanceOf(
        DatabaseKeyMissingError,
      );

      expect(secureStore.entries()[DB_KEY_STORAGE_KEY]).toBeUndefined();
      expect(fs.existsSync(encryptedPath)).toBe(true);
      expect(fs.statSync(encryptedPath).size).toBe(sizeBefore);
    } finally {
      cleanup();
    }
  });
});

describe('encryptedStoreHasContent — checks the actual table count, not just "did the open throw" (found in independent review)', () => {
  it('reports true, and never deletes, when a plain open succeeds cleanly but finds real tables and rows', () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      // Fabricates the anomalous shape a bare "did it throw?" check would misclassify: a file at
      // ENCRYPTED_DATABASE_NAME that opens as plain SQLite *without* throwing (so the pre-fix
      // check would have read this as "no content" and deleted it), but genuinely has a table and
      // a row in it.
      const seedHandle = port.openPlain(ENCRYPTED_DATABASE_NAME);
      seedHandle.exec('CREATE TABLE some_real_table (id TEXT PRIMARY KEY);');
      seedHandle.exec("INSERT INTO some_real_table (id) VALUES ('real-row');");
      seedHandle.close();
      const encryptedPath = path.join(directory, ENCRYPTED_DATABASE_NAME);
      const sizeBefore = fs.statSync(encryptedPath).size;

      const hasContent = encryptedStoreHasContent(port);

      expect(hasContent).toBe(true);
      // Never deleted: the file and its size are untouched.
      expect(fs.existsSync(encryptedPath)).toBe(true);
      expect(fs.statSync(encryptedPath).size).toBe(sizeBefore);
    } finally {
      cleanup();
    }
  });

  it('reports false, and deletes the zero-table artefact, when a plain open finds genuinely no tables', () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });

      const hasContent = encryptedStoreHasContent(port);

      expect(hasContent).toBe(false);
      expect(fs.existsSync(path.join(directory, ENCRYPTED_DATABASE_NAME))).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe('ensureDatabaseKey — the key is never named in a thrown error message (AGENTS.md non-negotiable 1)', () => {
  it('every DatabaseKeyMissingError message is free of any generated or stored key value', async () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const encryptedPath = path.join(directory, ENCRYPTED_DATABASE_NAME);
      const garbage = crypto.randomBytes(4096);
      fs.writeFileSync(encryptedPath, garbage);
      const garbageHex = garbage.toString('hex');

      const secureStore = createMemorySecureStore();
      const port = createBetterSqliteCipherPort({ directory });

      try {
        await ensureDatabaseKey({ secureStore, port, randomBytes: nodeRandomBytes });
        throw new Error('expected ensureDatabaseKey to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseKeyMissingError);
        const message = (error as Error).message;
        expect(message).not.toContain(garbageHex.slice(0, 32));
        expect(/[0-9a-f]{64}/.test(message)).toBe(false);
      }
    } finally {
      cleanup();
    }
  });
});
