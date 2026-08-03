import { eq } from 'drizzle-orm';

import { createMovementEnricher, loadMerchantMatchingSet } from '../repositories/merchants';
import { countUncategorized, upsertBankTransactions } from '../repositories/transactions';
import { merchantAliases, merchants, transactions, users } from '../schema';
import { createTestConnection, createTestProduct } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/**
 * Implementation plan Decision 7 (issue #10): enrichment on insert only, spec Business Rules
 * 18-20; AC16-AC20.
 */

describe('movement enrichment on first storage (Decision 7)', () => {
  it('a description matching a starter merchant alias stores that merchant and its default category, marked auto (AC16)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const enricher = createMovementEnricher(loadMerchantMatchingSet(db));

      await upsertBankTransactions(
        db,
        productId,
        [
          {
            amount: 4200,
            type: 'debit',
            occurredAt: '2026-02-01T12:00:00.000Z',
            dateLocal: '2026-02-01',
            rawDescription: 'LIDER',
          },
        ],
        ports,
        enricher,
      );

      const row = db.select().from(transactions).where(eq(transactions.rawDescription, 'LIDER')).get();
      expect(row?.merchantId).toBe('lider');
      expect(row?.transactionCategoryId).toBe('supermercado');
      expect(row?.categorySource).toBe('auto');
    } finally {
      sqlite.close();
    }
  });

  it('the same description, when the matching merchant is person-created, is marked rule (AC17)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();
      const owner = db.select().from(users).get();
      expect(owner).toBeDefined();

      db.insert(merchants)
        .values({
          id: 'mi-tienda',
          name: 'Mi Tienda',
          transactionCategoryId: 'comida',
          userId: owner?.id,
          createdAt: now,
        })
        .run();
      db.insert(merchantAliases)
        .values({ id: 'mi-tienda:MITIENDA', merchantId: 'mi-tienda', rawPattern: 'MITIENDA', matchType: 'prefix' })
        .run();

      const enricher = createMovementEnricher(loadMerchantMatchingSet(db));

      await upsertBankTransactions(
        db,
        productId,
        [
          {
            amount: 1500,
            type: 'debit',
            occurredAt: '2026-02-02T12:00:00.000Z',
            dateLocal: '2026-02-02',
            rawDescription: 'MITIENDA CENTRO',
          },
        ],
        ports,
        enricher,
      );

      const row = db.select().from(transactions).where(eq(transactions.rawDescription, 'MITIENDA CENTRO')).get();
      expect(row?.merchantId).toBe('mi-tienda');
      expect(row?.transactionCategoryId).toBe('comida');
      expect(row?.categorySource).toBe('rule');
    } finally {
      sqlite.close();
    }
  });

  it('a description matching no merchant stores neither merchant nor category, and counts toward countUncategorized (AC18)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const enricher = createMovementEnricher(loadMerchantMatchingSet(db));

      const before = countUncategorized(db);

      await upsertBankTransactions(
        db,
        productId,
        [
          {
            amount: 2200,
            type: 'debit',
            occurredAt: '2026-02-03T12:00:00.000Z',
            dateLocal: '2026-02-03',
            rawDescription: 'DESCRIPCION-QUE-NO-MATCHEA-NADA',
          },
        ],
        ports,
        enricher,
      );

      const row = db
        .select()
        .from(transactions)
        .where(eq(transactions.rawDescription, 'DESCRIPCION-QUE-NO-MATCHEA-NADA'))
        .get();
      expect(row?.merchantId).toBeNull();
      expect(row?.transactionCategoryId).toBeNull();
      expect(row?.categorySource).toBeNull();
      expect(countUncategorized(db)).toBe(before + 1);
    } finally {
      sqlite.close();
    }
  });

  it('a movement stored without a merchant is never enriched by a later sync, even after a matching merchant is created (AC19)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const enricher = createMovementEnricher(loadMerchantMatchingSet(db));

      const description = 'NUEVA TIENDA SIN MATCH';
      const input = [
        {
          externalId: 'ext-ac19',
          amount: 3300,
          type: 'debit' as const,
          occurredAt: '2026-02-04T12:00:00.000Z',
          dateLocal: '2026-02-04',
          rawDescription: description,
        },
      ];

      await upsertBankTransactions(db, productId, input, ports, enricher);

      const beforeMatchCreated = db
        .select()
        .from(transactions)
        .where(eq(transactions.externalId, 'ext-ac19'))
        .get();
      expect(beforeMatchCreated?.merchantId).toBeNull();

      // A matching merchant is created *after* the movement was stored.
      const now = ports.now();
      const owner = db.select().from(users).get();
      db.insert(merchants)
        .values({ id: 'nueva-tienda', name: 'Nueva Tienda', transactionCategoryId: 'comida', userId: owner?.id, createdAt: now })
        .run();
      db.insert(merchantAliases)
        .values({ id: 'nueva-tienda:NUEVA', merchantId: 'nueva-tienda', rawPattern: 'NUEVA', matchType: 'prefix' })
        .run();

      // Replay the same read — a fresh enricher built from the now-updated catalogue must still
      // never touch the already-stored row, because enrichment only runs on the insert branch.
      const freshEnricher = createMovementEnricher(loadMerchantMatchingSet(db));
      await upsertBankTransactions(db, productId, input, ports, freshEnricher);

      const afterMatchCreated = db
        .select()
        .from(transactions)
        .where(eq(transactions.externalId, 'ext-ac19'))
        .get();
      expect(afterMatchCreated?.merchantId).toBeNull();
      expect(afterMatchCreated?.transactionCategoryId).toBeNull();
      expect(afterMatchCreated?.categorySource).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('a sync never writes category_source = "user" — the set of user-sourced rows never grows from a sync (AC20)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports);
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      // A person-confirmed row, planted before any sync runs.
      db.insert(transactions)
        .values({
          id: 'user-confirmed',
          userFinancialProductId: productId,
          externalId: 'ext-user-confirmed',
          dedupHash: 'dedup-user-confirmed',
          amount: 5000,
          type: 'debit',
          occurredAt: now,
          dateLocal: '2026-02-05',
          rawDescription: 'LIDER',
          transactionCategoryId: 'comida',
          categorySource: 'user',
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const enricher = createMovementEnricher(loadMerchantMatchingSet(db));

      // Replay including the same external id (refresh branch) plus new movements matching a
      // starter merchant (insert branch) — neither path may ever produce category_source 'user'.
      await upsertBankTransactions(
        db,
        productId,
        [
          {
            externalId: 'ext-user-confirmed',
            amount: 5000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-05',
            rawDescription: 'LIDER',
          },
          {
            amount: 6000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-06',
            rawDescription: 'JUMBO',
          },
        ],
        ports,
        enricher,
      );

      const userSourced = db.select().from(transactions).where(eq(transactions.categorySource, 'user')).all();
      expect(userSourced.map((r) => r.id)).toEqual(['user-confirmed']);
      expect(userSourced[0]?.transactionCategoryId).toBe('comida');

      const allRows = db.select().from(transactions).all();
      expect(allRows.every((r) => r.categorySource !== 'user' || r.id === 'user-confirmed')).toBe(true);
    } finally {
      sqlite.close();
    }
  });
});
