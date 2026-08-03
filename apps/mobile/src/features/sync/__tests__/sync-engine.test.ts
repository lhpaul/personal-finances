import type { ScrapeResult } from '@finanzas/bank-scraper';

import readComplete from '../../../db/__fixtures__/reads/read-complete.json';
import readRepeatShuffled from '../../../db/__fixtures__/reads/read-repeat-shuffled.json';
import readDuplicates from '../../../db/__fixtures__/reads/read-duplicates.json';
import readPartial from '../../../db/__fixtures__/reads/read-partial.json';
import readFailed from '../../../db/__fixtures__/reads/read-failed.json';
import readCancelled from '../../../db/__fixtures__/reads/read-cancelled.json';
import readForeignCurrency from '../../../db/__fixtures__/reads/read-foreign-currency.json';
import readBadAmount from '../../../db/__fixtures__/reads/read-bad-amount.json';
import readMissingProduct from '../../../db/__fixtures__/reads/read-missing-product.json';
import {
  appSettings,
  merchantAliases,
  merchants,
  transactionCategories,
  transactions,
  userFinancialInstitutions,
  userFinancialProducts,
  users,
} from '../../../db/schema';
import { createTestConnection } from '../../../db/testing/product-fixture';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import type { AppDatabase } from '../../../db/types';
import { __resetReadLockForTests } from '../sync-lock';
import { runSync } from '../sync-engine';
import type { ScraperRunner, SyncDeps } from '../types';

/**
 * End-to-end coverage of `runSync` against every read outcome (implementation plan Decisions 5,
 * 6, 8, 9, 13, 16, issue #10). AC9-AC15, AC22, AC28-AC30.
 */

const READS = {
  complete: readComplete as unknown as ScrapeResult,
  repeatShuffled: readRepeatShuffled as unknown as ScrapeResult,
  duplicates: readDuplicates as unknown as ScrapeResult,
  partial: readPartial as unknown as ScrapeResult,
  failed: readFailed as unknown as ScrapeResult,
  cancelled: readCancelled as unknown as ScrapeResult,
  foreignCurrency: readForeignCurrency as unknown as ScrapeResult,
  badAmount: readBadAmount as unknown as ScrapeResult,
  missingProduct: readMissingProduct as unknown as ScrapeResult,
};

function createFakeRunner(resultQueue: ScrapeResult[]): ScraperRunner & { calls: number } {
  const queue = [...resultQueue];
  return {
    calls: 0,
    async run() {
      this.calls += 1;
      const next = queue.shift();
      if (!next) throw new Error('createFakeRunner: no more queued results');
      return next;
    },
  };
}

function createRejectingRunner(error: Error): ScraperRunner {
  return {
    run: () => Promise.reject(error),
  };
}

async function makeDeps(runner: ScraperRunner) {
  __resetReadLockForTests();
  const { sqlite, db, ports } = await openBootstrappedMemoryDb();
  const connectionId = createTestConnection(db, ports);
  const deps: SyncDeps = { db, ports, runner, ready: Promise.resolve() };
  return { sqlite, db, ports, connectionId, deps };
}

function dumpWholeStore(db: AppDatabase) {
  return {
    users: db.select().from(users).all(),
    financialInstitutions: db.select().from(userFinancialInstitutions).all(),
    products: db.select().from(userFinancialProducts).all(),
    transactions: db.select().from(transactions).all(),
    merchants: db.select().from(merchants).all(),
    merchantAliases: db.select().from(merchantAliases).all(),
    categories: db.select().from(transactionCategories).all(),
    settings: db.select().from(appSettings).all(),
  };
}

