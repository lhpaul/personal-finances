import { eq } from 'drizzle-orm';

import fixtureWithIds from '../__fixtures__/bank-response-with-ids.json';
import fixtureWithoutIds from '../__fixtures__/bank-response-without-ids.json';
import type { BankTransactionInput } from '../repositories/transactions';
import {
  countUncategorized,
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
});
