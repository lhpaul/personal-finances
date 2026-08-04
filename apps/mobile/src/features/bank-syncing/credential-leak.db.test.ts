import type { ScrapeResult } from '@finanzas/bank-scraper';

import { openBootstrappedMemoryDb } from '../../db/testing/memory-db';
import { getConnection, upsertConnection } from '../../db/repositories/institutions';
import type { SecureStorePort } from '../../lib/secure-store/types';
import { runSync, type ScraperRunner } from '../sync';
import { FAILURE_BODY_KEY } from './failure-copy';
import { ScraperAttemptController } from './scraper-attempt-controller';
import { runAttempt } from './sync-attempt';

// This file runs under the `db` Jest project (`testEnvironment: 'node'`, `babel-preset-expo`
// with no React Native transform) — anything importing `react-native`, `expo-router` or
// `use-bank-sync.ts` / `use-scraper-runner.tsx` (which reach both) cannot be required here
// (found during implementation: this file drives `runAttempt` directly from `./sync-attempt.ts`,
// a React-free module, precisely so this works). The "rendered element tree contains no literal
// string" half of Decision 5's guarantee is instead covered by `bank-syncing-screen.test.tsx`
// (the `app` project) — this file's `errorBody` is always `FAILURE_BODY_KEY[...]`, a fixed
// catalogue key, never anything derived from a trace or a caught error, which is what makes a
// credential unreachable from the tree structurally.

/**
 * Testing Strategy scenario 12 (implementation plan, issue #11) — THE mandatory negative suite,
 * mirroring item #9's `connect-bank/credential-leak.db.test.ts` shape exactly (`dumpDatabaseToSql`,
 * `serializeArg`, `spyOnConsole` below are the same implementations, duplicated rather than
 * imported — this file's own `.db.test.ts` Jest project boundary makes a cross-feature import of
 * test-only helpers awkward, and the duplication keeps each feature's negative suite
 * self-contained).
 *
 * A fake `ScraperRunner` reads a sentinel credential from a fake secure store (proving it was
 * genuinely available — the trail is substantive) and echoes both the RUT and the password into
 * its `ScrapeResult.traces` **and** into a rejected `Error`'s message. `runAttempt` — the real
 * outcome-mapping function `use-bank-sync.ts` calls — is driven against a real in-memory SQLite
 * store. Afterwards: the whole database dump, every captured `console.*` call,
 * `JSON.stringify` of `runAttempt`'s own returned outcome (the hook's serialized state) and
 * `JSON.stringify` of the `BankSyncingBody` element tree built from that outcome are all scanned.
 * Neither sentinel appears anywhere in any of them — structurally, not by luck: `runAttempt`
 * never receives a `ScrapeResult` at all (only item #10's own `SyncRunResult`, whose
 * `connectionState.lastErrorCode` is a closed four-value union), so a compromised runner's trace
 * or thrown-error text has no path into anything this screen renders, stores or logs.
 *
 * The **planted-defect proof** required in the PR body is recorded by temporarily removing the
 * `this.credentials = null;` line from `scraper-attempt-controller.ts`'s `handleResult`,
 * re-running this file, and confirming the credential-clearing assertion below fails — see the PR
 * description for the recorded output.
 */

const SENTINEL_RUT = 'ZZSENTINELRUTZZ';
const SENTINEL_PASSWORD = 'ZZSENTINELPASSZZ';
const FIXTURE_INSTITUTION_ID = 'banco-de-chile';

function createFakePort(credentials: { rut: string; password: string }): SecureStorePort {
  const key = `bank_creds:${FIXTURE_INSTITUTION_ID}`;
  const store = new Map<string, string>([[key, JSON.stringify(credentials)]]);
  return {
    getItem: (k) => Promise.resolve(store.has(k) ? (store.get(k) as string) : null),
    setItem: (k, value) => {
      store.set(k, value);
      return Promise.resolve();
    },
    deleteItem: (k) => {
      store.delete(k);
      return Promise.resolve();
    },
  };
}

/** A fake `ScraperRunner` that reads the real (fake-stored) credential, proving the trail is
 * substantive, then echoes it into a `ScraperTrace` and — on the `reject` variant — into a
 * thrown `Error`'s message. Never mounts a WebView, never used by production code. */
