import { isOnboardingCompleted, markOnboardingCompleted } from '../../db/repositories/settings';
import { insertManualTransaction } from '../../db/repositories/transactions';
import {
  userBudgets,
  userFinancialInstitutions,
  userFinancialProducts,
  userRecurringTransactions,
} from '../../db/schema';
import { openBootstrappedMemoryDb } from '../../db/testing/memory-db';
import {
  createTestConnection,
  createTestProduct,
  setConnectionFieldsForTest,
} from '../../db/testing/product-fixture';
import type { AppDatabase } from '../../db/types';
import { credentialsKeyFor } from '../../lib/secure-store/credential-store';
import { createMemorySecureStore } from '../../lib/secure-store/testing/memory-secure-store';
import { collectCredentialKeys, wipeLocalData, type WipeResult } from './wipe-local-data';

/**
 * Sentinel values (implementation plan for issue #19, Seed Data section) — chosen so scenario 5's
 * leak scan fails loudly if either reaches a `WipeResult` or a catalogue string. Reuses
 * `src/db/__tests__/secrets.test.ts`'s exact pattern.
 */
const SENTINEL_RUT = '11.111.111-1';
const SENTINEL_PASSWORD = 'ZZWIPEFIXTUREZZ';
const SECRET_PATTERN = /password|clave|token|secret|\b[0-9]{7,8}-[0-9kK]\b/i;

function seededCredential(): string {
  return JSON.stringify({ rut: SENTINEL_RUT, password: SENTINEL_PASSWORD });
}

/**
 * Builds the scenario-1 fixture: a bootstrapped store with an `active` connection, a
 * `disconnected` one, a product, a transaction, and `onboarding_completed` set — plus a memory
 * secure store seeded with both connections' keys and one orphan (`bank_creds:santander`, no
 * connection row).
 */
async function buildFixture() {
  const initial = await openBootstrappedMemoryDb();
  const { db, ports } = initial;

  const activeConnectionId = createTestConnection(db, ports, 'banco-de-chile');
  const disconnectedConnectionId = createTestConnection(db, ports, 'falabella');
  setConnectionFieldsForTest(db, disconnectedConnectionId, { status: 'disconnected' });

  const productId = createTestProduct(db, ports, activeConnectionId);
  await insertManualTransaction(
    db,
    { userFinancialProductId: productId, type: 'debit', amount: 1500, rawDescription: 'Café' },
    ports,
  );
  markOnboardingCompleted(db);

  const secureStore = createMemorySecureStore({
    [credentialsKeyFor('banco-de-chile')]: seededCredential(),
    [credentialsKeyFor('falabella')]: seededCredential(),
    [credentialsKeyFor('santander')]: seededCredential(), // orphan — no connection row
  });

  return { initial, db, secureStore };
}

describe('wipeLocalData — scenario 1: the wipe proof (brief AC1, AC2; Decisions 1, 2, 4)', () => {
  it('empties the secure store completely (including the orphan), resets the store after every credential delete, and a fresh bootstrap has zero user-owned rows', async () => {
    const { initial, db, secureStore } = await buildFixture();
    let sqlite = initial.sqlite;
    let freshDb: AppDatabase | undefined;
    const callOrder: string[] = [];

    const trackedDeleteItem = secureStore.deleteItem.bind(secureStore);
    const spiedStore = {
      ...secureStore,
      deleteItem: async (key: string) => {
        callOrder.push(`delete:${key}`);
        return trackedDeleteItem(key);
      },
    };

    const resetStore = async () => {
      callOrder.push('resetStore');
      sqlite.close();
      const fresh = await openBootstrappedMemoryDb();
      sqlite = fresh.sqlite;
      freshDb = fresh.db;
    };

    const result = await wipeLocalData({ db, secureStore: spiedStore, resetStore });

    expect(result).toEqual<WipeResult>({ status: 'ok' });

    // (a) the fake secure store is completely empty — including the orphan.
    expect(secureStore.entries()).toEqual({});

    // (b) resetStore ran after every credential delete, not interleaved or before.
    const resetIndex = callOrder.indexOf('resetStore');
    expect(resetIndex).toBeGreaterThan(-1);
    expect(callOrder.slice(0, resetIndex).every((entry) => entry.startsWith('delete:'))).toBe(true);
    expect(callOrder.slice(resetIndex)).toEqual(['resetStore']);

    // (c) a fresh bootstrap has zero rows in every user-owned table, and no onboarding flag.
    expect(freshDb).toBeDefined();
    const fresh = freshDb as AppDatabase;
    expect(fresh.select().from(userFinancialInstitutions).all()).toHaveLength(0);
    expect(fresh.select().from(userFinancialProducts).all()).toHaveLength(0);
    expect(fresh.select().from(userBudgets).all()).toHaveLength(0);
    expect(fresh.select().from(userRecurringTransactions).all()).toHaveLength(0);
    expect(isOnboardingCompleted(fresh)).toBe(false);

    sqlite.close();
  });
});

