import { eq } from 'drizzle-orm';

import fixtureWithIds from '../__fixtures__/bank-response-with-ids.json';
import fixtureWithoutIds from '../__fixtures__/bank-response-without-ids.json';
import type { BankTransactionInput } from '../repositories/transactions';
import {
  countCategorized,
  countUncategorized,
  excludeTransaction,
  listPendingBatch,
  listRecentMovements,
  setReviewFlag,
  setUserCategory,
  sumIncludedByDirectionAndCategory,
  sumIncludedByDirectionAndDay,
  sumIncludedExpensesInPeriod,
  totalForCategoryInPeriod,
  upsertBankTransactions,
} from '../repositories/transactions';
import { transactions } from '../schema';
import { createTestConnection, createTestProduct } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/**
 * Scenarios 4 (negative-amount rejection), 6, 7 and 20 (result-level `totalForCategoryInPeriod` /
 * `countUncategorized`), per the Testing Strategy's test-file table.
 */

interface Fixture {
  productA: { run1: BankTransactionInput[]; run2: BankTransactionInput[] };
  productB: { run1: BankTransactionInput[]; run2: BankTransactionInput[] };
}

const withIds = fixtureWithIds as unknown as Fixture;
const withoutIds = fixtureWithoutIds as unknown as Fixture;