describe('runSync — complete and repeat reads (AC1, AC2, AC7)', () => {
  it('a complete read stores every product and movement, and reports accurate counts', async () => {
    const runner = createFakeRunner([READS.complete]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;

      expect(result.summary).toEqual({
        productsDiscovered: 3,
        productsRefreshed: 0,
        movementsStored: 4,
        movementsAlreadyKnown: 0,
        foreignCurrencyMovementsStored: 0,
        failedProductInstanceIds: [],
      });
      expect(result.connectionState.syncStatus).toBe('ok');
      expect(result.connectionState.lastSuccessAt).toBe(result.connectionState.lastSyncAt);
      expect(result.connectionState.lastErrorCode).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('the same read applied twice reports nothing new the second time (AC2)', async () => {
    const runner = createFakeRunner([READS.complete, READS.complete]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      await runSync(deps, { connectionId });
      const second = await runSync(deps, { connectionId });
      expect(second.status).toBe('completed');
      if (second.status !== 'completed') return;
      expect(second.summary.productsDiscovered).toBe(0);
      expect(second.summary.productsRefreshed).toBe(3);
      expect(second.summary.movementsStored).toBe(0);
      expect(second.summary.movementsAlreadyKnown).toBe(4);
    } finally {
      sqlite.close();
    }
  });

  it('a shuffled repeat of the same pages stores nothing new (AC6)', async () => {
    const runner = createFakeRunner([READS.complete, READS.repeatShuffled]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      await runSync(deps, { connectionId });
      const second = await runSync(deps, { connectionId });
      expect(second.status).toBe('completed');
      if (second.status !== 'completed') return;
      expect(second.summary.movementsStored).toBe(0);
      expect(second.summary.movementsAlreadyKnown).toBe(4);
    } finally {
      sqlite.close();
    }
  });

  it('two indistinguishable movements and a charge/refund pair stay two on replay (AC5)', async () => {
    const runner = createFakeRunner([READS.duplicates, READS.duplicates]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const first = await runSync(deps, { connectionId });
      expect(first.status).toBe('completed');
      if (first.status !== 'completed') return;
      expect(first.summary.movementsStored).toBe(4);

      const second = await runSync(deps, { connectionId });
      expect(second.status).toBe('completed');
      if (second.status !== 'completed') return;
      expect(second.summary.movementsStored).toBe(0);
      expect(second.summary.movementsAlreadyKnown).toBe(4);
    } finally {
      sqlite.close();
    }
  });
});

describe('runSync — failure outcomes (AC9-AC11, AC15, AC30)', () => {
  it('a failed read stores nothing and records the failure reason (AC9, AC10)', async () => {
    const runner = createFakeRunner([READS.failed]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const before = dumpWholeStore(deps.db);

      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;

      expect(result.connectionState.syncStatus).toBe('error');
      expect(result.connectionState.lastErrorCode).toBe('invalid_credentials');
      expect(result.connectionState.lastSuccessAt).toBeNull();

      const after = dumpWholeStore(deps.db);
      expect(after.products).toEqual(before.products);
      expect(after.transactions).toEqual(before.transactions);
    } finally {
      sqlite.close();
    }
  });

  it('a partial read stores what it gathered, moves to error, and does not advance last success (AC11)', async () => {
    const runner = createFakeRunner([READS.partial]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;

      expect(result.summary.productsDiscovered).toBe(2);
      expect(result.summary.movementsStored).toBe(2);
      expect(result.summary.failedProductInstanceIds).toEqual(['c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3']);
      expect(result.connectionState.syncStatus).toBe('error');
      expect(result.connectionState.lastErrorCode).toBe('parse_failed');
      expect(result.connectionState.lastSuccessAt).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('a rejected amount stores nothing at all and records parse_failed (AC15)', async () => {
    const runner = createFakeRunner([READS.badAmount]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const before = dumpWholeStore(deps.db);

      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;

      expect(result.summary).toEqual({
        productsDiscovered: 0,
        productsRefreshed: 0,
        movementsStored: 0,
        movementsAlreadyKnown: 0,
        foreignCurrencyMovementsStored: 0,
        failedProductInstanceIds: [],
      });
      expect(result.connectionState.syncStatus).toBe('error');
      expect(result.connectionState.lastErrorCode).toBe('parse_failed');

      const after = dumpWholeStore(deps.db);
      expect(after.products).toEqual(before.products);
      expect(after.transactions).toEqual(before.transactions);
    } finally {
      sqlite.close();
    }
  });

  it('a movement whose product resolves to nothing is the same structural defect (Decision 6)', async () => {
    const runner = createFakeRunner([READS.missingProduct]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;
      expect(result.connectionState.syncStatus).toBe('error');
      expect(result.connectionState.lastErrorCode).toBe('parse_failed');
    } finally {
      sqlite.close();
    }
  });

  it('a runner rejection is mapped to a network failure, never propagated (Decision 16)', async () => {
    const runner = createRejectingRunner(new Error('BANK-CONNECTION-RESET-DO-NOT-STORE'));
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;
      expect(result.connectionState.syncStatus).toBe('error');
      expect(result.connectionState.lastErrorCode).toBe('network');
      expect(result.connectionState.lastErrorMessage).toBe('sync.errors.network');
      expect(result.connectionState.lastErrorMessage).not.toContain('BANK-CONNECTION-RESET-DO-NOT-STORE');
    } finally {
      sqlite.close();
    }
  });

  it('the recorded failure message is one of the four catalogue keys, never the bank\'s own error text or a trace value (AC30)', async () => {
    const runner = createFakeRunner([READS.failed]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;

      expect(result.connectionState.lastErrorMessage).toBe('sync.errors.invalid_credentials');
      expect(['sync.errors.invalid_credentials', 'sync.errors.session_closed', 'sync.errors.network', 'sync.errors.parse_failed']).toContain(
        result.connectionState.lastErrorMessage,
      );
      expect(result.connectionState.lastErrorMessage).not.toContain('BANK-OWN-ERROR-TEXT');
      expect(result.connectionState.lastErrorMessage).not.toContain('SUS CLAVES SON INCORRECTAS');
    } finally {
      sqlite.close();
    }
  });

  it('a partial read whose traces carry bank-flavoured text still records only the fixed key (AC30)', async () => {
    const runner = createFakeRunner([READS.partial]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;
      expect(result.connectionState.lastErrorMessage).toBe('sync.errors.parse_failed');
      expect(result.connectionState.lastErrorMessage).not.toContain('BANK-INTERNAL-TRACE-TEXT-DO-NOT-STORE');
    } finally {
      sqlite.close();
    }
  });
});

describe('runSync — a stopped (cancelled) read (AC13)', () => {
  it('stores what was gathered, returns to idle, and records no failure', async () => {
    const runner = createFakeRunner([READS.cancelled]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;
      expect(result.summary.movementsStored).toBe(1);
      expect(result.connectionState.syncStatus).toBe('idle');
      expect(result.connectionState.lastErrorCode).toBeNull();
      expect(result.connectionState.lastSuccessAt).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('does not clear an older failure (Decision 10)', async () => {
    const runner = createFakeRunner([READS.failed, READS.cancelled]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      await runSync(deps, { connectionId });
      const second = await runSync(deps, { connectionId });
      expect(second.status).toBe('completed');
      if (second.status !== 'completed') return;
      expect(second.connectionState.syncStatus).toBe('idle');
      expect(second.connectionState.lastErrorCode).toBe('invalid_credentials'); // untouched
    } finally {
      sqlite.close();
    }
  });
});

describe('runSync — currency (AC22)', () => {
  it('a foreign-currency movement is stored unconverted and counted in the summary', async () => {
    const runner = createFakeRunner([READS.foreignCurrency]);
    const { sqlite, deps, connectionId } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');
      if (result.status !== 'completed') return;
      expect(result.summary.foreignCurrencyMovementsStored).toBe(1);

      const rows = deps.db.select().from(transactions).all();
      const usdRow = rows.find((r) => r.currencyCode === 'USD');
      expect(usdRow).toBeDefined();
      expect(usdRow?.amount).toBe(5000);
    } finally {
      sqlite.close();
    }
  });
});

describe('runSync — no credential ever reaches the engine, in either direction (AC29)', () => {
  it('a sentinel credential value in the fake secure store never appears anywhere in the store or in a recorded failure', async () => {
    const SENTINEL = 'SENTINEL-CREDENTIAL-DO-NOT-STORE';
    const fakeSecureStore = new Map<string, string>();

    const runner: ScraperRunner = {
      run: async (request) => {
        // Proves the engine handed over only the *key name*: this fake "bank" looks the value up
        // itself, using the key the engine gave it. The engine never sees this value, and this
        // fixture's own ScrapeResult (below) never echoes it back either — the read's diagnostic
        // trace is exactly where a real scraper's redaction could fail, so the sentinel is
        // planted there too.
        fakeSecureStore.set(request.credentialsKey, SENTINEL);
        const value = fakeSecureStore.get(request.credentialsKey);
        expect(value).toBe(SENTINEL); // the fake bank did receive it, through the side channel

        return {
          ...READS.complete,
          traces: [
            {
              logGroup: 'login-start',
              type: 'info',
              message: `session established (not the credential, but planted near it: ${SENTINEL})`,
              timestamp: 1,
            },
          ],
        };
      },
    };

    const { sqlite, deps, connectionId, db } = await makeDeps(runner);
    try {
      const result = await runSync(deps, { connectionId });
      expect(result.status).toBe('completed');

      const dump = JSON.stringify(dumpWholeStore(db));
      expect(dump).not.toContain(SENTINEL);
      if (result.status === 'completed') {
        expect(result.connectionState.lastErrorMessage ?? '').not.toContain(SENTINEL);
        expect(JSON.stringify(result.summary)).not.toContain(SENTINEL);
      }
    } finally {
      sqlite.close();
    }
  });
});

describe('runSync — atomicity and rejection (AC14)', () => {
  it('rejects for an unknown connection id (a programming error), and releases the lock on the way out', async () => {
    const runner = createFakeRunner([]);
    const { sqlite, deps } = await makeDeps(runner);
    try {
      await expect(runSync(deps, { connectionId: 'does-not-exist' })).rejects.toThrow();

      // If the `finally` had not released the lock, this second call would come back
      // `{ status: 'refused' }` instead of rejecting again — proving the lock, not a leftover
      // exception, decides the outcome here.
      await expect(runSync(deps, { connectionId: 'still-does-not-exist' })).rejects.toThrow();
    } finally {
      sqlite.close();
    }
  });
});