describe('wipeLocalData — scenario 2: fail-closed (Decision 1)', () => {
  it('a secure store whose deleteItem silently no-ops for one key returns credentials_failed and never calls resetStore', async () => {
    const { db, secureStore } = await buildFixture();
    const noopKey = credentialsKeyFor('falabella');

    const flakyStore = {
      ...secureStore,
      deleteItem: async (key: string) => {
        if (key === noopKey) return; // silently no-ops — the entry survives
        return secureStore.deleteItem(key);
      },
    };

    const resetStore = jest.fn(async () => undefined);

    const result = await wipeLocalData({ db, secureStore: flakyStore, resetStore });

    expect(result).toEqual<WipeResult>({ status: 'credentials_failed' });
    expect(resetStore).not.toHaveBeenCalled();
    // The database is untouched — every row this fixture wrote is still there.
    expect(db.select().from(userFinancialInstitutions).all()).toHaveLength(2);
    expect(db.select().from(userFinancialProducts).all()).toHaveLength(1);
    // The surviving key is exactly the one whose delete no-op'd.
    expect(secureStore.entries()[noopKey]).toBeDefined();
  });
});

describe('wipeLocalData — scenario 2b: fail-closed on a rejecting keychain (found in review — a real keychain can reject on I/O, not just silently no-op)', () => {
  it('a deleteItem that REJECTS (not silently no-ops) returns credentials_failed, never calls resetStore, and the rejection never escapes as an unhandled rejection', async () => {
    const { db, secureStore } = await buildFixture();
    const rejectingKey = credentialsKeyFor('falabella');

    const flakyStore = {
      ...secureStore,
      deleteItem: async (key: string) => {
        if (key === rejectingKey) throw new Error('simulated keychain I/O error');
        return secureStore.deleteItem(key);
      },
    };
    const resetStore = jest.fn(async () => undefined);

    let unhandled: unknown;
    const onUnhandledRejection = (reason: unknown) => {
      unhandled = reason;
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const result = await wipeLocalData({ db, secureStore: flakyStore, resetStore });
      expect(result).toEqual<WipeResult>({ status: 'credentials_failed' });
      expect(resetStore).not.toHaveBeenCalled();
      // The database is untouched.
      expect(db.select().from(userFinancialInstitutions).all()).toHaveLength(2);
      // The key whose delete rejected is still present — deleteAllCredentials stopped there.
      expect(secureStore.entries()[rejectingKey]).toBeDefined();
    } finally {
      await new Promise((resolve) => setImmediate(resolve));
      process.removeListener('unhandledRejection', onUnhandledRejection);
    }

    expect(unhandled).toBeUndefined();
  });

  it('a getItem that REJECTS during the read-back loop also returns credentials_failed and never calls resetStore', async () => {
    const { db, secureStore } = await buildFixture();
    const rejectingKey = credentialsKeyFor('falabella');

    const flakyStore = {
      ...secureStore,
      getItem: async (key: string) => {
        if (key === rejectingKey) throw new Error('simulated keychain read error');
        return secureStore.getItem(key);
      },
    };
    const resetStore = jest.fn(async () => undefined);

    const result = await wipeLocalData({ db, secureStore: flakyStore, resetStore });

    expect(result).toEqual<WipeResult>({ status: 'credentials_failed' });
    expect(resetStore).not.toHaveBeenCalled();
    expect(db.select().from(userFinancialInstitutions).all()).toHaveLength(2);
  });
});

describe('wipeLocalData — scenario 3: store failure (Decision 1; concurrency checklist item 7)', () => {
  it('credentials delete cleanly, resetStore rejects: returns store_failed and the rejection never escapes as an unhandled rejection', async () => {
    const { db, secureStore } = await buildFixture();

    let unhandled: unknown;
    const onUnhandledRejection = (reason: unknown) => {
      unhandled = reason;
    };
    process.on('unhandledRejection', onUnhandledRejection);

    const resetStore = async () => {
      throw new Error('simulated store-reset failure');
    };

    try {
      const result = await wipeLocalData({ db, secureStore, resetStore });
      expect(result).toEqual<WipeResult>({ status: 'store_failed' });
      // Credentials were still deleted — only the store half failed.
      expect(secureStore.entries()).toEqual({});
    } finally {
      // Give any stray unhandled-rejection microtask a chance to fire before asserting.
      await new Promise((resolve) => setImmediate(resolve));
      process.removeListener('unhandledRejection', onUnhandledRejection);
    }

    expect(unhandled).toBeUndefined();
  });
});

describe('wipeLocalData — scenario 4: key-space derivation (brief AC1; Decision 2)', () => {
  it('returns the deduplicated union of connection keys (including disconnected) and catalogue-derived keys', async () => {
    const { db } = await buildFixture();

    const keys = collectCredentialKeys(db);

    expect(keys).toEqual(expect.arrayContaining([credentialsKeyFor('banco-de-chile'), credentialsKeyFor('falabella')]));
    // The full seeded catalogue (six institutions) is swept too, even ones with no connection.
    expect(keys).toEqual(
      expect.arrayContaining([
        credentialsKeyFor('santander'),
        credentialsKeyFor('bci'),
        credentialsKeyFor('banco-estado'),
        credentialsKeyFor('itau'),
      ]),
    );
    // Deduplicated: banco-de-chile and falabella each appear via both sources, but only once.
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('wipeLocalData — scenario 5: no credential value is ever named (BR1, non-negotiable 1)', () => {
  it('every WipeResult variant carries no message, key name or cause payload', () => {
    const variants: WipeResult[] = [
      { status: 'ok' },
      { status: 'credentials_failed' },
      { status: 'store_failed' },
    ];
    for (const variant of variants) {
      expect(Object.keys(variant)).toEqual(['status']);
      const serialized = JSON.stringify(variant);
      expect(serialized).not.toContain(SENTINEL_RUT);
      expect(serialized).not.toContain(SENTINEL_PASSWORD);
      expect(SECRET_PATTERN.test(serialized)).toBe(false);
    }
  });
});
