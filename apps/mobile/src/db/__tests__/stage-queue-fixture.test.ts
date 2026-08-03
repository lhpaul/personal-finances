import path from 'node:path';

import { listPendingBatch } from '../repositories/transactions';
import { loadFixture } from '../testing/load-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/**
 * Categorization flow (#13) implementation plan Testing Strategy, Scenario 12 (Decision 15): the
 * committed delta fixture applies cleanly on top of a bootstrapped store and yields exactly the
 * four expected pending movements in the expected order.
 */
const FIXTURE_PATH = path.resolve(__dirname, '..', '__fixtures__', 'stage-queue-v1.sql');

describe('stage-queue-v1.sql fixture (Decision 15)', () => {
  it('applies cleanly on top of a bootstrapped store and re-applies idempotently', async () => {
    const { sqlite } = await openBootstrappedMemoryDb();
    try {
      expect(() => loadFixture(sqlite, FIXTURE_PATH)).not.toThrow();
      expect(() => loadFixture(sqlite, FIXTURE_PATH)).not.toThrow();
    } finally {
      sqlite.close();
    }
  });

  it('yields exactly the four expected pending movements, most recent first', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadFixture(sqlite, FIXTURE_PATH);

      const batch = listPendingBatch(db, { limit: 10 });
      expect(batch.map((m) => m.id)).toEqual([
        'stage-tx-income',
        'stage-tx-expense',
        'stage-tx-nomerchant',
        'stage-tx-plain',
      ]);
      expect(batch.map((m) => m.type)).toEqual(['credit', 'debit', 'debit', 'debit']);
    } finally {
      sqlite.close();
    }
  });
});
