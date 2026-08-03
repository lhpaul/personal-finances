import { eq } from 'drizzle-orm';

import {
  deleteMerchant,
  groupAliasIntoMerchant,
  readMerchantEditor,
  recountMerchantAliases,
  saveMerchantProfile,
} from '../repositories/merchants';
import { merchantAliases, merchants, transactions, users } from '../schema';
import { createTestConnection, createTestProduct } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';
import type { AppDatabase } from '../types';

/** Inserts a bare `merchants` row for a repository test, independent of the seed catalogue. */
function insertTestMerchant(
  db: AppDatabase,
  now: string,
  overrides: { id: string; name?: string; transactionCategoryId?: string | null; userId?: string | null },
): void {
  db.insert(merchants)
    .values({
      id: overrides.id,
      name: overrides.name ?? overrides.id,
      transactionCategoryId: overrides.transactionCategoryId ?? null,
      countryCode: null,
      userId: overrides.userId ?? null,
      createdAt: now,
    })
    .run();
}

/** Inserts a bare `transactions` row for a repository test — every column that has no bearing on
 * the scenario under test keeps a fixed, deliberately boring value. */
function insertTestMovement(
  db: AppDatabase,
  productId: string,
  now: string,
  overrides: {
    id: string;
    rawDescription: string;
    merchantId?: string | null;
    transactionCategoryId?: string | null;
    categorySource?: 'auto' | 'user' | 'rule' | null;
  },
): void {
  db.insert(transactions)
    .values({
      id: overrides.id,
      userFinancialProductId: productId,
      externalId: `ext-${overrides.id}`,
      dedupHash: `dedup-${overrides.id}`,
      amount: 1000,
      type: 'debit',
      occurredAt: now,
      dateLocal: '2026-02-01',
      rawDescription: overrides.rawDescription,
      merchantId: overrides.merchantId ?? null,
      transactionCategoryId: overrides.transactionCategoryId ?? null,
      categorySource: overrides.categorySource ?? null,
      isManual: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/** Scenario 22 (merchant half), per the Testing Strategy's test-file table. */
describe('merchants repository', () => {
  it('deleteMerchant removes its aliases and leaves its movements with merchant_id null; the merchant itself is gone (Business Rule 21, AC22)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values({
          id: 'txn-lider',
          userFinancialProductId: productId,
          externalId: null,
          dedupHash: 'dedup-lider',
          amount: 4200,
          type: 'debit',
          occurredAt: now,
          dateLocal: '2026-02-01',
          rawDescription: 'LIDER',
          merchantId: 'lider',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const aliasesBefore = db.select().from(merchantAliases).where(eq(merchantAliases.merchantId, 'lider')).all();
      expect(aliasesBefore.length).toBeGreaterThanOrEqual(1);

      deleteMerchant(db, 'lider');

      expect(db.select().from(merchants).where(eq(merchants.id, 'lider')).get()).toBeUndefined();
      expect(db.select().from(merchantAliases).where(eq(merchantAliases.merchantId, 'lider')).all()).toHaveLength(0);

      const movement = db.select().from(transactions).where(eq(transactions.id, 'txn-lider')).get();
      expect(movement).toBeDefined(); // the movement survives
      expect(movement?.merchantId).toBeNull(); // and simply stops naming a merchant
    } finally {
      sqlite.close();
    }
  });

  it('there is no deleteTransaction export anywhere in src/db (Business Rule 5, AC22)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const transactionsRepo = require('../repositories/transactions') as Record<string, unknown>;
    expect(Object.keys(transactionsRepo)).not.toContain('deleteTransaction');
  });
});

