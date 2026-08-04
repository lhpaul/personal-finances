import fs from 'node:fs';
import path from 'node:path';

import { findPreservationViolations } from '../../checks/preservation';
import { createBetterSqliteCipherPort } from '../../testing/cipher-port';
import { openFileBackedLegacyStore } from '../../testing/memory-db';
import { ENCRYPTED_DATABASE_NAME, ENCRYPTION_MARKER_SETTING, LEGACY_DATABASE_NAME } from '../constants';
import { DatabaseEncryptionMigrationError } from '../errors';
import { migratePlaintextToEncrypted } from '../migrate-to-encrypted';
import type { CipherDatabasePort, CipherHandle } from '../types';
import { buildCensus } from '../census';

const FIXTURE_PATH = path.resolve(__dirname, '../../__fixtures__/store-v1.sql');
const KEY_HEX = 'c'.repeat(64);

function deterministicNow(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `2026-02-01T00:00:0${counter}.000Z`;
  };
}

/** Wraps a real `CipherHandle`, throwing on a chosen method call — the "rejecting-fs" style
 * write-path failure-injection this item's dispatch note calls for, applied to every numbered
 * step of Decision 6's sequence. */
function rejectingHandle(real: CipherHandle, failOn: keyof CipherHandle, error: Error): CipherHandle {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === failOn) {
        return () => {
          throw error;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/** Wraps a real `CipherDatabasePort`, substituting a rejecting handle for exactly one call to
 * `openPlain`/`openKeyed` (identified by `atCall`, 1-indexed across both methods combined — this
 * function only ever calls each once, so `atCall` unambiguously names "the legacy open" (1) or
 * "the post-verification keyed open" (2)). */
function rejectingPort(
  real: CipherDatabasePort,
  options: { failHandleMethod?: keyof CipherHandle; failOpenKeyed?: Error; error?: Error },
): CipherDatabasePort {
  return {
    ...real,
    openPlain(databaseName: string) {
      const handle = real.openPlain(databaseName);
      return options.failHandleMethod ? rejectingHandle(handle, options.failHandleMethod, options.error as Error) : handle;
    },
    openKeyed(databaseName: string, keyHex: string) {
      if (options.failOpenKeyed) throw options.failOpenKeyed;
      return real.openKeyed(databaseName, keyHex);
    },
  };
}

describe('migratePlaintextToEncrypted — happy path (Decision 6)', () => {
  it('leaves the marker written and the legacy store deleted, and returns an open, valid handle', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: store.directory });

    const encrypted = await migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() });

    const marker = encrypted.query<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = '${ENCRYPTION_MARKER_SETTING}';`,
    );
    expect(marker).toHaveLength(1);
    expect(fs.existsSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toBe(false);
    expect(fs.existsSync(path.join(store.directory, ENCRYPTED_DATABASE_NAME))).toBe(true);
    expect(encrypted.userTableCount()).toBeGreaterThan(0);

    encrypted.close();
    store.cleanup();
  });

  it('preserves every row and column the original store had (census, before vs. copied)', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const beforeHandle = createBetterSqliteCipherPort({ directory: store.directory }).openPlain(LEGACY_DATABASE_NAME);
    const before = buildCensus(beforeHandle);
    beforeHandle.close();

    const port = createBetterSqliteCipherPort({ directory: store.directory });
    const encrypted = await migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() });
    const after = buildCensus(encrypted);

    // The marker row is the one permitted addition (runbook Step 3's own documented exception).
    const findings = findPreservationViolations(before, after);
    expect(findings).toEqual([]);

    encrypted.close();
    store.cleanup();
  });
});

describe('migratePlaintextToEncrypted — census-violation abort (Decision 6, step 6)', () => {
  it('deletes the unverified encrypted copy and leaves the plaintext store byte-identical', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: store.directory });
    const beforeBytes = fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME));

    // Forces a census violation without touching the copy machinery itself: `exportMainTo` on
    // the double literally copies rows, so the only reliable way to plant a mismatch the census
    // will catch is to corrupt the *comparison inputs* — done here by wrapping `query` so the
    // `after` read of one table returns nothing, which `findPreservationViolations` reports as
    // `table_missing_after_migration`.
    const failingPort: CipherDatabasePort = {
      ...port,
      openPlain(databaseName: string) {
        const real = port.openPlain(databaseName);
        let exportCalls = 0;
        return new Proxy(real, {
          get(target, prop, receiver) {
            if (prop === 'exportMainTo') {
              return (alias: string) => {
                exportCalls += 1;
                (target as CipherHandle).exportMainTo(alias);
                // Sabotage the copy after it ran, so step 6's before/after census genuinely
                // differ — deletes one row from the *encrypted alias's* copy, not from `main`.
                (target as CipherHandle).exec(`DELETE FROM encrypted.merchant_aliases WHERE 1=1;`);
                expect(exportCalls).toBe(1);
              };
            }
            return Reflect.get(target, prop, receiver);
          },
        });
      },
    };

    await expect(
      migratePlaintextToEncrypted({ port: failingPort, keyHex: KEY_HEX, now: deterministicNow() }),
    ).rejects.toBeInstanceOf(DatabaseEncryptionMigrationError);

    // The plaintext original was never opened for writing — byte-identical.
    expect(fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toEqual(beforeBytes);
    // The unverified encrypted copy was discarded.
    expect(fs.existsSync(path.join(store.directory, ENCRYPTED_DATABASE_NAME))).toBe(false);

    store.cleanup();
  });

  it("the thrown error's findingKinds names the violation kind and table, never a row value", async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: store.directory });
    const failingPort: CipherDatabasePort = {
      ...port,
      openPlain(databaseName: string) {
        const real = port.openPlain(databaseName);
        return new Proxy(real, {
          get(target, prop, receiver) {
            if (prop === 'exportMainTo') {
              return (alias: string) => {
                (target as CipherHandle).exportMainTo(alias);
                (target as CipherHandle).exec(`DELETE FROM encrypted.merchant_aliases WHERE 1=1;`);
              };
            }
            return Reflect.get(target, prop, receiver);
          },
        });
      },
    };

    try {
      await migratePlaintextToEncrypted({ port: failingPort, keyHex: KEY_HEX, now: deterministicNow() });
      throw new Error('expected migratePlaintextToEncrypted to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseEncryptionMigrationError);
      const migrationError = error as DatabaseEncryptionMigrationError;
      expect(migrationError.findingKinds.some((kind) => kind.startsWith('row_lost:merchant_aliases'))).toBe(true);
    }

    store.cleanup();
  });
});

describe('migratePlaintextToEncrypted — write-path error handling at every step (rejecting-store / rejecting-fs)', () => {
  it('step 2 (wal_checkpoint) failure: aborts, deletes the (never-created) encrypted store, leaves the legacy store untouched', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const realPort = createBetterSqliteCipherPort({ directory: store.directory });
    const port = rejectingPort(realPort, { failHandleMethod: 'exec', error: new Error('simulated wal_checkpoint failure') });
    const beforeBytes = fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME));

    await expect(migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() })).rejects.toBeInstanceOf(
      DatabaseEncryptionMigrationError,
    );

    expect(fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toEqual(beforeBytes);
    expect(fs.existsSync(path.join(store.directory, ENCRYPTED_DATABASE_NAME))).toBe(false);
    store.cleanup();
  });

  it('step 3 (attachEncrypted) failure: aborts, deletes any encrypted-store artefact, leaves the legacy store untouched', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const realPort = createBetterSqliteCipherPort({ directory: store.directory });
    const port = rejectingPort(realPort, {
      failHandleMethod: 'attachEncrypted',
      error: new Error('simulated attach failure'),
    });
    const beforeBytes = fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME));

    await expect(migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() })).rejects.toBeInstanceOf(
      DatabaseEncryptionMigrationError,
    );

    expect(fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toEqual(beforeBytes);
    expect(fs.existsSync(path.join(store.directory, ENCRYPTED_DATABASE_NAME))).toBe(false);
    store.cleanup();
  });

  it('step 4 (exportMainTo) failure: aborts, deletes the partial encrypted store, leaves the legacy store untouched', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const realPort = createBetterSqliteCipherPort({ directory: store.directory });
    const port = rejectingPort(realPort, {
      failHandleMethod: 'exportMainTo',
      error: new Error('simulated export failure'),
    });
    const beforeBytes = fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME));

    await expect(migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() })).rejects.toBeInstanceOf(
      DatabaseEncryptionMigrationError,
    );

    expect(fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toEqual(beforeBytes);
    expect(fs.existsSync(path.join(store.directory, ENCRYPTED_DATABASE_NAME))).toBe(false);
    store.cleanup();
  });

  it('step 5 (copyUserVersionTo) failure: aborts, deletes the partial encrypted store, leaves the legacy store untouched', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const realPort = createBetterSqliteCipherPort({ directory: store.directory });
    const port = rejectingPort(realPort, {
      failHandleMethod: 'copyUserVersionTo',
      error: new Error('simulated user_version copy failure'),
    });
    const beforeBytes = fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME));

    await expect(migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() })).rejects.toBeInstanceOf(
      DatabaseEncryptionMigrationError,
    );

    expect(fs.readFileSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toEqual(beforeBytes);
    expect(fs.existsSync(path.join(store.directory, ENCRYPTED_DATABASE_NAME))).toBe(false);
    store.cleanup();
  });

  it('step 9 (openKeyed after verification) failure: the verified export is left in place for the next launch, not deleted blindly', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const realPort = createBetterSqliteCipherPort({ directory: store.directory });
    const port = rejectingPort(realPort, { failOpenKeyed: new Error('simulated reopen failure') });

    await expect(migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() })).rejects.toBeInstanceOf(
      DatabaseEncryptionMigrationError,
    );

    // The plaintext original was already closed by steps 1-8 but is deleted only at step 11,
    // which this function never reaches — so it is still present, untouched, on disk. The export
    // itself is left on disk too (unmarked) for `resume_after_partial_copy` to discard and retry
    // on the next launch — this function has no open handle on it to safely act through.
    expect(fs.existsSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toBe(true);
    expect(fs.existsSync(path.join(store.directory, ENCRYPTED_DATABASE_NAME))).toBe(true);
    store.cleanup();
  });

  it('step 10 (commit-marker write) failure: closes the handle and deletes the unmarked store so the next launch retries from scratch', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const realPort = createBetterSqliteCipherPort({ directory: store.directory });
    // `setSetting` runs through `encrypted.db` (Drizzle), not through `exec`/`query` — the
    // simplest deterministic way to make it fail is to make every `exec` on the *keyed* handle
    // throw, since Drizzle's `insert(...).run()` compiles to an `exec`-shaped call under the
    // better-sqlite3 driver.
    const port: CipherDatabasePort = {
      ...realPort,
      openKeyed(databaseName: string, keyHex: string) {
        const handle = realPort.openKeyed(databaseName, keyHex);
        return new Proxy(handle, {
          get(target, prop, receiver) {
            if (prop === 'db') {
              return new Proxy(target.db, {
                get(dbTarget, dbProp, dbReceiver) {
                  if (dbProp === 'insert') {
                    return () => {
                      throw new Error('simulated marker-write failure');
                    };
                  }
                  return Reflect.get(dbTarget, dbProp, dbReceiver);
                },
              });
            }
            return Reflect.get(target, prop, receiver);
          },
        });
      },
    };

    await expect(migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() })).rejects.toBeInstanceOf(
      DatabaseEncryptionMigrationError,
    );

    // Never reaches step 11 (the legacy delete happens only after a successful commit), so the
    // plaintext original is still present — untouched, exactly as it was before this call.
    expect(fs.existsSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toBe(true);
    expect(fs.existsSync(path.join(store.directory, ENCRYPTED_DATABASE_NAME))).toBe(false);
    store.cleanup();
  });

  it('step 11 (delete legacy after commit) failure is non-fatal: the function still returns the valid, committed encrypted handle', async () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const realPort = createBetterSqliteCipherPort({ directory: store.directory });
    let deleteCalls = 0;
    const port: CipherDatabasePort = {
      ...realPort,
      deleteDatabaseIfPresent(databaseName: string) {
        if (databaseName === LEGACY_DATABASE_NAME) {
          deleteCalls += 1;
          throw new Error('simulated legacy-deletion failure');
        }
        realPort.deleteDatabaseIfPresent(databaseName);
      },
    };

    const encrypted = await migratePlaintextToEncrypted({ port, keyHex: KEY_HEX, now: deterministicNow() });

    expect(deleteCalls).toBe(1);
    const marker = encrypted.query<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = '${ENCRYPTION_MARKER_SETTING}';`,
    );
    expect(marker).toHaveLength(1);
    // The orphaned legacy file is still present — the *next* launch's
    // `plaintext_orphan_after_success` state is what cleans it up, not this call failing.
    expect(fs.existsSync(path.join(store.directory, LEGACY_DATABASE_NAME))).toBe(true);

    encrypted.close();
    store.cleanup();
  });
});
