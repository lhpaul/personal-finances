import { eq } from 'drizzle-orm';

import fixtureWithIds from '../__fixtures__/bank-response-with-ids.json';
import fixtureWithoutIds from '../__fixtures__/bank-response-without-ids.json';
import type { BankTransactionInput } from '../repositories/transactions';
import {
  countUncategorized,
  listRecentMovements,
  MovementValidationError,
  sumIncludedByDirectionAndCategory,
  sumIncludedByDirectionAndDay,
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
});
