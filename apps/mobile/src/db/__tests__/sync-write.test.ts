import { applySyncWrite, type SyncMovementInput } from '../repositories/sync';
import { getConnection } from '../repositories/institutions';
import { MovementValidationError } from '../repositories/transactions';
import type { BankProductInput } from '../repositories/products';
import { transactions, userFinancialProducts } from '../schema';
import { createTestConnection } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/**
 * `applySyncWrite` (implementation plan Decision 5, issue #10): the whole sync write, atomicity
 * and rollback. Spec Business Rule 21; AC9, AC14, AC15.
 */

function fullDump(db: Awaited<ReturnType<typeof openBootstrappedMemoryDb>>['db']) {
  return {
    products: db.select().from(userFinancialProducts).all(),
    transactions: db.select().from(transactions).all(),
  };
}

const productA: BankProductInput = {
  externalId: 'instance-a',
  type: 'checking',
  name: 'Cuenta Corriente',
  currencyCode: 'CLP',
};

function movementsFor(productExternalId: string): SyncMovementInput[] {
  return [
    {
      productExternalId,
      amount: 4200,
      type: 'debit',
      occurredAt: '2026-05-01T12:00:00.000Z',
      dateLocal: '2026-05-01',
      rawDescription: 'LIDER',
    },
    {
      productExternalId,
      amount: 15000,
      type: 'debit',
      occurredAt: '2026-05-02T12:00:00.000Z',
      dateLocal: '2026-05-02',
      rawDescription: 'JUMBO',
    },
  ];
}

describe('applySyncWrite atomicity (Business Rule 21, AC9, AC14, AC15)', () => {
  it('a failed read (no products, no movements) stores nothing, and a store populated by an earlier successful read is byte-identical afterwards (AC9)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);

      await applySyncWrite(db, ports, {
        userFinancialInstitutionId: connectionId,
        products: [productA],
        movements: movementsFor('instance-a'),
        connectionRecord: { outcome: 'complete' },
      });

      const before = fullDump(db);
      expect(before.products).toHaveLength(1);
      expect(before.transactions).toHaveLength(2);

      await applySyncWrite(db, ports, {
        userFinancialInstitutionId: connectionId,
        products: [],
        movements: [],
        connectionRecord: {
          outcome: 'failed',
          errorCode: 'invalid_credentials',
          errorMessage: 'sync.errors.invalid_credentials',
        },
      });

      const after = fullDump(db);
      expect(after.products).toEqual(before.products);
      expect(after.transactions).toEqual(before.transactions);

      const connection = getConnection(db, connectionId);
      expect(connection?.syncStatus).toBe('error');
      expect(connection?.lastErrorCode).toBe('invalid_credentials');
    } finally {
      sqlite.close();
    }
  });

  it('a driver failure partway through Phase B rolls back the whole transaction — no product, no movement, no connection column changed (AC14)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);

      // Rig newId so the batch's two movement rows collide on `transactions.id` (its primary
      // key). The first row's INSERT succeeds inside the transaction; the second's throws a real
      // SQLite UNIQUE-constraint violation — a genuine driver failure, not a mocked one — which
      // must roll back everything already written in the same transaction, including the
      // product insert that ran before it and the connection-record write that would have run
      // after it.
      let idCallCount = 0;
      const collidingPorts = {
        ...ports,
        newId: () => {
          idCallCount += 1;
          // Call 1 -> the product's id. Calls 2 and 3 -> both movements; forcing them equal
          // collides the two inserts.
          if (idCallCount === 1) return 'reserved-product-id';
          return 'colliding-movement-id';
        },
      };

      const before = fullDump(db);
      const connectionBefore = getConnection(db, connectionId);

      await expect(
        applySyncWrite(db, collidingPorts, {
          userFinancialInstitutionId: connectionId,
          products: [productA],
          movements: movementsFor('instance-a'),
          connectionRecord: { outcome: 'complete' },
        }),
      ).rejects.toThrow();

      const after = fullDump(db);
      expect(after.products).toEqual(before.products);
      expect(after.transactions).toEqual(before.transactions);
      expect(getConnection(db, connectionId)).toEqual(connectionBefore);
    } finally {
      sqlite.close();
    }
  });

  it('a rejected amount throws MovementValidationError before Phase B opens — the store is untouched (AC15)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const before = fullDump(db);

      await expect(
        applySyncWrite(db, ports, {
          userFinancialInstitutionId: connectionId,
          products: [productA],
          movements: [
            {
              productExternalId: 'instance-a',
              amount: -1,
              type: 'debit',
              occurredAt: '2026-05-03T12:00:00.000Z',
              dateLocal: '2026-05-03',
              rawDescription: 'BAD',
            },
          ],
          connectionRecord: { outcome: 'complete' },
        }),
      ).rejects.toBeInstanceOf(MovementValidationError);

      expect(fullDump(db)).toEqual(before);
    } finally {
      sqlite.close();
    }
  });

  it('a movement whose product resolves to neither a read product nor a stored one is the same structural defect (Decision 6, Assumption A5)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const before = fullDump(db);

      await expect(
        applySyncWrite(db, ports, {
          userFinancialInstitutionId: connectionId,
          products: [], // the read reports no products at all
          movements: movementsFor('instance-does-not-exist'),
          connectionRecord: { outcome: 'complete' },
        }),
      ).rejects.toBeInstanceOf(MovementValidationError);

      expect(fullDump(db)).toEqual(before);
    } finally {
      sqlite.close();
    }
  });

  it('a successful write reports accurate counts', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);

      const first = await applySyncWrite(db, ports, {
        userFinancialInstitutionId: connectionId,
        products: [productA],
        movements: movementsFor('instance-a'),
        connectionRecord: { outcome: 'complete' },
      });
      expect(first).toEqual({ discovered: 1, refreshed: 0, movementsStored: 2, movementsAlreadyKnown: 0 });

      const second = await applySyncWrite(db, ports, {
        userFinancialInstitutionId: connectionId,
        products: [productA],
        movements: movementsFor('instance-a'),
        connectionRecord: { outcome: 'complete' },
      });
      expect(second).toEqual({ discovered: 0, refreshed: 1, movementsStored: 0, movementsAlreadyKnown: 2 });
    } finally {
      sqlite.close();
    }
  });
});
