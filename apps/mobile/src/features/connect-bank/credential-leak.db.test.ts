import { openBootstrappedMemoryDb } from '../../db/testing/memory-db';
import type { SecureStorePort } from '../../lib/secure-store/types';
import { connectBank, ConnectBankError } from './connect-bank.service';

/**
 * Implementation plan Testing Strategy scenarios 1-2 (AC1, AC2, AC3, AC5) — THE mandatory
 * negative suite. Sentinel credentials are driven through the real orchestration against a real
 * in-memory SQLite store, then:
 *
 * - the **whole** database is dumped to SQL text and scanned for either sentinel;
 * - every `console.*` call made during the run is captured and scanned;
 * - the failed-write variant repeats both scans, plus scans the thrown error's own serialized
 *   form.
 *
 * The **planted-defect proof** required in the PR body is recorded by temporarily adding
 * `console.warn('connect', input.rut)` to `connect-bank.service.ts`, re-running this file, and
 * confirming scenario 1 fails on the sentinel — see the PR description for the recorded output.
 */

const SENTINEL_RUT = 'ZZSENTINELRUTZZ';
const SENTINEL_PASSWORD = 'ZZSENTINELPASSZZ';
// A punctuation variant containing quotes, a backslash and a Unicode line separator (U+2028) —
// the kind of value that could slip past a naive string-equality log scrubber.
const SENTINEL_PUNCTUATION_PASSWORD = 'ZZ"SENTINEL\\PASS ZZ';

function createFakePort(): { port: SecureStorePort; store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    port: {
      getItem: (key) => Promise.resolve(store.has(key) ? (store.get(key) as string) : null),
      setItem: (key, value) => {
        store.set(key, value);
        return Promise.resolve();
      },
      deleteItem: (key) => {
        store.delete(key);
        return Promise.resolve();
      },
    },
  };
}

function dumpDatabaseToSql(sqlite: { prepare: (sql: string) => { all: () => unknown[] } }): string {
  // better-sqlite3 has no built-in `.dump`; this reproduces it well enough for a leak scan by
  // reading every row of every user table as JSON, which flattens every column value into text.
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  const chunks: string[] = [];
  for (const { name } of tables) {
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all();
    chunks.push(`-- ${name}\n${JSON.stringify(rows)}`);
  }
  return chunks.join('\n');
}

function spyOnConsole(): { calls: string[]; restore: () => void } {
  const calls: string[] = [];
  const methods: (keyof Console)[] = ['log', 'warn', 'error', 'info', 'debug'];
  // eslint-disable-next-line no-console -- capturing the originals to restore, not logging
  const originals = methods.map((method) => [method, console[method]] as const);
  for (const method of methods) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic console spy
    (console as any)[method] = (...args: unknown[]) => {
      calls.push(args.map((arg) => String(arg)).join(' '));
    };
  }
  return {
    calls,
    restore: () => {
      for (const [method, original] of originals) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic console spy
        (console as any)[method] = original;
      }
    },
  };
}

describe('connectBank credential leak scan (AC1, AC2, AC3)', () => {
  it('writes nothing recoverable from the database and logs nothing on a successful connect', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const { port } = createFakePort();
    const consoleSpy = spyOnConsole();
    try {
      const result = await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: SENTINEL_RUT, password: SENTINEL_PASSWORD },
      );

      const dump = dumpDatabaseToSql(sqlite);

      // The dump must be non-empty and contain real content — a scan of an empty string would
      // vacuously pass (implementation plan's "must not over-fire" requirement).
      expect(dump.length).toBeGreaterThan(0);
      expect(dump).toContain('banco-de-chile');
      expect(dump).toContain(result.userFinancialInstitutionId);

      expect(dump).not.toContain(SENTINEL_RUT);
      expect(dump).not.toContain(SENTINEL_PASSWORD);

      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_RUT);
      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_PASSWORD);
    } finally {
      consoleSpy.restore();
      sqlite.close();
    }
  });

  it('never logs a punctuation-heavy sentinel either (quotes, backslash, U+2028)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const { port } = createFakePort();
    const consoleSpy = spyOnConsole();
    try {
      await connectBank(
        { db, secureStore: port, newId: ports.newId, now: ports.now },
        { institutionId: 'banco-de-chile', rut: SENTINEL_RUT, password: SENTINEL_PUNCTUATION_PASSWORD },
      );

      const dump = dumpDatabaseToSql(sqlite);
      expect(dump).not.toContain(SENTINEL_PUNCTUATION_PASSWORD);
      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_PUNCTUATION_PASSWORD);
    } finally {
      consoleSpy.restore();
      sqlite.close();
    }
  });

  it('the failed-write variant: compensates, leaks nothing, and the thrown error is value-free (AC3, AC5)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const { port, store } = createFakePort();
    const consoleSpy = spyOnConsole();
    try {
      let thrown: unknown;
      try {
        // A non-existent institution id violates the `financial_institution_id` foreign key,
        // forcing the write inside connectBank's transaction to throw — a real DB write
        // failure, not a mock.
        await connectBank(
          { db, secureStore: port, newId: ports.newId, now: ports.now },
          { institutionId: 'not-a-real-bank', rut: SENTINEL_RUT, password: SENTINEL_PASSWORD },
        );
      } catch (error: unknown) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConnectBankError);
      expect((thrown as ConnectBankError).reason).toBe('connection_write_failed');
      const serialized = String(thrown) + JSON.stringify(thrown, Object.getOwnPropertyNames(thrown as object));
      expect(serialized).not.toContain(SENTINEL_RUT);
      expect(serialized).not.toContain(SENTINEL_PASSWORD);

      // The compensating delete ran: no orphaned secure-store entry for a connection attempt
      // that never existed before this call.
      expect(store.size).toBe(0);

      const dump = dumpDatabaseToSql(sqlite);
      expect(dump).not.toContain(SENTINEL_RUT);
      expect(dump).not.toContain(SENTINEL_PASSWORD);
      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_RUT);
      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_PASSWORD);
    } finally {
      consoleSpy.restore();
      sqlite.close();
    }
  });

  it('does not over-fire: the dump scan sees real, non-empty content for an unrelated scan', async () => {
    const { sqlite } = await openBootstrappedMemoryDb();
    try {
      const dump = dumpDatabaseToSql(sqlite);
      expect(dump.length).toBeGreaterThan(0);
      expect(dump).toContain('financial_institutions');
      expect(dump).toContain('banco-de-chile');
    } finally {
      sqlite.close();
    }
  });
});