describe('transactions repository', () => {
  it('rejects a negative amount before any row is written (Business Rule 4, AC4)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);

      const before = db.select().from(transactions).all().length;

      await expect(
        upsertBankTransactions(
          db,
          productId,
          [
            {
              externalId: 'ext-negative',
              amount: -1000,
              type: 'debit',
              occurredAt: '2026-02-01T12:00:00.000Z',
              dateLocal: '2026-02-01',
              rawDescription: 'BAD ROW',
            },
          ],
          ports,
        ),
      ).rejects.toThrow();

      expect(db.select().from(transactions).all()).toHaveLength(before);
    } finally {
      sqlite.close();
    }
  });

  it('replaying the same recorded bank response twice leaves the row count unchanged — with external ids (AC6)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productA = createTestProduct(db, ports, connectionId, { externalId: 'acct-a' });

      await upsertBankTransactions(db, productA, withIds.productA.run1, ports);
      const afterFirst = db.select().from(transactions).all().length;
      expect(afterFirst).toBe(withIds.productA.run1.length);

      await upsertBankTransactions(db, productA, withIds.productA.run1, ports);
      const afterSecond = db.select().from(transactions).all().length;
      expect(afterSecond).toBe(afterFirst);

      // Decision 14: two movements identical in product, day, amount and description, but with
      // different external ids, must both survive as distinct rows.
      const feb1Lider = db
        .select()
        .from(transactions)
        .where(eq(transactions.dateLocal, '2026-02-01'))
        .all();
      expect(feb1Lider).toHaveLength(2);
      expect(new Set(feb1Lider.map((r) => r.externalId))).toEqual(new Set(['ext-a-1', 'ext-a-2']));
    } finally {
      sqlite.close();
    }
  });

  it('replaying the same recorded bank response twice leaves the row count unchanged — without external ids (AC6)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productA = createTestProduct(db, ports, connectionId, { externalId: 'acct-a' });

      await upsertBankTransactions(db, productA, withoutIds.productA.run1, ports);
      const afterFirst = db.select().from(transactions).all().length;
      expect(afterFirst).toBe(withoutIds.productA.run1.length);

      await upsertBankTransactions(db, productA, withoutIds.productA.run1, ports);
      const afterSecond = db.select().from(transactions).all().length;
      expect(afterSecond).toBe(afterFirst);
    } finally {
      sqlite.close();
    }
  });

  it(
    'a replay refreshes only bank-owned columns; every person-owned column is byte-identical afterwards (Business Rule 8, AC7)',
    async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productA = createTestProduct(db, ports, connectionId, { externalId: 'acct-a' });

        await upsertBankTransactions(db, productA, withIds.productA.run1, ports);

        const target = db
          .select()
          .from(transactions)
          .where(eq(transactions.externalId, 'ext-a-1'))
          .get();
        expect(target).toBeDefined();

        // The person categorized, noted, review-flagged, excluded (with reason and note) and
        // partially included this movement, and it is marked manual — all nine person-owned
        // columns plus `is_manual`, set to values a bank re-store must never touch.
        db.update(transactions)
          .set({
            transactionCategoryId: 'supermercado',
            categorySource: 'user',
            note: 'Compra semanal',
            reviewFlag: 'review_later',
            excludedAt: '2026-02-10T00:00:00.000Z',
            exclusionReason: 'shared_expense',
            exclusionNote: 'Compartido con mi pareja',
            includedAmount: 2100,
            merchantId: 'lider',
            isManual: 1,
          })
          .where(eq(transactions.externalId, 'ext-a-1'))
          .run();

        const personOwnedBefore = db
          .select()
          .from(transactions)
          .where(eq(transactions.externalId, 'ext-a-1'))
          .get();

        await upsertBankTransactions(db, productA, withIds.productA.run2, ports);

        const afterReplay = db
          .select()
          .from(transactions)
          .where(eq(transactions.externalId, 'ext-a-1'))
          .get();
        expect(afterReplay).toBeDefined();

        // Bank-owned columns refreshed to run2's values.
        expect(afterReplay?.amount).toBe(4300);
        expect(afterReplay?.rawDescription).toBe('LIDER SUPERMERCADO');
        expect(afterReplay?.type).toBe('debit');
        expect(afterReplay?.occurredAt).toBe('2026-02-01T12:00:00.000Z');
        expect(afterReplay?.dateLocal).toBe('2026-02-01');

        // Every person-owned column byte-identical.
        expect(afterReplay?.transactionCategoryId).toBe(personOwnedBefore?.transactionCategoryId);
        expect(afterReplay?.categorySource).toBe(personOwnedBefore?.categorySource);
        expect(afterReplay?.note).toBe(personOwnedBefore?.note);
        expect(afterReplay?.reviewFlag).toBe(personOwnedBefore?.reviewFlag);
        expect(afterReplay?.excludedAt).toBe(personOwnedBefore?.excludedAt);
        expect(afterReplay?.exclusionReason).toBe(personOwnedBefore?.exclusionReason);
        expect(afterReplay?.exclusionNote).toBe(personOwnedBefore?.exclusionNote);
        expect(afterReplay?.includedAmount).toBe(personOwnedBefore?.includedAmount);
        expect(afterReplay?.merchantId).toBe(personOwnedBefore?.merchantId);
        expect(afterReplay?.isManual).toBe(personOwnedBefore?.isManual);
      } finally {
        sqlite.close();
      }
    },
  );

  it(
    'totalForCategoryInPeriod sums full and partial movements and excludes an excluded one — exact value, not merely "reads through the fragment" (AC20)',
    async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();

        db.insert(transactions)
          .values([
            {
              id: 'gate1-full',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'gate1-dedup-full',
              amount: 42000,
              type: 'debit',
              occurredAt: '2026-02-05T12:00:00.000Z',
              dateLocal: '2026-02-05',
              rawDescription: 'Full movement',
              transactionCategoryId: 'comida',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'gate1-partial',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'gate1-dedup-partial',
              amount: 42000,
              includedAmount: 21000,
              type: 'debit',
              occurredAt: '2026-02-06T12:00:00.000Z',
              dateLocal: '2026-02-06',
              rawDescription: 'Partially included movement',
              transactionCategoryId: 'comida',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'gate1-excluded',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'gate1-dedup-excluded',
              amount: 15000,
              type: 'debit',
              occurredAt: '2026-02-07T12:00:00.000Z',
              dateLocal: '2026-02-07',
              rawDescription: 'Excluded movement',
              transactionCategoryId: 'comida',
              excludedAt: '2026-02-07T13:00:00.000Z',
              exclusionReason: 'not_relevant',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        const total = totalForCategoryInPeriod(db, 'comida', {
          startDateLocal: '2026-02-01',
          endDateLocal: '2026-02-28',
        });
        expect(total).toBe(63000); // 42000 (full) + 21000 (partial); the excluded 15000 is absent.
      } finally {
        sqlite.close();
      }
    },
  );

  it(
    'countUncategorized returns the exact number of uncategorized, non-excluded movements, unaffected by categorized or excluded rows in the same fixture (AC20)',
    async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();

        db.insert(transactions)
          .values([
            // Two uncategorized, not-excluded movements — the count this test expects.
            {
              id: 'gate1-uncat-1',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'gate1-dedup-uncat-1',
              amount: 1000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-08',
              rawDescription: 'Uncategorized 1',
              transactionCategoryId: null,
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'gate1-uncat-2',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'gate1-dedup-uncat-2',
              amount: 2000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-09',
              rawDescription: 'Uncategorized 2',
              transactionCategoryId: null,
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            // Categorized — must not count.
            {
              id: 'gate1-cat',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'gate1-dedup-cat',
              amount: 3000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-10',
              rawDescription: 'Categorized',
              transactionCategoryId: 'comida',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            // Uncategorized but excluded — must not count.
            {
              id: 'gate1-uncat-excluded',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'gate1-dedup-uncat-excluded',
              amount: 4000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-11',
              rawDescription: 'Uncategorized but excluded',
              transactionCategoryId: null,
              excludedAt: now,
              exclusionReason: 'cash_withdrawal',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        expect(countUncategorized(db)).toBe(2);
      } finally {
        sqlite.close();
      }
    },
  );

  /**
   * Home-screen implementation plan (issue #12) Scenarios 2-6: the two new aggregates and
   * `listRecentMovements`, all reading through the shared fragments.
   */
  describe('sumIncludedByDirectionAndCategory / sumIncludedByDirectionAndDay / listRecentMovements (issue #12)', () => {
    it('sumIncludedByDirectionAndCategory sums full and partial movements, excludes an excluded one, and keeps the null-category bucket (Scenarios 2, 4)', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();

        db.insert(transactions)
          .values([
            {
              id: 'p12-full',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-dedup-full',
              amount: 42000,
              type: 'debit',
              occurredAt: '2026-02-05T12:00:00.000Z',
              dateLocal: '2026-02-05',
              rawDescription: 'Full movement',
              transactionCategoryId: 'comida',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-partial',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-dedup-partial',
              amount: 42000,
              includedAmount: 21000,
              type: 'debit',
              occurredAt: '2026-02-06T12:00:00.000Z',
              dateLocal: '2026-02-06',
              rawDescription: 'Partially included movement',
              transactionCategoryId: 'comida',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-excluded',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-dedup-excluded',
              amount: 15000,
              type: 'debit',
              occurredAt: '2026-02-07T12:00:00.000Z',
              dateLocal: '2026-02-07',
              rawDescription: 'Excluded movement',
              transactionCategoryId: 'comida',
              excludedAt: '2026-02-07T13:00:00.000Z',
              exclusionReason: 'not_relevant',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-uncategorized',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-dedup-uncategorized',
              amount: 5000,
              type: 'debit',
              occurredAt: '2026-02-08T12:00:00.000Z',
              dateLocal: '2026-02-08',
              rawDescription: 'Uncategorized movement',
              transactionCategoryId: null,
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        const period = { startDateLocal: '2026-02-01', endDateLocal: '2026-02-28' };
        const totals = sumIncludedByDirectionAndCategory(db, period);

        const comida = totals.find((row) => row.transactionCategoryId === 'comida');
        expect(comida).toEqual({
          type: 'debit',
          transactionCategoryId: 'comida',
          total: 63000, // 42000 (full) + 21000 (partial); the excluded 15000 is absent.
          movementCount: 2,
        });

        // The "Sin categorizar" bucket is returned, not dropped (item #5 Decision 10).
        const uncategorized = totals.find((row) => row.transactionCategoryId === null);
        expect(uncategorized).toEqual({
          type: 'debit',
          transactionCategoryId: null,
          total: 5000,
          movementCount: 1,
        });

        // Equivalence check against the existing per-category aggregate (Scenario 3, brief AC3):
        // both must agree with each other, and both already agree with the hand-derived literal
        // above, so this is not two implementations agreeing about a shared mistake.
        expect(comida?.total).toBe(totalForCategoryInPeriod(db, 'comida', period));
      } finally {
        sqlite.close();
      }
    });

    it('sumIncludedByDirectionAndDay buckets by date_local and excludes movements outside the period (Scenario 5)', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();

        db.insert(transactions)
          .values([
            {
              id: 'p12-day-before',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-day-before',
              amount: 1000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-01-31', // the day before period.start
              rawDescription: 'Before period',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-day-in',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-day-in',
              amount: 2000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-05',
              rawDescription: 'Inside period',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-day-start',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-day-start',
              amount: 4000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-01', // exactly period.start, inclusive
              rawDescription: 'On start boundary',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-day-end',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-day-end',
              amount: 5000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-28', // exactly period.end, inclusive
              rawDescription: 'On end boundary',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-day-after',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-day-after',
              amount: 3000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-03-01', // the day after period.end
              rawDescription: 'After period',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        const rows = sumIncludedByDirectionAndDay(db, {
          startDateLocal: '2026-02-01',
          endDateLocal: '2026-02-28',
        });

        expect(rows).toEqual([
          { dateLocal: '2026-02-01', type: 'debit', total: 4000 },
          { dateLocal: '2026-02-05', type: 'debit', total: 2000 },
          { dateLocal: '2026-02-28', type: 'debit', total: 5000 },
        ]);
      } finally {
        sqlite.close();
      }
    });

    it('listRecentMovements respects limit, orders by date_local descending, resolves labels, and includes an excluded movement (Scenario 6, Assumption A8)', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();

        db.insert(transactions)
          .values([
            {
              id: 'p12-recent-1',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-recent-1',
              amount: 35000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-24',
              rawDescription: 'LIDER SUPERMERCADO',
              merchantId: 'lider',
              transactionCategoryId: 'comida',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-recent-2-excluded',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-recent-2',
              amount: 42000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-26',
              rawDescription: 'MERCADOLIBRE CHILE',
              transactionCategoryId: null,
              excludedAt: now,
              exclusionReason: 'not_relevant',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-recent-3-newest',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-recent-3',
              amount: 1200000,
              type: 'credit',
              occurredAt: now,
              dateLocal: '2026-02-27',
              rawDescription: 'CONSULTORIA DIGITAL SPA',
              transactionCategoryId: null,
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'p12-recent-4-oldest',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'p12-recent-4',
              amount: 1000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-02-01',
              rawDescription: 'Older movement',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        const rows = listRecentMovements(db, { limit: 3, locale: 'es' });

        expect(rows).toHaveLength(3); // limit respected, the oldest movement is dropped
        expect(rows.map((row) => row.id)).toEqual([
          'p12-recent-3-newest',
          'p12-recent-2-excluded',
          'p12-recent-1',
        ]);

        const excludedRow = rows.find((row) => row.id === 'p12-recent-2-excluded');
        expect(excludedRow?.excluded).toBe(true); // present, not filtered out (Assumption A8)

        const merchantRow = rows.find((row) => row.id === 'p12-recent-1');
        expect(merchantRow?.merchantName).toBe('Líder');
        expect(merchantRow?.categoryName).toBe('Comida');
        // The seeded 'lider' merchant carries no `assets` — falls back to `undefined`, not a
        // crash on a missing key (Assumption A9's merchant -> category -> default emoji chain).
        expect(merchantRow?.merchantEmoji).toBeUndefined();
        expect(typeof merchantRow?.categoryEmoji).toBe('string');

        const unlinkedRow = rows.find((row) => row.id === 'p12-recent-3-newest');
        expect(unlinkedRow?.merchantName).toBeUndefined();
        expect(unlinkedRow?.categoryName).toBeUndefined();
      } finally {
        sqlite.close();
      }
    });
  });
});

/**
 * Categorization flow (#13) implementation plan Testing Strategy, Scenarios 1-9.
 */
describe('categorization repository functions (#13)', () => {
  function insertTransaction(
    db: Awaited<ReturnType<typeof openBootstrappedMemoryDb>>['db'],
    productId: string,
    overrides: Partial<typeof transactions.$inferInsert> & { id: string },
    now: string,
  ) {
    db.insert(transactions)
      .values({
        userFinancialProductId: productId,
        externalId: null,
        dedupHash: `dedup-${overrides.id}`,
        amount: 1000,
        type: 'debit',
        occurredAt: now,
        dateLocal: '2026-02-01',
        rawDescription: 'Movement',
        isManual: 0,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      })
      .run();
  }

  it('listPendingBatch returns only movements with no category that are not excluded, newest first, tie-broken by occurred_at then id, capped at the limit (AC2, AC4, BR11)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      insertTransaction(db, productId, { id: 'p-oldest', dateLocal: '2026-02-01', occurredAt: '2026-02-01T10:00:00.000Z' }, now);
      insertTransaction(db, productId, { id: 'p-newest', dateLocal: '2026-02-03', occurredAt: '2026-02-03T10:00:00.000Z' }, now);
      insertTransaction(db, productId, { id: 'p-tie-a', dateLocal: '2026-02-02', occurredAt: '2026-02-02T10:00:00.000Z' }, now);
      insertTransaction(db, productId, { id: 'p-tie-b', dateLocal: '2026-02-02', occurredAt: '2026-02-02T10:00:00.000Z' }, now);
      insertTransaction(db, productId, { id: 'p-categorized', dateLocal: '2026-02-04', transactionCategoryId: 'comida' }, now);
      insertTransaction(db, productId, { id: 'p-excluded', dateLocal: '2026-02-04', excludedAt: now, exclusionReason: 'other' }, now);

      const batch = listPendingBatch(db, { limit: 10 });
      expect(batch.map((m) => m.id)).toEqual(['p-newest', 'p-tie-a', 'p-tie-b', 'p-oldest']);
    } finally {
      sqlite.close();
    }
  });

  it('listPendingBatch with fewer pending than the limit returns the whole queue (A14)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'only-one' }, now);

      const batch = listPendingBatch(db, { limit: 10 });
      expect(batch).toHaveLength(1);
      expect(batch[0]?.id).toBe('only-one');
    } finally {
      sqlite.close();
    }
  });

  it('listPendingBatch resolves the merchant, or null when none matched (A8)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'with-merchant', merchantId: 'lider' }, now);
      insertTransaction(db, productId, { id: 'without-merchant', dateLocal: '2026-01-01' }, now);

      const batch = listPendingBatch(db, { limit: 10 });
      const withMerchant = batch.find((m) => m.id === 'with-merchant');
      const withoutMerchant = batch.find((m) => m.id === 'without-merchant');
      expect(withMerchant?.merchant).toEqual({
        id: 'lider',
        name: 'Líder',
        transactionCategoryId: 'supermercado',
        isUserDefined: false,
      });
      expect(withoutMerchant?.merchant).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('setUserCategory writes the category and category_source = user, clears review_flag, and never touches a pre-existing exclusion timestamp or partial-inclusion amount (AC10, AC22, AC24)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      // Seed opposing field states — a row that is *already* excluded and partially included —
      // so the assertions below prove `setUserCategory`'s `set` object omits these columns
      // entirely, rather than merely observing their default-null starting value.
      insertTransaction(
        db,
        productId,
        {
          id: 'to-categorize',
          reviewFlag: 'review_later',
          excludedAt: '2026-01-01T00:00:00.000Z',
          exclusionReason: 'other',
          includedAmount: 500,
        },
        now,
      );

      setUserCategory(db, 'to-categorize', 'comida', ports);

      const row = db.select().from(transactions).where(eq(transactions.id, 'to-categorize')).get();
      expect(row?.transactionCategoryId).toBe('comida');
      expect(row?.categorySource).toBe('user');
      expect(row?.reviewFlag).toBeNull();
      expect(row?.excludedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(row?.exclusionReason).toBe('other');
      expect(row?.includedAmount).toBe(500);
    } finally {
      sqlite.close();
    }
  });

  it('after setUserCategory, countUncategorized drops by one (AC10, AC11)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'to-categorize-2' }, now);

      const before = countUncategorized(db);
      setUserCategory(db, 'to-categorize-2', 'comida', ports);
      expect(countUncategorized(db)).toBe(before - 1);
    } finally {
      sqlite.close();
    }
  });

  it('setReviewFlag writes the mark, writes no category, and the movement is still pending (AC14, AC15)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'to-defer' }, now);

      const before = countUncategorized(db);
      setReviewFlag(db, 'to-defer', 'review_later', ports);

      const row = db.select().from(transactions).where(eq(transactions.id, 'to-defer')).get();
      expect(row?.reviewFlag).toBe('review_later');
      expect(row?.transactionCategoryId).toBeNull();
      expect(countUncategorized(db)).toBe(before);

      setReviewFlag(db, 'to-defer', 'uncertain', ports);
      const updated = db.select().from(transactions).where(eq(transactions.id, 'to-defer')).get();
      expect(updated?.reviewFlag).toBe('uncertain');
    } finally {
      sqlite.close();
    }
  });

  it('excludeTransaction writes the exclusion timestamp, the reason and the note; a blank note is stored as null; the row still exists, is still selectable, and its category is never touched (AC19, AC21)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      // Seed an already-categorized-by-hand row — the opposing field state — so the assertions
      // below prove `excludeTransaction`'s `set` object omits `transactionCategoryId` and
      // `categorySource` entirely, rather than merely observing their default-null value.
      insertTransaction(
        db,
        productId,
        { id: 'to-exclude', transactionCategoryId: 'comida', categorySource: 'user' },
        now,
      );
      insertTransaction(db, productId, { id: 'to-exclude-blank-note' }, now);

      excludeTransaction(db, 'to-exclude', { reason: 'shared_expense', note: '  Compartido  ' }, ports);
      const row = db.select().from(transactions).where(eq(transactions.id, 'to-exclude')).get();
      expect(row?.excludedAt).not.toBeNull();
      expect(row?.exclusionReason).toBe('shared_expense');
      expect(row?.exclusionNote).toBe('Compartido');
      expect(row?.transactionCategoryId).toBe('comida');
      expect(row?.categorySource).toBe('user');

      excludeTransaction(db, 'to-exclude-blank-note', { reason: 'other', note: '   ' }, ports);
      const blankRow = db
        .select()
        .from(transactions)
        .where(eq(transactions.id, 'to-exclude-blank-note'))
        .get();
      expect(blankRow?.exclusionNote).toBeNull();

      expect(db.select().from(transactions).where(eq(transactions.id, 'to-exclude')).all()).toHaveLength(1);
    } finally {
      sqlite.close();
    }
  });

  it('an excluded movement leaves sumIncludedExpensesInPeriod and totalForCategoryInPeriod (AC20)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, {
        id: 'included',
        amount: 20000,
        transactionCategoryId: 'comida',
        dateLocal: '2026-02-10',
      }, now);
      insertTransaction(db, productId, {
        id: 'excluded-before',
        amount: 30000,
        transactionCategoryId: 'comida',
        dateLocal: '2026-02-11',
      }, now);

      const period = { startDateLocal: '2026-02-01', endDateLocal: '2026-02-28' };
      const before = sumIncludedExpensesInPeriod(db, period);
      expect(before).toBe(50000);

      excludeTransaction(db, 'excluded-before', { reason: 'not_relevant' }, ports);

      expect(sumIncludedExpensesInPeriod(db, period)).toBe(20000);
      expect(totalForCategoryInPeriod(db, 'comida', period)).toBe(20000);
    } finally {
      sqlite.close();
    }
  });

  it('excludeTransaction never writes a partial-inclusion amount (AC22, AC24)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'never-partial' }, now);

      excludeTransaction(db, 'never-partial', { reason: 'cash_withdrawal' }, ports);

      const row = db.select().from(transactions).where(eq(transactions.id, 'never-partial')).get();
      expect(row?.includedAmount).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('countCategorized counts every movement with a category, whether or not it is later excluded (A6, P4)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      const before = countCategorized(db);
      insertTransaction(db, productId, { id: 'categorized-then-excluded', transactionCategoryId: 'comida' }, now);

      expect(countCategorized(db)).toBe(before + 1);

      excludeTransaction(db, 'categorized-then-excluded', { reason: 'other' }, ports);
      expect(countCategorized(db)).toBe(before + 1);
    } finally {
      sqlite.close();
    }
  });

  it('a simulated re-sync (upsertBankTransactions) over a categorized and an excluded movement preserves both decisions (#10 seam)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId, { externalId: 'resync-acct' });

      await upsertBankTransactions(
        db,
        productId,
        [
          {
            externalId: 'resync-categorized',
            amount: 5000,
            type: 'debit',
            occurredAt: '2026-02-01T12:00:00.000Z',
            dateLocal: '2026-02-01',
            rawDescription: 'CAFE CENTRAL',
          },
          {
            externalId: 'resync-excluded',
            amount: 8000,
            type: 'debit',
            occurredAt: '2026-02-02T12:00:00.000Z',
            dateLocal: '2026-02-02',
            rawDescription: 'GIRO CAJERO',
          },
        ],
        ports,
      );

      const categorized = db.select().from(transactions).where(eq(transactions.externalId, 'resync-categorized')).get();
      const excluded = db.select().from(transactions).where(eq(transactions.externalId, 'resync-excluded')).get();
      if (!categorized || !excluded) throw new Error('fixture rows missing');

      setUserCategory(db, categorized.id, 'comida', ports);
      excludeTransaction(db, excluded.id, { reason: 'cash_withdrawal' }, ports);

      // Re-sync: the exact same bank response, replayed.
      await upsertBankTransactions(
        db,
        productId,
        [
          {
            externalId: 'resync-categorized',
            amount: 5000,
            type: 'debit',
            occurredAt: '2026-02-01T12:00:00.000Z',
            dateLocal: '2026-02-01',
            rawDescription: 'CAFE CENTRAL',
          },
          {
            externalId: 'resync-excluded',
            amount: 8000,
            type: 'debit',
            occurredAt: '2026-02-02T12:00:00.000Z',
            dateLocal: '2026-02-02',
            rawDescription: 'GIRO CAJERO',
          },
        ],
        ports,
      );

      const afterCategorized = db.select().from(transactions).where(eq(transactions.externalId, 'resync-categorized')).get();
      const afterExcluded = db.select().from(transactions).where(eq(transactions.externalId, 'resync-excluded')).get();
      expect(afterCategorized?.transactionCategoryId).toBe('comida');
      expect(afterCategorized?.categorySource).toBe('user');
      expect(afterExcluded?.excludedAt).not.toBeNull();
      expect(afterExcluded?.exclusionReason).toBe('cash_withdrawal');
    } finally {
      sqlite.close();
    }
  });
});
