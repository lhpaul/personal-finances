import fs from 'node:fs';
import path from 'node:path';

import { eq } from 'drizzle-orm';

import {
  SAMPLE_SYNC_ERROR_CODE,
  clearSampleFixture,
  loadSampleFixture,
  simulateSyncError,
} from '../dev-fixture';
import { transactions, userFinancialInstitutions, userFinancialProducts } from '../schema';
import type { AppDatabase } from '../types';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

const FIXTURE_PATH = path.resolve(__dirname, '..', '__fixtures__', 'store-v1.sql');
const fixtureSql = fs.readFileSync(FIXTURE_PATH, 'utf8');

const REAL_CONNECTION_ID = 'real-connection-not-a-fixture-id';
const REAL_PRODUCT_ID = 'real-product-not-a-fixture-id';

/**
 * Inserts a "real" (non-fixture-owned) connection and product with ids that deliberately do
 * **not** collide with `store-v1.sql`'s hardcoded `test-id-NNNNNN` ids. `openBootstrappedMemoryDb`'s
 * deterministic port counter (`src/db/testing/ports.ts`) starts from the same `test-id-000001`
 * sequence the committed fixture uses, so a real row created through the usual
 * `createTestConnection`/`ports.newId()` helper would land on the *same* id as a fixture row and
 * silently collide — a test-fixture artifact this suite must avoid, not a bug in
 * `dev-fixture.ts`.
 */
function insertRealConnectionAndProduct(db: AppDatabase, now: string): void {
  db.insert(userFinancialInstitutions)
    .values({
      id: REAL_CONNECTION_ID,
      financialInstitutionId: 'santander',
      status: 'active',
      credentialsKey: `secure-store-key-${REAL_CONNECTION_ID}`,
      syncStatus: 'idle',
      createdAt: now,
    })
    .run();
  db.insert(userFinancialProducts)
    .values({
      id: REAL_PRODUCT_ID,
      userFinancialInstitutionId: REAL_CONNECTION_ID,
      externalId: 'real-external-id',
      type: 'checking',
      name: 'Real account',
      updatedAt: now,
    })
    .run();
}

/** Home-screen implementation plan (issue #12) Decision 11 — the `__DEV__`-only sample-data
 * surface, exercised here at the `src/db` tier (its actual SQL execution) rather than through
 * the dev panel's React layer. */
describe('dev-fixture', () => {
  it('loadSampleFixture inserts only the connection/product/transaction rows onto an already-bootstrapped store, without violating any starter-catalogue key', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadSampleFixture(db, fixtureSql);

      expect(db.select().from(userFinancialInstitutions).all()).toHaveLength(1);
      expect(db.select().from(userFinancialProducts).all()).toHaveLength(2);
      expect(db.select().from(transactions).all()).toHaveLength(13);
    } finally {
      sqlite.close();
    }
  });

  it('is repeat-safe: loading the fixture a second time (the panel button tapped twice) leaves row counts and ids unchanged (found in review)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadSampleFixture(db, fixtureSql);
      const afterFirstLoad = {
        institutions: db.select().from(userFinancialInstitutions).all(),
        products: db.select().from(userFinancialProducts).all(),
        transactions: db.select().from(transactions).all(),
      };

      loadSampleFixture(db, fixtureSql); // must not throw a primary/unique-key violation

      expect(db.select().from(userFinancialInstitutions).all()).toEqual(afterFirstLoad.institutions);
      expect(db.select().from(userFinancialProducts).all()).toEqual(afterFirstLoad.products);
      expect(db.select().from(transactions).all()).toEqual(afterFirstLoad.transactions);
    } finally {
      sqlite.close();
    }
  });

  it('simulateSyncError marks only the fixture-owned connection as failed, never a real one (found in review)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      insertRealConnectionAndProduct(db, ports.now());
      loadSampleFixture(db, fixtureSql);

      simulateSyncError(db, fixtureSql);

      const fixtureConnection = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.financialInstitutionId, 'banco-de-chile'))
        .get();
      expect(fixtureConnection?.syncStatus).toBe('error');
      expect(fixtureConnection?.lastErrorCode).toBe(SAMPLE_SYNC_ERROR_CODE);

      const realConnection = db
        .select()
        .from(userFinancialInstitutions)
        .where(eq(userFinancialInstitutions.id, REAL_CONNECTION_ID))
        .get();
      expect(realConnection?.syncStatus).toBe('idle'); // untouched
      expect(realConnection?.lastErrorCode).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('clearSampleFixture removes only the fixture-owned connection, product and movements, restoring the empty-reachable state', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadSampleFixture(db, fixtureSql);
      clearSampleFixture(db, fixtureSql);

      expect(db.select().from(userFinancialInstitutions).all()).toHaveLength(0);
      expect(db.select().from(userFinancialProducts).all()).toHaveLength(0);
      expect(db.select().from(transactions).all()).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });

  it('clearSampleFixture retains a real connection, product and movement alongside the loaded sample data (found in review, Non-negotiable 3)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const now = ports.now();
      insertRealConnectionAndProduct(db, now);
      db.insert(transactions)
        .values({
          id: 'real-movement',
          userFinancialProductId: REAL_PRODUCT_ID,
          externalId: null,
          dedupHash: 'real-movement-dedup',
          amount: 1000,
          type: 'debit',
          occurredAt: now,
          dateLocal: '2026-02-01',
          rawDescription: 'Real movement, not a fixture row',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      loadSampleFixture(db, fixtureSql);
      clearSampleFixture(db, fixtureSql);

      expect(
        db.select().from(userFinancialInstitutions).where(eq(userFinancialInstitutions.id, REAL_CONNECTION_ID)).get(),
      ).toBeDefined();
      expect(
        db.select().from(userFinancialProducts).where(eq(userFinancialProducts.id, REAL_PRODUCT_ID)).get(),
      ).toBeDefined();
      expect(db.select().from(transactions).where(eq(transactions.id, 'real-movement')).get()).toBeDefined();
    } finally {
      sqlite.close();
    }
  });
});
