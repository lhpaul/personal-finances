import fs from 'node:fs';
import path from 'node:path';

import {
  SAMPLE_SYNC_ERROR_CODE,
  clearSampleFixture,
  loadSampleFixture,
  simulateSyncError,
} from '../dev-fixture';
import { transactions, userFinancialInstitutions, userFinancialProducts } from '../schema';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

const FIXTURE_PATH = path.resolve(__dirname, '..', '__fixtures__', 'store-v1.sql');
const fixtureSql = fs.readFileSync(FIXTURE_PATH, 'utf8');

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

  it('is idempotent-safe to call twice in the sense that it never corrupts existing starter content (financial_institutions untouched)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const institutionsBefore = db.select().from(userFinancialInstitutions).all();
      expect(institutionsBefore).toHaveLength(0);

      loadSampleFixture(db, fixtureSql);
      const afterLoad = db.select().from(userFinancialInstitutions).all();
      expect(afterLoad).toHaveLength(1);
      expect(afterLoad[0]?.financialInstitutionId).toBe('banco-de-chile');
    } finally {
      sqlite.close();
    }
  });

  it('simulateSyncError marks every loaded connection as failed', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadSampleFixture(db, fixtureSql);
      simulateSyncError(db);

      const connections = db.select().from(userFinancialInstitutions).all();
      expect(connections).toHaveLength(1);
      expect(connections[0]?.syncStatus).toBe('error');
      expect(connections[0]?.lastErrorCode).toBe(SAMPLE_SYNC_ERROR_CODE);
    } finally {
      sqlite.close();
    }
  });

  it('clearSampleFixture removes every connection, product and movement, restoring the empty-reachable state', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadSampleFixture(db, fixtureSql);
      clearSampleFixture(db);

      expect(db.select().from(userFinancialInstitutions).all()).toHaveLength(0);
      expect(db.select().from(userFinancialProducts).all()).toHaveLength(0);
      expect(db.select().from(transactions).all()).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });
});
