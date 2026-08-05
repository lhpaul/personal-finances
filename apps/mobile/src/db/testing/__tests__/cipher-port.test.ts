import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createBetterSqliteCipherPort } from '../cipher-port';

const DB_NAME = 'probe.db';

function tempDirectory(): { directory: string; cleanup: () => void } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-cipher-port-test-'));
  return { directory, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

/**
 * Divergence #3 (`cipher-port.ts`'s own doc comment, found in independent review): the double has
 * no real connection-cache identity to share, so it reproduces V18's "currently open" delete
 * guard via a per-resolved-path open ref-count instead. These tests hold that guard to the same
 * shape as `client.ts`'s real `deleteDatabaseIfPresent` (Decision 7, V18): not-found is success,
 * currently-open rethrows, and a discipline lapse (deleting before closing) fails loudly in Node
 * rather than only surfacing on a device.
 */
describe('createBetterSqliteCipherPort — deleteDatabaseIfPresent guard (V18)', () => {
  it('is a no-op when the file does not exist', () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).not.toThrow();
    } finally {
      cleanup();
    }
  });

  it('deletes cleanly once the handle that opened it has been closed', () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      const handle = port.openPlain(DB_NAME);
      handle.close();

      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).not.toThrow();
      expect(fs.existsSync(path.join(directory, DB_NAME))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('throws while a handle for that path is still open — the real V18 shape, not a silent unlink', () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      const handle = port.openPlain(DB_NAME);

      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).toThrow(/currently open/i);
      // Never actually deleted — the guard fired before any filesystem mutation.
      expect(fs.existsSync(path.join(directory, DB_NAME))).toBe(true);

      handle.close();
    } finally {
      cleanup();
    }
  });

  it('a keyed handle guards the same path a plain handle would (openPlain/openKeyed share one ref-count per path)', () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      const keyHex = 'a'.repeat(64);
      const handle = port.openKeyed(DB_NAME, keyHex);

      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).toThrow(/currently open/i);

      handle.close();
      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).not.toThrow();
    } finally {
      cleanup();
    }
  });

  it('ref-counts correctly across two opens of the same path — only clear to delete once both are closed', () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      const first = port.openPlain(DB_NAME);
      const second = port.openPlain(DB_NAME);

      first.close();
      // The second handle is still open — the guard must still fire.
      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).toThrow(/currently open/i);

      second.close();
      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).not.toThrow();
    } finally {
      cleanup();
    }
  });

  it('calling close() twice on the same handle does not double-decrement the ref-count', () => {
    const { directory, cleanup } = tempDirectory();
    try {
      const port = createBetterSqliteCipherPort({ directory });
      const first = port.openPlain(DB_NAME);
      const second = port.openPlain(DB_NAME);

      first.close();
      first.close(); // idempotent — must not underflow the ref-count for this path

      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).toThrow(/currently open/i);

      second.close();
      expect(() => port.deleteDatabaseIfPresent(DB_NAME)).not.toThrow();
    } finally {
      cleanup();
    }
  });
});
