import fs from 'node:fs';
import path from 'node:path';

import { isOnboardingCompleted } from '../repositories/settings';
import { listPendingBatch } from '../repositories/transactions';
import { applyFixtureSql, reclaimInstitutionRowForFixture, setOnboardingCompleted } from '../dev-e2e-fixture';
import { userFinancialInstitutions, transactions } from '../schema';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

const STAGE_QUEUE_PATH = path.resolve(__dirname, '..', '__fixtures__', 'stage-queue-v1.sql');
const stageQueueSql = fs.readFileSync(STAGE_QUEUE_PATH, 'utf8');

/**
 * Maestro E2E flows (implementation plan for issue #22, Implementation Order step 1). Exercises
 * `applyFixtureSql` and `setOnboardingCompleted` at the `src/db` tier, the same level
 * `dev-fixture.test.ts` exercises `loadSampleFixture` — no React, no panel.
 */
describe('dev-e2e-fixture', () => {
  it('applyFixtureSql applies stage-queue-v1.sql cleanly onto a bootstrapped store', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      applyFixtureSql(db, stageQueueSql);

      const batch = listPendingBatch(db, { limit: 10 });
      expect(batch.map((movement) => movement.id)).toEqual([
        'stage-tx-income',
        'stage-tx-expense',
        'stage-tx-nomerchant',
        'stage-tx-plain',
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('is idempotent: applying the same delta twice yields identical rows (D6)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      applyFixtureSql(db, stageQueueSql);
      const afterFirst = db.select().from(transactions).all();

      applyFixtureSql(db, stageQueueSql);
      const afterSecond = db.select().from(transactions).all();

      expect(afterSecond).toEqual(afterFirst);
    } finally {
      sqlite.close();
    }
  });

  it('never deletes a transactions row — a fixture id inserted before never disappears', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      applyFixtureSql(db, stageQueueSql);
      const idsAfterFirst = new Set(db.select().from(transactions).all().map((row) => row.id));

      applyFixtureSql(db, stageQueueSql);
      const idsAfterSecond = new Set(db.select().from(transactions).all().map((row) => row.id));

      for (const id of idsAfterFirst) {
        expect(idsAfterSecond.has(id)).toBe(true);
      }
    } finally {
      sqlite.close();
    }
  });

  it('reclaimInstitutionRowForFixture deletes another row for the same institution under a different id (found on device)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const now = new Date().toISOString();
      db.insert(userFinancialInstitutions)
        .values({
          id: 'scripted-read-owned-id',
          financialInstitutionId: 'banco-de-chile',
          status: 'active',
          credentialsKey: 'bank_creds:banco-de-chile',
          syncStatus: 'idle',
          createdAt: now,
        })
        .run();

      reclaimInstitutionRowForFixture(db, 'banco-de-chile', 'test-id-000002');

      const rows = db.select().from(userFinancialInstitutions).all();
      expect(rows).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });

  it('reclaimInstitutionRowForFixture never touches the fixture-owned row itself', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const now = new Date().toISOString();
      db.insert(userFinancialInstitutions)
        .values({
          id: 'test-id-000002',
          financialInstitutionId: 'banco-de-chile',
          status: 'active',
          credentialsKey: 'bank_creds:banco-de-chile',
          syncStatus: 'ok',
          createdAt: now,
        })
        .run();

      reclaimInstitutionRowForFixture(db, 'banco-de-chile', 'test-id-000002');

      const rows = db.select().from(userFinancialInstitutions).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('test-id-000002');
    } finally {
      sqlite.close();
    }
  });

  it('reclaimInstitutionRowForFixture never touches a different institution', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const now = new Date().toISOString();
      db.insert(userFinancialInstitutions)
        .values({
          id: 'santander-owned-id',
          financialInstitutionId: 'santander',
          status: 'active',
          credentialsKey: 'bank_creds:santander',
          syncStatus: 'idle',
          createdAt: now,
        })
        .run();

      reclaimInstitutionRowForFixture(db, 'banco-de-chile', 'test-id-000002');

      const rows = db.select().from(userFinancialInstitutions).all();
      expect(rows.map((row) => row.id)).toEqual(['santander-owned-id']);
    } finally {
      sqlite.close();
    }
  });

  it('setOnboardingCompleted(false) makes isOnboardingCompleted false, and (true) makes it true', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      setOnboardingCompleted(db, true);
      expect(isOnboardingCompleted(db)).toBe(true);

      setOnboardingCompleted(db, false);
      expect(isOnboardingCompleted(db)).toBe(false);
    } finally {
      sqlite.close();
    }
  });
});