/** Implementation plan for issue #14, Testing Strategy scenarios 1-3, Decisions 7-9. */
describe('groupAliasIntoMerchant / recountMerchantAliases (AC1, AC3)', () => {
  it('re-links only the unattributed movements that match the pattern, and leaves their other columns untouched (Scenario 1, AC1)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTestMerchant(db, now, { id: 'acme' });
      insertTestMerchant(db, now, { id: 'other-merchant' });

      insertTestMovement(db, productId, now, { id: 'orphan-match-1', rawDescription: 'ACME STORE #001' });
      insertTestMovement(db, productId, now, { id: 'orphan-match-2', rawDescription: 'ACME STORE #002' });
      insertTestMovement(db, productId, now, { id: 'orphan-no-match', rawDescription: 'UNRELATED SHOP' });
      insertTestMovement(db, productId, now, {
        id: 'already-attributed',
        rawDescription: 'ACME STORE ALREADY OWNED',
        merchantId: 'other-merchant',
      });

      const before = db.select().from(transactions).where(eq(transactions.id, 'orphan-match-1')).get();

      groupAliasIntoMerchant(db, { merchantId: 'acme', rawPattern: 'ACME STORE', newId: ports.newId, now: ports.now });

      const match1 = db.select().from(transactions).where(eq(transactions.id, 'orphan-match-1')).get();
      const match2 = db.select().from(transactions).where(eq(transactions.id, 'orphan-match-2')).get();
      const noMatch = db.select().from(transactions).where(eq(transactions.id, 'orphan-no-match')).get();
      const alreadyAttributed = db.select().from(transactions).where(eq(transactions.id, 'already-attributed')).get();

      expect(match1?.merchantId).toBe('acme');
      expect(match2?.merchantId).toBe('acme');
      expect(noMatch?.merchantId).toBeNull(); // does not match the pattern — left alone
      expect(alreadyAttributed?.merchantId).toBe('other-merchant'); // already owned — never moved

      // Every other column of the re-linked row is untouched.
      expect(match1?.amount).toBe(before?.amount);
      expect(match1?.rawDescription).toBe(before?.rawDescription);
      expect(match1?.categorySource).toBe(before?.categorySource);
      expect(match1?.dedupHash).toBe(before?.dedupHash);

      const alias = db.select().from(merchantAliases).where(eq(merchantAliases.rawPattern, 'ACME STORE')).get();
      expect(alias?.merchantId).toBe('acme');
      expect(alias?.matchType).toBe('prefix');
      expect(alias?.matchCount).toBe(2); // recomputed, not incremented
    } finally {
      sqlite.close();
    }
  });

  it('grouping the same candidate twice changes nothing the second time (Scenario 2, AC1 idempotency)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTestMerchant(db, now, { id: 'acme' });
      insertTestMovement(db, productId, now, { id: 'orphan-1', rawDescription: 'ACME STORE #001' });

      groupAliasIntoMerchant(db, { merchantId: 'acme', rawPattern: 'ACME STORE', newId: ports.newId, now: ports.now });
      const afterFirst = {
        aliases: db.select().from(merchantAliases).all(),
        movement: db.select().from(transactions).where(eq(transactions.id, 'orphan-1')).get(),
      };

      // Re-tapping "Agrupar" must not raise a unique-constraint error and must not duplicate the row.
      expect(() =>
        groupAliasIntoMerchant(db, { merchantId: 'acme', rawPattern: 'ACME STORE', newId: ports.newId, now: ports.now }),
      ).not.toThrow();

      const afterSecond = {
        aliases: db.select().from(merchantAliases).all(),
        movement: db.select().from(transactions).where(eq(transactions.id, 'orphan-1')).get(),
      };

      expect(afterSecond.aliases.filter((row) => row.rawPattern === 'ACME STORE')).toHaveLength(1);
      expect(afterSecond.aliases).toEqual(afterFirst.aliases);
      expect(afterSecond.movement?.merchantId).toBe(afterFirst.movement?.merchantId);
    } finally {
      sqlite.close();
    }
  });

  it('grouping a pattern that already exists on another merchant moves the alias row instead of inserting a duplicate (Scenario 3, AC1, Decision 8)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      insertTestMerchant(db, ports.now(), { id: 'merchant-a' });
      insertTestMerchant(db, ports.now(), { id: 'merchant-b' });
      db.insert(merchantAliases)
        .values({ id: 'alias-shared', merchantId: 'merchant-a', rawPattern: 'SHARED PATTERN', matchType: 'prefix', matchCount: 3 })
        .run();

      groupAliasIntoMerchant(db, { merchantId: 'merchant-b', rawPattern: 'SHARED PATTERN', newId: ports.newId, now: ports.now });

      const rows = db.select().from(merchantAliases).where(eq(merchantAliases.rawPattern, 'SHARED PATTERN')).all();
      expect(rows).toHaveLength(1); // moved, not duplicated
      expect(rows[0]?.merchantId).toBe('merchant-b');
      expect(rows[0]?.id).toBe('alias-shared'); // the same row, re-pointed

      const merchantAAliases = db.select().from(merchantAliases).where(eq(merchantAliases.merchantId, 'merchant-a')).all();
      expect(merchantAAliases).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });

  it('match_count reflects the real movement count after grouping, after a re-point away, and after the merchant loses all its movements (Scenario 5, AC3)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTestMerchant(db, now, { id: 'acme' });
      db.insert(merchantAliases)
        .values({ id: 'alias-acme-a', merchantId: 'acme', rawPattern: 'ACME A', matchType: 'prefix', matchCount: 0 })
        .run();
      db.insert(merchantAliases)
        .values({ id: 'alias-acme-b', merchantId: 'acme', rawPattern: 'ACME B', matchType: 'prefix', matchCount: 0 })
        .run();
      insertTestMovement(db, productId, now, { id: 'm1', rawDescription: 'ACME A #1', merchantId: 'acme' });
      insertTestMovement(db, productId, now, { id: 'm2', rawDescription: 'ACME A #2', merchantId: 'acme' });
      insertTestMovement(db, productId, now, { id: 'm3', rawDescription: 'ACME B #1', merchantId: 'acme' });
      // Hand-attributed to the merchant, but explained by neither alias — counted by none (Decision 7).
      insertTestMovement(db, productId, now, { id: 'm4', rawDescription: 'A COMPLETELY DIFFERENT STRING', merchantId: 'acme' });

      recountMerchantAliases(db, 'acme');
      let aliasA = db.select().from(merchantAliases).where(eq(merchantAliases.id, 'alias-acme-a')).get();
      let aliasB = db.select().from(merchantAliases).where(eq(merchantAliases.id, 'alias-acme-b')).get();
      expect(aliasA?.matchCount).toBe(2);
      expect(aliasB?.matchCount).toBe(1);

      // The merchant loses every movement (e.g. re-attributed elsewhere) — counts fall to zero,
      // not left stale.
      db.update(transactions).set({ merchantId: null }).where(eq(transactions.userFinancialProductId, productId)).run();
      recountMerchantAliases(db, 'acme');
      aliasA = db.select().from(merchantAliases).where(eq(merchantAliases.id, 'alias-acme-a')).get();
      aliasB = db.select().from(merchantAliases).where(eq(merchantAliases.id, 'alias-acme-b')).get();
      expect(aliasA?.matchCount).toBe(0);
      expect(aliasB?.matchCount).toBe(0);
    } finally {
      sqlite.close();
    }
  });
});