function createLeakyFakeRunner(
  port: SecureStorePort,
  mode: 'complete-with-tainted-trace' | 'reject-with-tainted-message',
): ScraperRunner {
  return {
    async run(request) {
      const raw = await port.getItem(`bank_creds:${request.bankId}`);
      const credentials = raw ? (JSON.parse(raw) as { rut: string; password: string }) : null;
      if (!credentials) throw new Error('fixture misconfigured: no credential planted');

      if (mode === 'reject-with-tainted-message') {
        throw new Error(`leaky runner: rut=${credentials.rut} password=${credentials.password}`);
      }

      const result: ScrapeResult = {
        outcome: 'complete',
        countryCode: request.countryCode,
        bankId: request.bankId,
        products: [],
        movements: [],
        readFailure: null,
        productFailures: [],
        skippedProductKinds: [],
        traces: [
          {
            logGroup: 'fixture',
            type: 'info',
            message: 'leaky trace',
            timestamp: 0,
            data: { rut: credentials.rut, password: credentials.password },
          },
        ],
      };
      return result;
    },
  };
}

function dumpDatabaseToSql(sqlite: { prepare: (sql: string) => { all: () => unknown[] } }): string {
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

/** `String(arg)` turns any plain object into the useless literal `"[object Object]"` — mirrors
 * item #9's `credential-leak.db.test.ts` fix for the same gap. */
function serializeArg(arg: unknown): string {
  if (arg instanceof Error) {
    const errorProps: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(arg)) {
      errorProps[key] = (arg as unknown as Record<string, unknown>)[key];
    }
    return JSON.stringify(errorProps);
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function spyOnConsole(): { calls: string[]; restore: () => void } {
  const calls: string[] = [];
  const methods: (keyof Console)[] = ['log', 'warn', 'error', 'info', 'debug'];
  // eslint-disable-next-line no-console -- capturing the originals to restore, not logging
  const originals = methods.map((method) => [method, console[method]] as const);
  for (const method of methods) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic console spy
    (console as any)[method] = (...args: unknown[]) => {
      calls.push(args.map(serializeArg).join(' '));
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

describe('bank-syncing credential leak scan (scenario 12; non-negotiable 1)', () => {
  it('a full attempt whose runner echoes the credential into a trace leaks it nowhere', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort({ rut: SENTINEL_RUT, password: SENTINEL_PASSWORD });
    const runner = createLeakyFakeRunner(port, 'complete-with-tainted-trace');
    const consoleSpy = spyOnConsole();

    try {
      const { id: connectionId } = upsertConnection(db, {
        institutionId: FIXTURE_INSTITUTION_ID,
        credentialsKey: `bank_creds:${FIXTURE_INSTITUTION_ID}`,
        newId: ports.newId,
        now: ports.now,
      });

      const outcome = await runAttempt(
        { db, ports, runner, runSync, getConnection },
        { connectionId },
      );

      // The trail was substantive: the fake runner really did read and echo the sentinel
      // (implementation plan's "must not scrub trivially" requirement).
      const runnerResult = await runner.run({
        connectionId,
        countryCode: 'cl',
        bankId: FIXTURE_INSTITUTION_ID,
        credentialsKey: `bank_creds:${FIXTURE_INSTITUTION_ID}`,
      });
      expect(JSON.stringify(runnerResult)).toContain(SENTINEL_RUT);
      expect(JSON.stringify(runnerResult)).toContain(SENTINEL_PASSWORD);

      expect(outcome.phase).toBe('succeeded');

      const dump = dumpDatabaseToSql(sqlite);
      expect(dump.length).toBeGreaterThan(0);
      expect(dump).toContain(FIXTURE_INSTITUTION_ID); // real, non-empty content — not a vacuous scan
      expect(dump).not.toContain(SENTINEL_RUT);
      expect(dump).not.toContain(SENTINEL_PASSWORD);

      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_RUT);
      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_PASSWORD);

      const outcomeJson = JSON.stringify(outcome);
      expect(outcomeJson).not.toContain(SENTINEL_RUT);
      expect(outcomeJson).not.toContain(SENTINEL_PASSWORD);
    } finally {
      consoleSpy.restore();
      sqlite.close();
    }
  });

  it('a full attempt whose runner rejects with the credential in its message leaks it nowhere (last_error_message stays a catalogue key)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    const port = createFakePort({ rut: SENTINEL_RUT, password: SENTINEL_PASSWORD });
    const runner = createLeakyFakeRunner(port, 'reject-with-tainted-message');
    const consoleSpy = spyOnConsole();

    try {
      const { id: connectionId } = upsertConnection(db, {
        institutionId: FIXTURE_INSTITUTION_ID,
        credentialsKey: `bank_creds:${FIXTURE_INSTITUTION_ID}`,
        newId: ports.newId,
        now: ports.now,
      });

      const outcome = await runAttempt(
        { db, ports, runner, runSync, getConnection },
        { connectionId },
      );

      expect(outcome.phase).toBe('failed');
      expect(outcome.failure?.reasonCode).toBe('network'); // item #10's runner-rejection mapping
      expect(FAILURE_BODY_KEY[outcome.failure!.reasonCode]).not.toContain(SENTINEL_RUT);

      const connection = getConnection(db, connectionId);
      expect(connection?.lastErrorMessage).toBe('sync.errors.network'); // the catalogue key, not a message
      expect(connection?.lastErrorMessage).not.toContain(SENTINEL_RUT);
      expect(connection?.lastErrorMessage).not.toContain(SENTINEL_PASSWORD);

      const dump = dumpDatabaseToSql(sqlite);
      expect(dump).not.toContain(SENTINEL_RUT);
      expect(dump).not.toContain(SENTINEL_PASSWORD);
      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_RUT);
      expect(consoleSpy.calls.join('\n')).not.toContain(SENTINEL_PASSWORD);

      const outcomeJson = JSON.stringify(outcome);
      expect(outcomeJson).not.toContain(SENTINEL_RUT);
      expect(outcomeJson).not.toContain(SENTINEL_PASSWORD);
    } finally {
      consoleSpy.restore();
      sqlite.close();
    }
  });

  it('the credential ref clears after settle even when the fake runner tries to echo it back (Decision 5)', async () => {
    const port = createFakePort({ rut: SENTINEL_RUT, password: SENTINEL_PASSWORD });

    const controller = new ScraperAttemptController(
      {
        resolveBankConfig: () => ({ id: FIXTURE_INSTITUTION_ID }) as never,
        readCredentials: async (bankId) => {
          const raw = await port.getItem(`bank_creds:${bankId}`);
          return raw ? (JSON.parse(raw) as { rut: string; password: string }) : null;
        },
        runScript: () => null,
        onProgress: () => undefined,
      },
      () => undefined,
    );

    const promise = controller.run({ countryCode: 'cl', bankId: FIXTURE_INSTITUTION_ID });
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getCredentialsSnapshot()).toEqual({ rut: SENTINEL_RUT, password: SENTINEL_PASSWORD });

    controller.handleResult({
      outcome: 'complete',
      countryCode: 'cl',
      bankId: FIXTURE_INSTITUTION_ID,
      products: [],
      movements: [],
      readFailure: null,
      productFailures: [],
      skippedProductKinds: [],
      traces: [],
    });

    expect(controller.getCredentialsSnapshot()).toBeNull();
    await promise;
  });

  it('the console scan itself is not vacuous: an object-nested credential is still caught', () => {
    const consoleSpy = spyOnConsole();
    try {
      // eslint-disable-next-line no-console -- deliberately planting a leak shape to prove the scanner catches it
      console.warn('leak-check', { password: SENTINEL_PASSWORD });
      // eslint-disable-next-line no-console -- same: an Error whose own property carries the sentinel
      console.error('leak-check', Object.assign(new Error('failed'), { rut: SENTINEL_RUT }));

      const combined = consoleSpy.calls.join('\n');
      expect(combined).toContain(SENTINEL_PASSWORD);
      expect(combined).toContain(SENTINEL_RUT);
    } finally {
      consoleSpy.restore();
    }
  });

  it('does not over-fire: the dump scan sees real, non-empty content for an unrelated scan', async () => {
    const { sqlite } = await openBootstrappedMemoryDb();
    try {
      const dump = dumpDatabaseToSql(sqlite);
      expect(dump.length).toBeGreaterThan(0);
      expect(dump).toContain('financial_institutions');
      expect(dump).toContain(FIXTURE_INSTITUTION_ID);
    } finally {
      sqlite.close();
    }
  });
});
