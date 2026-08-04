import { isDueForAutomaticSync } from '../../sync/auto-sync';
import { getConnection } from '../../../db/repositories/institutions';
import { transactions, userFinancialProducts } from '../../../db/schema';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { createTestConnection, createTestProduct } from '../../../db/testing/product-fixture';
import type { AppDatabase } from '../../../db/types';
import type { SecureStorePort } from '../../../lib/secure-store/types';
import { disconnectBank } from '../disconnect-bank.service';

/** Mirrors `credential-store.test.ts`'s own fake port exactly — this item adds nothing to
 * `src/lib/secure-store/` (Resolution R1) and does not depend on item #19's unmerged
 * `testing/memory-secure-store.ts`. */
function createFakePort(initial: Record<string, string> = {}): SecureStorePort & { size: () => number } {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => Promise.resolve(store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    deleteItem: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    size: () => store.size,
  };
}

function countRows(db: AppDatabase, table: typeof transactions | typeof userFinancialProducts): number {
  return (db.select().from(table as never).all() as unknown[]).length;
}

/** Implementation plan (issue #20) Testing Strategy, Scenarios 5, 6, 8, 9. */
describe('disconnectBank (issue #20, Decisions 1-2)', () => {
  it('deletes the keychain entry, sets status disconnected, and leaves every product and transaction untouched (Scenario 5, brief AC2)', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const connectionId = createTestConnection(db, ports, 'banco-de-chile');
    const productId = createTestProduct(db, ports, connectionId);
    const now = ports.now();
    db.insert(transactions)
      .values({
        id: 'tx-1',
        userFinancialProductId: productId,
        externalId: 'ext-1',
        dedupHash: 'hash-1',
        amount: 1000,
        type: 'debit',
        occurredAt: now,
        dateLocal: '2026-02-01',
        rawDescription: 'Some purchase',
        isManual: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const secureStore = createFakePort({ 'bank_creds:banco-de-chile': JSON.stringify({ rut: 'x', password: 'y' }) });

    const productCountBefore = countRows(db, userFinancialProducts);
    const transactionCountBefore = countRows(db, transactions);

    const outcome = await disconnectBank(
      { db, secureStore },
      { connectionId, institutionId: 'banco-de-chile' },
    );

    const productCountAfter = countRows(db, userFinancialProducts);
    const transactionCountAfter = countRows(db, transactions);

    // eslint-disable-next-line no-console -- residual-verification evidence for the PR body
    console.log(
      `disconnect-bank.db.test: products ${productCountBefore} -> ${productCountAfter}, ` +
        `transactions ${transactionCountBefore} -> ${transactionCountAfter}`,
    );

    expect(outcome).toEqual({ status: 'disconnected' });
    expect(secureStore.size()).toBe(0);
    expect(productCountAfter).toBe(productCountBefore);
    expect(transactionCountAfter).toBe(transactionCountBefore);

    const connection = getConnection(db, connectionId);
    expect(connection?.status).toBe('disconnected');
    // credentials_key is left byte-identical (Decision 1's consequence).
    expect(connection?.credentialsKey).toBe(`secure-store-key-${connectionId}`);
  });

  it('a keychain delete failure leaves status untouched and returns stage "credential" (Scenario 6)', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const connectionId = createTestConnection(db, ports, 'banco-de-chile');
    const secureStore: SecureStorePort = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      deleteItem: () => Promise.reject(new Error('keychain unavailable')),
    };

    const outcome = await disconnectBank(
      { db, secureStore },
      { connectionId, institutionId: 'banco-de-chile' },
    );

    expect(outcome).toEqual({ status: 'failed', stage: 'credential' });
    expect(getConnection(db, connectionId)?.status).toBe('active');
  });

  it('disconnecting twice converges on the same state (Scenario 8 — idempotence)', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const connectionId = createTestConnection(db, ports, 'banco-de-chile');
    const secureStore = createFakePort({ 'bank_creds:banco-de-chile': 'x' });

    const first = await disconnectBank({ db, secureStore }, { connectionId, institutionId: 'banco-de-chile' });
    const second = await disconnectBank({ db, secureStore }, { connectionId, institutionId: 'banco-de-chile' });

    expect(first).toEqual({ status: 'disconnected' });
    expect(second).toEqual({ status: 'disconnected' });
    expect(getConnection(db, connectionId)?.status).toBe('disconnected');
  });

  it('a disconnected connection is never due for an automatic sync (Scenario 9)', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const connectionId = createTestConnection(db, ports, 'banco-de-chile');
    const secureStore = createFakePort({ 'bank_creds:banco-de-chile': 'x' });

    await disconnectBank({ db, secureStore }, { connectionId, institutionId: 'banco-de-chile' });

    const connection = getConnection(db, connectionId);
    expect(connection).toBeDefined();
    // `lastSyncAt`/`lastSuccessAt` both null → "never synced" would otherwise count as due; the
    // `status !== 'active'` branch must short-circuit before that check runs.
    expect(isDueForAutomaticSync(connection!, ports.now())).toBe(false);
  });
});