/** Implementation plan for issue #14, Testing Strategy scenario 4, Decisions 5-6. */
describe('saveMerchantProfile (AC2)', () => {
  it('changes exactly one merchants row and leaves every transactions row byte-identical, including a category_source="user" row (Scenario 4, AC2)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      const localUser = db.select().from(users).get() as { id: string };
      insertTestMerchant(db, now, { id: 'acme', transactionCategoryId: 'compras', userId: null });
      insertTestMovement(db, productId, now, {
        id: 'user-categorized',
        rawDescription: 'ACME STORE',
        merchantId: 'acme',
        transactionCategoryId: 'comida',
        categorySource: 'user',
      });
      insertTestMovement(db, productId, now, {
        id: 'auto-categorized',
        rawDescription: 'ACME STORE',
        merchantId: 'acme',
        transactionCategoryId: 'compras',
        categorySource: 'auto',
      });

      const merchantsBefore = db.select().from(merchants).all();
      const transactionsBefore = db.select().from(transactions).all();

      saveMerchantProfile(db, {
        merchantId: 'acme',
        name: 'ACME Renamed',
        transactionCategoryId: 'supermercado',
        userId: localUser.id,
      });

      const transactionsAfter = db.select().from(transactions).all();
      expect(transactionsAfter).toEqual(transactionsBefore); // byte-identical — no movement was written

      const merchantsAfter = db.select().from(merchants).all();
      const changedIds = merchantsAfter
        .filter((row) => {
          const beforeRow = merchantsBefore.find((candidate) => candidate.id === row.id);
          return JSON.stringify(beforeRow) !== JSON.stringify(row);
        })
        .map((row) => row.id);
      expect(changedIds).toEqual(['acme']); // every other seeded merchant is untouched

      const acme = db.select().from(merchants).where(eq(merchants.id, 'acme')).get();
      expect(acme?.name).toBe('ACME Renamed');
      expect(acme?.transactionCategoryId).toBe('supermercado');
      expect(acme?.userId).toBe(localUser.id); // seed-owned merchant becomes person-owned (Decision 6)
    } finally {
      sqlite.close();
    }
  });

  it('never overwrites an already-set user_id with a different value (Decision 6, coalesce)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const localUser = db.select().from(users).get() as { id: string };
      insertTestMerchant(db, ports.now(), { id: 'acme', userId: localUser.id });

      saveMerchantProfile(db, { merchantId: 'acme', name: 'ACME', transactionCategoryId: null, userId: 'someone-else' });

      const acme = db.select().from(merchants).where(eq(merchants.id, 'acme')).get();
      expect(acme?.userId).toBe(localUser.id); // unchanged — never replaced
    } finally {
      sqlite.close();
    }
  });
});

