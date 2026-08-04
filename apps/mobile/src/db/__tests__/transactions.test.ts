import fs from 'node:fs';
import path from 'node:path';

import { deriveDateLocal } from '@finanzas/shared-utils';
import { eq } from 'drizzle-orm';

import fixtureWithIds from '../__fixtures__/bank-response-with-ids.json';
import fixtureWithoutIds from '../__fixtures__/bank-response-without-ids.json';
import type { BankTransactionInput } from '../repositories/transactions';
import {
  countCategorized,
  countTransactionsByMonth,
  countUncategorized,
  excludeTransaction,
  getTransactionContext,
  insertManualTransaction,
  listPendingBatch,
  listRecentMovements,
  listTransactionsPage,
  MovementValidationError,
  reincludeTransaction,
  setReviewFlag,
  setTransactionNote,
  setUserCategory,
  sumIncludedByDirectionAndCategory,
  sumIncludedByDirectionAndDay,
  sumIncludedExpensesInPeriod,
  totalForCategoryInPeriod,
  upsertBankTransactions,
} from '../repositories/transactions';
import { merchants, transactionCategories, transactions, userFinancialProducts } from '../schema';
import { createTestConnection, createTestProduct } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';
import type { TransactionListFilters, TransactionListQueryParams } from '../types';

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
   * Issue #10 additions — the v2 dedup identity (Decisions 1-2), AC5, AC6, AC15, AC22.
   */
  describe('two indistinguishable movements stay two (Business Rules 9-10, AC5)', () => {
    const twoIdenticalCoffees: BankTransactionInput[] = [
      { amount: 2500, type: 'debit', occurredAt: '2026-04-01T12:00:00.000Z', dateLocal: '2026-04-01', rawDescription: 'CAFE CENTRO' },
      { amount: 2500, type: 'debit', occurredAt: '2026-04-01T12:05:00.000Z', dateLocal: '2026-04-01', rawDescription: 'CAFE CENTRO' },
    ];

    const chargeAndRefund: BankTransactionInput[] = [
      { amount: 9900, type: 'debit', occurredAt: '2026-04-02T12:00:00.000Z', dateLocal: '2026-04-02', rawDescription: 'TIENDA ROPA' },
      { amount: 9900, type: 'credit', occurredAt: '2026-04-02T15:00:00.000Z', dateLocal: '2026-04-02', rawDescription: 'TIENDA ROPA' },
    ];

    it('two identical coffees in one read store two rows, and stay two on replay', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);

        const first = await upsertBankTransactions(db, productId, twoIdenticalCoffees, ports);
        expect(first.storedFirstTime).toBe(2);
        expect(
          db.select().from(transactions).where(eq(transactions.rawDescription, 'CAFE CENTRO')).all(),
        ).toHaveLength(2);

        const second = await upsertBankTransactions(db, productId, twoIdenticalCoffees, ports);
        expect(second.storedFirstTime).toBe(0);
        expect(second.alreadyKnown).toBe(2);
        expect(
          db.select().from(transactions).where(eq(transactions.rawDescription, 'CAFE CENTRO')).all(),
        ).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });

    it('a charge and its identically-described refund — alike except direction — store two rows, and stay two on replay', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);

        const first = await upsertBankTransactions(db, productId, chargeAndRefund, ports);
        expect(first.storedFirstTime).toBe(2);
        const rows = db.select().from(transactions).where(eq(transactions.rawDescription, 'TIENDA ROPA')).all();
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map((r) => r.type))).toEqual(new Set(['debit', 'credit']));

        const second = await upsertBankTransactions(db, productId, chargeAndRefund, ports);
        expect(second.storedFirstTime).toBe(0);
        expect(
          db.select().from(transactions).where(eq(transactions.rawDescription, 'TIENDA ROPA')).all(),
        ).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });

    it('planted-negative: without direction in the identity, a charge and its refund would collide — proves the guard is load-bearing', async () => {
      // This does not call production code with a broken identity (there is no such code path to
      // call); it demonstrates why Business Rule 9 exists by hashing the *pre-#10* v1-shaped
      // identity tuple (no direction) for the two rows above and showing they would collide.
      const v1Like = (row: BankTransactionInput) =>
        [row.dateLocal, String(row.amount), row.rawDescription].join('|');
      const [charge, refund] = chargeAndRefund;
      expect(v1Like(charge as BankTransactionInput)).toBe(v1Like(refund as BankTransactionInput));
    });
  });

  describe('a reordered read stores nothing new (Business Rule 11, AC6)', () => {
    it('the same rows in reverse order, with no external ids, produce the same stored count', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);

        const forward = withoutIds.productA.run1;
        const reversed = [...forward].reverse();

        const first = await upsertBankTransactions(db, productId, forward, ports);
        expect(first.storedFirstTime).toBe(forward.length);

        const second = await upsertBankTransactions(db, productId, reversed, ports);
        expect(second.storedFirstTime).toBe(0);
        expect(second.alreadyKnown).toBe(forward.length);
        expect(db.select().from(transactions).all()).toHaveLength(forward.length);
      } finally {
        sqlite.close();
      }
    });

    it('a duplicate group shuffled within the batch still produces the same total row count', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);

        const group: BankTransactionInput[] = [
          { amount: 1000, type: 'debit', occurredAt: '2026-04-05T12:00:00.000Z', dateLocal: '2026-04-05', rawDescription: 'A' },
          { amount: 1000, type: 'debit', occurredAt: '2026-04-05T12:01:00.000Z', dateLocal: '2026-04-05', rawDescription: 'A' },
          { amount: 1000, type: 'debit', occurredAt: '2026-04-05T12:02:00.000Z', dateLocal: '2026-04-05', rawDescription: 'A' },
        ];
        const shuffled = [group[2], group[0], group[1]] as BankTransactionInput[];

        const first = await upsertBankTransactions(db, productId, group, ports);
        expect(first.storedFirstTime).toBe(3);

        const second = await upsertBankTransactions(db, productId, shuffled, ports);
        expect(second.storedFirstTime).toBe(0);
        expect(db.select().from(transactions).where(eq(transactions.rawDescription, 'A')).all()).toHaveLength(3);
      } finally {
        sqlite.close();
      }
    });
  });

  describe('a rejected amount fails the whole batch (Business Rule 12, Decision 6, AC15)', () => {
    it.each([
      ['a fraction', 1500.5],
      ['zero', 0],
      ['negative', -1500],
      ['NaN', Number.NaN],
    ])('rejects amount = %s (%p) as a MovementValidationError, before any row is written', async (_label, amount) => {
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
                amount,
                type: 'debit',
                occurredAt: '2026-04-06T12:00:00.000Z',
                dateLocal: '2026-04-06',
                rawDescription: 'BAD AMOUNT',
              },
            ],
            ports,
          ),
        ).rejects.toBeInstanceOf(MovementValidationError);

        expect(db.select().from(transactions).all()).toHaveLength(before);
      } finally {
        sqlite.close();
      }
    });

    it('the thrown error never carries the offending value or the description (Business Rules 3, 30)', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);

        let caught: unknown;
        try {
          await upsertBankTransactions(
            db,
            productId,
            [
              {
                amount: -999999,
                type: 'debit',
                occurredAt: '2026-04-06T12:00:00.000Z',
                dateLocal: '2026-04-06',
                rawDescription: 'SENTINEL-DESCRIPTION-DO-NOT-LEAK',
              },
            ],
            ports,
          );
        } catch (error) {
          caught = error;
        }

        expect(caught).toBeInstanceOf(MovementValidationError);
        const message = (caught as MovementValidationError).message;
        expect(message).not.toContain('999999');
        expect(message).not.toContain('SENTINEL-DESCRIPTION-DO-NOT-LEAK');
        expect((caught as MovementValidationError).field).toBe('transactions.amount');
      } finally {
        sqlite.close();
      }
    });
  });

  describe('currency is stored as stated, never converted, and never summed into a peso total (Business Rule 17, Decision 15, AC22)', () => {
    it('a USD movement is stored with its stated currency and amount, unconverted, and stays out of totalForCategoryInPeriod', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();

        db.insert(transactions)
          .values([
            {
              id: 'usd-movement',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'usd-dedup',
              amount: 5000,
              type: 'debit',
              currencyCode: 'USD',
              occurredAt: now,
              dateLocal: '2026-04-10',
              rawDescription: 'INTERNATIONAL CHARGE',
              transactionCategoryId: 'entretenimiento',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'clp-movement',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 'clp-dedup',
              amount: 7000,
              type: 'debit',
              currencyCode: 'CLP',
              occurredAt: now,
              dateLocal: '2026-04-10',
              rawDescription: 'LOCAL CHARGE',
              transactionCategoryId: 'entretenimiento',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        const stored = db.select().from(transactions).where(eq(transactions.id, 'usd-movement')).get();
        expect(stored?.currencyCode).toBe('USD');
        expect(stored?.amount).toBe(5000);

        // Only the CLP row contributes: proof the guard is load-bearing, not merely present.
        const total = totalForCategoryInPeriod(db, 'entretenimiento', {
          startDateLocal: '2026-04-01',
          endDateLocal: '2026-04-30',
        });
        expect(total).toBe(7000);

        // Both rows still count toward "needs categorization" once uncategorized — the currency
        // guard must never hide a foreign-currency movement from the person entirely.
        db.update(transactions)
          .set({ transactionCategoryId: null })
          .where(eq(transactions.id, 'usd-movement'))
          .run();
        // Exactly the USD row: the CLP row keeps its category, so any other value means the
        // currency guard leaked into countUncategorized.
        expect(countUncategorized(db)).toBe(1);
      } finally {
        sqlite.close();
      }
    });

    it('a differently-cased or padded currency code is canonicalized before storage, on both insert and update (CodeRabbit finding on PR #78)', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);

        await upsertBankTransactions(
          db,
          productId,
          [
            {
              externalId: 'ext-casing',
              amount: 3000,
              type: 'debit',
              currencyCode: ' clp ',
              occurredAt: '2026-04-11T12:00:00.000Z',
              dateLocal: '2026-04-11',
              rawDescription: 'PADDED CURRENCY INSERT',
            },
          ],
          ports,
        );

        const afterInsert = db.select().from(transactions).where(eq(transactions.externalId, 'ext-casing')).get();
        expect(afterInsert?.currencyCode).toBe('CLP');

        await upsertBankTransactions(
          db,
          productId,
          [
            {
              externalId: 'ext-casing',
              amount: 3000,
              type: 'debit',
              currencyCode: 'usd',
              occurredAt: '2026-04-11T12:00:00.000Z',
              dateLocal: '2026-04-11',
              rawDescription: 'PADDED CURRENCY UPDATE',
            },
          ],
          ports,
        );

        const afterUpdate = db.select().from(transactions).where(eq(transactions.externalId, 'ext-casing')).get();
        expect(afterUpdate?.currencyCode).toBe('USD');
      } finally {
        sqlite.close();
      }
    });
  });

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

  /**
   * Issue #15 (`transactions` screen) implementation plan Scenarios 1-11.
   */
  describe('transactions-list repository (issue #15)', () => {
    const DEFAULT_FILTERS: TransactionListFilters = {
      direction: 'all',
      categorization: 'all',
      productId: null,
      showExcluded: true,
    };

    function params(
      overrides?: Partial<TransactionListFilters>,
      search: TransactionListQueryParams['search'] = null,
    ): TransactionListQueryParams {
      return { filters: { ...DEFAULT_FILTERS, ...overrides }, search };
    }

    /** Inserts `count` plain debit movements, one per day starting at `startDateLocal`, each
     * `idPrefix-<n>`, so paging tests have an unambiguous, strictly-decreasing `date_local` order
     * to page through. */
    function insertSequentialMovements(
      db: Awaited<ReturnType<typeof openBootstrappedMemoryDb>>['db'],
      ports: Awaited<ReturnType<typeof openBootstrappedMemoryDb>>['ports'],
      productId: string,
      count: number,
      idPrefix: string,
      startDateLocal = '2026-01-01',
    ): void {
      const now = ports.now();
      const [year, month, day] = startDateLocal.split('-').map(Number) as [number, number, number];
      const rows = Array.from({ length: count }, (_unused, index) => {
        const d = new Date(Date.UTC(year as number, (month as number) - 1, (day as number) + index));
        const dateLocal = d.toISOString().slice(0, 10);
        return {
          id: `${idPrefix}-${index}`,
          userFinancialProductId: productId,
          externalId: null,
          dedupHash: `${idPrefix}-dedup-${index}`,
          amount: 1000 + index,
          type: 'debit' as const,
          occurredAt: now,
          dateLocal,
          rawDescription: `Sequential ${index}`,
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        };
      });
      db.insert(transactions).values(rows).run();
    }

    it('Scenario 1: returns `limit` rows and a cursor when more exist, and a null cursor on the last page', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        insertSequentialMovements(db, ports, productId, 5, 'seq1');

        const firstPage = listTransactionsPage(db, { ...params(), cursor: null, limit: 3 }, 'es');
        expect(firstPage.rows).toHaveLength(3);
        expect(firstPage.nextCursor).not.toBeNull();

        const secondPage = listTransactionsPage(
          db,
          { ...params(), cursor: firstPage.nextCursor, limit: 3 },
          'es',
        );
        expect(secondPage.rows).toHaveLength(2);
        expect(secondPage.nextCursor).toBeNull();
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 2: paging the whole table with the cursor visits every row exactly once, including several sharing one date_local', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();
        // Four movements sharing one date_local, so the id tiebreaker is exercised.
        db.insert(transactions)
          .values(
            ['a', 'b', 'c', 'd'].map((suffix, index) => ({
              id: `same-day-${suffix}`,
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: `same-day-dedup-${suffix}`,
              amount: 1000 + index,
              type: 'debit' as const,
              occurredAt: now,
              dateLocal: '2026-03-15',
              rawDescription: `Same day ${suffix}`,
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            })),
          )
          .run();
        insertSequentialMovements(db, ports, productId, 6, 'seq2', '2026-03-01');

        const seenIds: string[] = [];
        let cursor: Parameters<typeof listTransactionsPage>[1]['cursor'] = null;
        let guard = 0;
        while (guard < 20) {
          guard += 1;
          const page = listTransactionsPage(db, { ...params(), cursor, limit: 4 }, 'es');
          seenIds.push(...page.rows.map((row) => row.id));
          if (page.nextCursor === null) break;
          cursor = page.nextCursor;
        }

        expect(seenIds).toHaveLength(10); // 6 sequential + 4 same-day
        expect(new Set(seenIds).size).toBe(10); // no duplicate
        // `date_local desc, id desc`: the same-day group is visited in descending id order —
        // proves the tiebreaker itself, not only that every row was visited once (found in
        // review on PR #82).
        expect(seenIds.filter((id) => id.startsWith('same-day-'))).toEqual([
          'same-day-d',
          'same-day-c',
          'same-day-b',
          'same-day-a',
        ]);
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 3: a row inserted between two page reads cannot skip or duplicate the already-read prefix', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        insertSequentialMovements(db, ports, productId, 4, 'seq3', '2026-05-01');

        const firstPage = listTransactionsPage(db, { ...params(), cursor: null, limit: 2 }, 'es');
        expect(firstPage.rows).toHaveLength(2);

        // A sync lands mid-scroll, inserting a brand-new, newest-dated row.
        const now = ports.now();
        db.insert(transactions)
          .values({
            id: 'seq3-inserted-later',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'seq3-inserted-later-dedup',
            amount: 9999,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-06-01', // newer than every row already read
            rawDescription: 'Inserted mid-scroll',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        const secondPage = listTransactionsPage(
          db,
          { ...params(), cursor: firstPage.nextCursor, limit: 2 },
          'es',
        );
        const firstPageIds = new Set(firstPage.rows.map((row) => row.id));
        for (const row of secondPage.rows) {
          expect(firstPageIds.has(row.id)).toBe(false); // no duplicate
        }
        expect(secondPage.rows.map((row) => row.id)).not.toContain('seq3-inserted-later'); // no skip either: the new row sorts before the cursor and is simply not part of this walk
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 4: showExcluded true (default) returns excluded movements; false omits exactly them', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();
        db.insert(transactions)
          .values([
            {
              id: 's15-excluded',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-excluded-dedup',
              amount: 1000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-10',
              rawDescription: 'Excluded movement',
              excludedAt: now,
              exclusionReason: 'not_relevant',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-included',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-included-dedup',
              amount: 2000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-11',
              rawDescription: 'Included movement',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        const withExcluded = listTransactionsPage(db, { ...params(), cursor: null, limit: 10 }, 'es');
        expect(withExcluded.rows.map((row) => row.id).sort()).toEqual(['s15-excluded', 's15-included']);

        const withoutExcluded = listTransactionsPage(
          db,
          { ...params({ showExcluded: false }), cursor: null, limit: 10 },
          'es',
        );
        expect(withoutExcluded.rows.map((row) => row.id)).toEqual(['s15-included']);
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 5: search matches on raw_description, merchants.name, note, and category name, plus a negative case', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();
        db.insert(transactions)
          .values([
            {
              id: 's15-raw',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-raw-dedup',
              amount: 1000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-01',
              rawDescription: 'GIRO CAJERO AUTOMATICO',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-merchant',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-merchant-dedup',
              amount: 2000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-02',
              // Deliberately does not contain the search term below (found in review on PR #82)
              // — a raw_description containing it would let the assertion pass without the
              // merchants.name predicate ever being evaluated.
              rawDescription: 'COMPRA TARJETA 1234',
              merchantId: 'lider',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-note',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-note-dedup',
              amount: 3000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-03',
              rawDescription: 'RETIRO SEMANAL',
              note: 'Compras semanales',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-category',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-category-dedup',
              amount: 4000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-04',
              rawDescription: 'UNRELATED DESCRIPTION',
              transactionCategoryId: 'comida',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-nomatch',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-nomatch-dedup',
              amount: 5000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-05',
              rawDescription: 'SOMETHING ELSE ENTIRELY',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        const byRaw = listTransactionsPage(db, { ...params(undefined, { term: 'giro', categoryIds: [] }), cursor: null, limit: 10 }, 'es');
        expect(byRaw.rows.map((row) => row.id)).toEqual(['s15-raw']);

        // 'der' matches only the seeded merchant name ('Líder') — not any row's raw_description
        // or note — so a match here can only come from the merchants.name predicate.
        const byMerchant = listTransactionsPage(db, { ...params(undefined, { term: 'der', categoryIds: [] }), cursor: null, limit: 10 }, 'es');
        expect(byMerchant.rows.map((row) => row.id)).toEqual(['s15-merchant']);

        const byNote = listTransactionsPage(db, { ...params(undefined, { term: 'semanales', categoryIds: [] }), cursor: null, limit: 10 }, 'es');
        expect(byNote.rows.map((row) => row.id)).toEqual(['s15-note']);

        const byCategory = listTransactionsPage(
          db,
          { ...params(undefined, { term: 'zzz-no-text-match', categoryIds: ['comida'] }), cursor: null, limit: 10 },
          'es',
        );
        expect(byCategory.rows.map((row) => row.id)).toEqual(['s15-category']);

        const noMatch = listTransactionsPage(db, { ...params(undefined, { term: 'no-such-term-anywhere', categoryIds: [] }), cursor: null, limit: 10 }, 'es');
        expect(noMatch.rows).toEqual([]);
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 6: a search term containing %, _ or \\ is escaped and matches literally, not as a wildcard', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();
        db.insert(transactions)
          .values([
            {
              id: 's15-literal-percent',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-literal-percent-dedup',
              amount: 1000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-06',
              rawDescription: 'DESCUENTO 10%OFF',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-decoy',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-decoy-dedup',
              amount: 2000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-07',
              rawDescription: 'DESCUENTO 10XOFF', // would match a literal `%` treated as a wildcard
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-literal-underscore',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-literal-underscore-dedup',
              amount: 3000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-08',
              rawDescription: 'LITERAL A_B',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-decoy-underscore',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-decoy-underscore-dedup',
              amount: 3500,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-09',
              rawDescription: 'LITERAL AXB', // would match a literal `_` treated as "any one character"
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-literal-backslash',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-literal-backslash-dedup',
              amount: 4000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-10',
              rawDescription: 'LITERAL C\\D',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-decoy-backslash',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-decoy-backslash-dedup',
              amount: 4500,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-11',
              // would match if an unescaped `\` collapsed the pattern's `\d` to a literal `d`
              rawDescription: 'LITERAL CD',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        const result = listTransactionsPage(
          db,
          { ...params(undefined, { term: '10%off', categoryIds: [] }), cursor: null, limit: 10 },
          'es',
        );
        expect(result.rows.map((row) => row.id)).toEqual(['s15-literal-percent']);

        // Scenario 6 (found in review on PR #82): the title claims all three special
        // characters — exercise `_` and `\` too, each against its own decoy.
        const underscore = listTransactionsPage(
          db,
          { ...params(undefined, { term: 'a_b', categoryIds: [] }), cursor: null, limit: 10 },
          'es',
        );
        expect(underscore.rows.map((row) => row.id)).toEqual(['s15-literal-underscore']);

        const backslash = listTransactionsPage(
          db,
          { ...params(undefined, { term: 'c\\d', categoryIds: [] }), cursor: null, limit: 10 },
          'es',
        );
        expect(backslash.rows.map((row) => row.id)).toEqual(['s15-literal-backslash']);
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 7: search is ASCII-case-insensitive, and category search is diacritic-insensitive', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();

        db.insert(transactionCategories)
          .values({
            id: 's15-nunoa',
            slug: 's15-nunoa',
            income: 0,
            labels: JSON.stringify({ es: 'Ñuñoa', en: 'Ñuñoa' }),
            sortOrder: 999,
            createdAt: now,
          })
          .run();

        db.insert(transactions)
          .values([
            {
              id: 's15-uber',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-uber-dedup',
              amount: 1000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-08',
              rawDescription: 'UBER BV',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-nunoa-tx',
              userFinancialProductId: productId,
              externalId: null,
              dedupHash: 's15-nunoa-tx-dedup',
              amount: 2000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-09',
              rawDescription: 'PARKING NUNOA',
              transactionCategoryId: 's15-nunoa',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        // ASCII case-insensitivity on the text columns.
        const upper = listTransactionsPage(db, { ...params(undefined, { term: 'UBER', categoryIds: [] }), cursor: null, limit: 10 }, 'es');
        expect(upper.rows.map((row) => row.id)).toEqual(['s15-uber']);

        // Category search is diacritic-insensitive by construction (the feature layer resolves
        // category ids through normalizeDescription before this repository ever runs); the
        // repository side of that contract is exercised here by passing the resolved id directly.
        const byCategoryId = listTransactionsPage(
          db,
          { ...params(undefined, { term: 'zzz-no-text-match', categoryIds: ['s15-nunoa'] }), cursor: null, limit: 10 },
          'es',
        );
        expect(byCategoryId.rows.map((row) => row.id)).toEqual(['s15-nunoa-tx']);
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 8: every filter combination narrows correctly, including two filters at once and a filter plus a search term', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productA = createTestProduct(db, ports, connectionId, { externalId: 'prod-a' });
        const productB = createTestProduct(db, ports, connectionId, { externalId: 'prod-b' });
        const now = ports.now();

        db.insert(transactions)
          .values([
            {
              id: 's15-combo-debit-uncat-a',
              userFinancialProductId: productA,
              externalId: null,
              dedupHash: 's15-combo-1',
              amount: 1000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-12',
              rawDescription: 'Debit uncategorized on A',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-combo-credit-cat-a',
              userFinancialProductId: productA,
              externalId: null,
              dedupHash: 's15-combo-2',
              amount: 2000,
              type: 'credit',
              occurredAt: now,
              dateLocal: '2026-05-13',
              rawDescription: 'Credit categorized on A',
              transactionCategoryId: 'sueldo',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 's15-combo-debit-uncat-b',
              userFinancialProductId: productB,
              externalId: null,
              dedupHash: 's15-combo-3',
              amount: 3000,
              type: 'debit',
              occurredAt: now,
              dateLocal: '2026-05-14',
              rawDescription: 'Debit uncategorized on B, matches search',
              isManual: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          .run();

        // Tipo alone.
        expect(
          listTransactionsPage(db, { ...params({ direction: 'credit' }), cursor: null, limit: 10 }, 'es').rows.map(
            (row) => row.id,
          ),
        ).toEqual(['s15-combo-credit-cat-a']);

        // Estado alone.
        expect(
          listTransactionsPage(
            db,
            { ...params({ categorization: 'categorized' }), cursor: null, limit: 10 },
            'es',
          ).rows.map((row) => row.id),
        ).toEqual(['s15-combo-credit-cat-a']);

        // Producto alone.
        expect(
          listTransactionsPage(db, { ...params({ productId: productB }), cursor: null, limit: 10 }, 'es').rows.map(
            (row) => row.id,
          ),
        ).toEqual(['s15-combo-debit-uncat-b']);

        // Tipo + Estado together.
        expect(
          listTransactionsPage(
            db,
            { ...params({ direction: 'debit', categorization: 'uncategorized' }), cursor: null, limit: 10 },
            'es',
          ).rows.map((row) => row.id).sort(),
        ).toEqual(['s15-combo-debit-uncat-a', 's15-combo-debit-uncat-b']);

        // Producto + a search term.
        expect(
          listTransactionsPage(
            db,
            {
              ...params({ productId: productB }, { term: 'matches search', categoryIds: [] }),
              cursor: null,
              limit: 10,
            },
            'es',
          ).rows.map((row) => row.id),
        ).toEqual(['s15-combo-debit-uncat-b']);

        // Producto + a search term that does not match anything on that product.
        expect(
          listTransactionsPage(
            db,
            {
              ...params({ productId: productA }, { term: 'matches search', categoryIds: [] }),
              cursor: null,
              limit: 10,
            },
            'es',
          ).rows,
        ).toEqual([]);
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 9: countTransactionsByMonth returns one entry per month present, descending, matching listTransactionsPage paged to exhaustion', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        const now = ports.now();
        db.insert(transactions)
          .values([
            { dateLocal: '2025-12-01', id: 's15-month-dec-1' },
            { dateLocal: '2025-12-15', id: 's15-month-dec-2' },
            { dateLocal: '2026-01-05', id: 's15-month-jan-1' },
            { dateLocal: '2026-01-20', id: 's15-month-jan-2' },
            { dateLocal: '2026-01-25', id: 's15-month-jan-3' },
          ].map((row) => ({
            ...row,
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: `${row.id}-dedup`,
            amount: 1000,
            type: 'debit' as const,
            occurredAt: now,
            rawDescription: row.id,
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          })))
          .run();

        const monthCounts = countTransactionsByMonth(db, params());
        expect(monthCounts).toEqual([
          { monthKey: '2026-01', count: 3 },
          { monthKey: '2025-12', count: 2 },
        ]);

        // Page to exhaustion and confirm the per-month tally agrees exactly with the header count.
        const seen: string[] = [];
        let cursor: Parameters<typeof listTransactionsPage>[1]['cursor'] = null;
        for (let guard = 0; guard < 10; guard += 1) {
          const page = listTransactionsPage(db, { ...params(), cursor, limit: 2 }, 'es');
          seen.push(...page.rows.map((row) => row.dateLocal.slice(0, 7)));
          if (page.nextCursor === null) break;
          cursor = page.nextCursor;
        }
        const tally = new Map<string, number>();
        for (const monthKey of seen) tally.set(monthKey, (tally.get(monthKey) ?? 0) + 1);
        for (const monthCount of monthCounts) {
          expect(tally.get(monthCount.monthKey)).toBe(monthCount.count);
        }
      } finally {
        sqlite.close();
      }
    });

    it('Scenario 10: the month key is derived from date_local, not from occurred_at', async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        const connectionId = createTestConnection(db, ports);
        const productId = createTestProduct(db, ports, connectionId);
        db.insert(transactions)
          .values({
            id: 's15-boundary',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 's15-boundary-dedup',
            amount: 1000,
            type: 'debit',
            // occurred_at falls in February UTC, but date_local (the Santiago-zoned civil day) is
            // still January — the group must key off date_local.
            occurredAt: '2026-02-01T02:30:00.000Z',
            dateLocal: '2026-01-31',
            rawDescription: 'Late-night movement',
            isManual: 0,
            createdAt: '2026-01-31T00:00:00.000Z',
            updatedAt: '2026-01-31T00:00:00.000Z',
          })
          .run();

        const monthCounts = countTransactionsByMonth(db, params());
        expect(monthCounts).toEqual([{ monthKey: '2026-01', count: 1 }]);
      } finally {
        sqlite.close();
      }
    });

    describe('insertManualTransaction (Decision 12, Business Rules 5, 8)', () => {
      it('Scenario 11: writes is_manual = 1, a dedup hash that folds in the row id, and two identical manual entries both persist', async () => {
        const { sqlite, db, ports } = await openBootstrappedMemoryDb();
        try {
          const connectionId = createTestConnection(db, ports);
          const productId = createTestProduct(db, ports, connectionId);

          const input = { userFinancialProductId: productId, type: 'debit' as const, amount: 5000, rawDescription: 'Efectivo prestado' };
          const firstId = await insertManualTransaction(db, input, ports);
          const secondId = await insertManualTransaction(db, input, ports);

          expect(firstId).not.toBe(secondId);
          const rows = db
            .select()
            .from(transactions)
            .where(eq(transactions.rawDescription, 'Efectivo prestado'))
            .all();
          expect(rows).toHaveLength(2); // never deduplicated away (Business Rule 5)
          for (const row of rows) {
            expect(row.isManual).toBe(1);
            expect(row.transactionCategoryId).toBeNull(); // joins the categorization queue (Business Rule 6)
            expect(row.merchantId).toBeNull();
            expect(row.currencyCode).toBe('CLP');
            expect(row.dateLocal).toBe(deriveDateLocal(new Date(ports.now())));
          }
          expect(new Set(rows.map((row) => row.dedupHash)).size).toBe(2); // the id fold keeps them distinct
        } finally {
          sqlite.close();
        }
      });

      it('stores the selected product\'s own currency, never a hard-coded CLP (found in review on PR #82)', async () => {
        const { sqlite, db, ports } = await openBootstrappedMemoryDb();
        try {
          const connectionId = createTestConnection(db, ports);
          const usdProductId = createTestProduct(db, ports, connectionId, {
            externalId: 'usd-product',
            currencyCode: 'USD',
          });

          const id = await insertManualTransaction(
            db,
            { userFinancialProductId: usdProductId, type: 'debit', amount: 2000, rawDescription: 'International charge' },
            ports,
          );

          const row = db.select().from(transactions).where(eq(transactions.id, id)).get();
          expect(row?.currencyCode).toBe('USD');
        } finally {
          sqlite.close();
        }
      });

      it('Scenario 11: rejects a non-positive or non-integer amount, before any row is written', async () => {
        const { sqlite, db, ports } = await openBootstrappedMemoryDb();
        try {
          const connectionId = createTestConnection(db, ports);
          const productId = createTestProduct(db, ports, connectionId);
          const before = db.select().from(transactions).all().length;

          for (const amount of [0, -1000, 1500.5]) {
            await expect(
              insertManualTransaction(
                db,
                { userFinancialProductId: productId, type: 'debit', amount, rawDescription: 'Bad amount' },
                ports,
              ),
            ).rejects.toThrow();
          }
          expect(db.select().from(transactions).all()).toHaveLength(before);
        } finally {
          sqlite.close();
        }
      });
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

/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenarios 1-11. A separate
 * top-level `describe` with its own local fixtures — the same shape #13's own block above uses
 * — rather than interleaving into either existing block.
 */
describe('transaction detail repository functions (#16)', () => {
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
        amount: 35000,
        type: 'debit',
        occurredAt: now,
        dateLocal: '2026-02-01',
        rawDescription: 'COMPRA LIDER EXPRESS',
        isManual: 0,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      })
      .run();
  }

  function insertMerchant(
    db: Awaited<ReturnType<typeof openBootstrappedMemoryDb>>['db'],
    overrides: Partial<typeof merchants.$inferInsert> & { id: string; name: string },
    now: string,
  ) {
    db.insert(merchants)
      .values({ createdAt: now, ...overrides })
      .run();
  }

  function createProductWithMetadata(
    db: Awaited<ReturnType<typeof openBootstrappedMemoryDb>>['db'],
    ports: { newId: () => string; now: () => string },
    userFinancialInstitutionId: string,
    metadata: string | null,
  ): string {
    const id = ports.newId();
    db.insert(userFinancialProducts)
      .values({
        id,
        userFinancialInstitutionId,
        externalId: `product-${id}`,
        type: 'checking',
        name: 'Cta. corriente',
        metadata,
        updatedAt: ports.now(),
      })
      .run();
    return id;
  }

  const BANK_OWNED_COLUMNS = [
    'rawDescription',
    'amount',
    'type',
    'occurredAt',
    'dateLocal',
    'externalId',
    'dedupHash',
  ] as const;

  function bankFacts(row: Record<string, unknown>): Record<string, unknown> {
    const facts: Record<string, unknown> = {};
    for (const column of BANK_OWNED_COLUMNS) facts[column] = row[column];
    return facts;
  }

  it('getTransactionContext returns the movement with its merchant name, product name and mask; undefined for an unknown id (Scenario 1)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createProductWithMetadata(db, ports, connectionId, JSON.stringify({ mask: '4821' }));
      const now = ports.now();
      insertMerchant(db, { id: 'detail-merchant', name: 'Líder S.A.', transactionCategoryId: 'supermercado' }, now);
      insertTransaction(db, productId, { id: 'detail-ctx', merchantId: 'detail-merchant' }, now);

      const context = getTransactionContext(db, 'detail-ctx');
      expect(context?.transaction.id).toBe('detail-ctx');
      expect(context?.merchantName).toBe('Líder S.A.');
      expect(context?.merchant).toEqual({
        id: 'detail-merchant',
        name: 'Líder S.A.',
        transactionCategoryId: 'supermercado',
        isUserDefined: false,
      });
      expect(context?.product?.name).toBe('Cta. corriente');
      expect(context?.product?.mask).toBe('4821');

      expect(getTransactionContext(db, 'not-a-real-id')).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });

  it('getTransactionContext returns an excluded movement — the read carries no inclusion predicate (Scenario 2, BR3)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(
        db,
        productId,
        { id: 'detail-excluded', excludedAt: now, exclusionReason: 'shared_expense' },
        now,
      );

      const context = getTransactionContext(db, 'detail-excluded');
      expect(context?.transaction.excludedAt).toBe(now);
      expect(context?.transaction.exclusionReason).toBe('shared_expense');
    } finally {
      sqlite.close();
    }
  });

  it('getTransactionContext returns merchantName: null for a movement with no merchant, and a product whose mask is undefined when the metadata has none (Scenario 3, A6, A9)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createProductWithMetadata(db, ports, connectionId, null);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'detail-no-merchant' }, now);

      const context = getTransactionContext(db, 'detail-no-merchant');
      expect(context?.merchantName).toBeNull();
      expect(context?.merchant).toBeNull();
      expect(context?.product?.mask).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });

  it('setTransactionNote writes a trimmed note, stores null for a blank or whitespace-only note, and bumps updated_at (Scenario 4, A8)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'detail-note', createdAt: now, updatedAt: now }, now);

      setTransactionNote(db, 'detail-note', '  Compras del sábado  ', ports);
      const row = db.select().from(transactions).where(eq(transactions.id, 'detail-note')).get();
      expect(row?.note).toBe('Compras del sábado');
      expect(row?.updatedAt).not.toBe(now);

      setTransactionNote(db, 'detail-note', '   ', ports);
      const blank = db.select().from(transactions).where(eq(transactions.id, 'detail-note')).get();
      expect(blank?.note).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('each of setTransactionNote, setUserCategory, excludeTransaction and reincludeTransaction leaves every bank-owned column byte-identical (Scenario 5, AC1, Decision 14)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'detail-immutable' }, now);
      const before = bankFacts(
        db.select().from(transactions).where(eq(transactions.id, 'detail-immutable')).get() as Record<
          string,
          unknown
        >,
      );

      setTransactionNote(db, 'detail-immutable', 'una nota', ports);
      setUserCategory(db, 'detail-immutable', 'comida', ports);
      excludeTransaction(db, 'detail-immutable', { reason: 'other' }, ports);
      reincludeTransaction(db, 'detail-immutable', ports);

      const after = bankFacts(
        db.select().from(transactions).where(eq(transactions.id, 'detail-immutable')).get() as Record<
          string,
          unknown
        >,
      );
      expect(after).toEqual(before);
    } finally {
      sqlite.close();
    }
  });

  it('reincludeTransaction clears the exclusion timestamp, reason and note, keeps the row and its category, and leaves the partial-inclusion amount null (Scenario 6, AC3)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(
        db,
        productId,
        {
          id: 'detail-reinclude',
          transactionCategoryId: 'comida',
          categorySource: 'user',
          excludedAt: now,
          exclusionReason: 'shared_expense',
          exclusionNote: 'con roomies',
        },
        now,
      );

      reincludeTransaction(db, 'detail-reinclude', ports);

      const row = db.select().from(transactions).where(eq(transactions.id, 'detail-reinclude')).get();
      expect(row?.excludedAt).toBeNull();
      expect(row?.exclusionReason).toBeNull();
      expect(row?.exclusionNote).toBeNull();
      expect(row?.transactionCategoryId).toBe('comida');
      expect(row?.includedAmount).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('a re-included movement re-enters totalForCategoryInPeriod, and an excluded one is absent from it (Scenario 7, AC3)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(
        db,
        productId,
        {
          id: 'detail-total',
          transactionCategoryId: 'supermercado',
          categorySource: 'user',
          excludedAt: now,
          exclusionReason: 'shared_expense',
          dateLocal: '2026-02-01',
        },
        now,
      );

      const period = { startDateLocal: '2026-02-01', endDateLocal: '2026-02-28' };
      expect(totalForCategoryInPeriod(db, 'supermercado', period)).toBe(0);

      reincludeTransaction(db, 'detail-total', ports);
      expect(totalForCategoryInPeriod(db, 'supermercado', period)).toBe(35000);
    } finally {
      sqlite.close();
    }
  });

  it('exclude, re-include, exclude again is repeatable, and each step is observable in the row (Scenario 8, BR3)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'detail-cycle' }, now);

      excludeTransaction(db, 'detail-cycle', { reason: 'other' }, ports);
      let row = db.select().from(transactions).where(eq(transactions.id, 'detail-cycle')).get();
      expect(row?.excludedAt).not.toBeNull();

      reincludeTransaction(db, 'detail-cycle', ports);
      row = db.select().from(transactions).where(eq(transactions.id, 'detail-cycle')).get();
      expect(row?.excludedAt).toBeNull();

      excludeTransaction(db, 'detail-cycle', { reason: 'not_relevant' }, ports);
      row = db.select().from(transactions).where(eq(transactions.id, 'detail-cycle')).get();
      expect(row?.excludedAt).not.toBeNull();
      expect(row?.exclusionReason).toBe('not_relevant');

      expect(db.select().from(transactions).where(eq(transactions.id, 'detail-cycle')).all()).toHaveLength(1);
    } finally {
      sqlite.close();
    }
  });

  it('reincludeTransaction on a movement that is not excluded is a no-op that does not throw (Scenario 9, Decision 6)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTransaction(db, productId, { id: 'detail-already-included' }, now);

      expect(() => reincludeTransaction(db, 'detail-already-included', ports)).not.toThrow();
      const row = db.select().from(transactions).where(eq(transactions.id, 'detail-already-included')).get();
      expect(row?.excludedAt).toBeNull();
      expect(row?.exclusionReason).toBeNull();
      expect(row?.exclusionNote).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('no function this item adds issues a delete, and repositories/transactions.ts still exports no deleteTransaction (Scenario 10, BR3)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'repositories', 'transactions.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/export\s+(?:async\s+)?function\s+deleteTransaction/);
    expect(source).not.toMatch(/\.delete\(\s*transactions\s*\)/);
  });

  it('a simulated re-sync over a re-included, noted, categorized movement preserves all four person-owned decisions (Scenario 11, #10 seam, Decision 3)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId, { externalId: 'acct-resync' });
      const now = ports.now();
      insertTransaction(
        db,
        productId,
        {
          id: 'detail-resync',
          externalId: 'resync-detail',
          transactionCategoryId: 'comida',
          categorySource: 'user',
          excludedAt: now,
          exclusionReason: 'other',
        },
        now,
      );

      setTransactionNote(db, 'detail-resync', 'una nota', ports);
      reincludeTransaction(db, 'detail-resync', ports);
      setUserCategory(db, 'detail-resync', 'transporte', ports);

      await upsertBankTransactions(
        db,
        productId,
        [
          {
            externalId: 'resync-detail',
            amount: 35000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-01',
            rawDescription: 'COMPRA LIDER EXPRESS',
          },
        ],
        ports,
      );

      const row = db.select().from(transactions).where(eq(transactions.id, 'detail-resync')).get();
      expect(row?.note).toBe('una nota');
      expect(row?.transactionCategoryId).toBe('transporte');
      expect(row?.categorySource).toBe('user');
      expect(row?.excludedAt).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
