import fs from 'node:fs';
import path from 'node:path';

import { isOnboardingCompleted } from '../repositories/settings';
import { listPendingBatch } from '../repositories/transactions';
import { applyFixtureSql, setOnboardingCompleted } from '../dev-e2e-fixture';
import { transactions } from '../schema';
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