/** Implementation plan for issue #14, Testing Strategy scenario 6 (repository half), Decision 13. */
describe('readMerchantEditor (AC4)', () => {
  it('returns undefined for an unresolvable merchantId (Assumption A7)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const snapshot = readMerchantEditor(db, { merchantId: 'no-such-merchant', today: '2026-01-20', locale: 'es' });
      expect(snapshot).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });

  it('assembles one snapshot whose disclosure count equals aliases.length + candidates.length, with a three-month stats window', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      insertTestMerchant(db, now, { id: 'acme', name: 'Acme Corp' });
      db.insert(merchantAliases)
        .values({ id: 'alias-acme', merchantId: 'acme', rawPattern: 'ACME', matchType: 'prefix', matchCount: 0 })
        .run();
      // An unattributed movement whose leading word shares the merchant's own significant word
      // ("ACME") — a real P1 candidate.
      insertTestMovement(db, productId, now, { id: 'candidate-1', rawDescription: 'ACME EXPRESS DELIVERY' });

      const snapshot = readMerchantEditor(db, { merchantId: 'acme', today: '2026-01-20', locale: 'es' });

      expect(snapshot).toBeDefined();
      expect(snapshot?.merchant.name).toBe('Acme Corp');
      expect(snapshot?.stats.months).toHaveLength(3);
      expect(snapshot?.aliases).toHaveLength(1);
      expect(snapshot?.candidates.some((candidate) => candidate.rawPattern === 'ACME EXPRESS')).toBe(true);
      const disclosureCount = (snapshot?.aliases.length ?? 0) + (snapshot?.candidates.length ?? 0);
      expect(disclosureCount).toBe(2); // one "Actual" alias plus one "Agrupar" candidate
    } finally {
      sqlite.close();
    }
  });
});
