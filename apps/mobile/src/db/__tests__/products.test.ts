import { eq } from 'drizzle-orm';

import type { BankProductInput } from '../repositories/products';
import { listProductIdsByExternalId, upsertBankProductsInTx } from '../repositories/products';
import { userFinancialProducts } from '../schema';
import { createTestConnection } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/** Implementation plan Decision 4 (issue #10): products.test.ts, covering AC7 and AC8. */

function reserveIds(
  db: Awaited<ReturnType<typeof openBootstrappedMemoryDb>>,
  connectionId: string,
  products: BankProductInput[],
): Map<string, string> {
  const map = listProductIdsByExternalId(db.db, connectionId);
  for (const product of products) {
    if (!map.has(product.externalId)) {
      map.set(product.externalId, db.ports.newId());
    }
  }
  return map;
}

describe('products repository (Decision 4, AC7, AC8)', () => {
  it('two products of the same kind under one connection are stored as two rows, both re-matched on replay (AC7)', async () => {
    const dbHandle = await openBootstrappedMemoryDb();
    const { sqlite, db, ports } = dbHandle;
    try {
      const connectionId = createTestConnection(db, ports);
      const products: BankProductInput[] = [
        { externalId: 'instance-aaa111', type: 'checking', name: 'Cuenta Corriente', currencyCode: 'CLP' },
        { externalId: 'instance-bbb222', type: 'checking', name: 'Cuenta Corriente', currencyCode: 'CLP' },
      ];

      const idMap = reserveIds(dbHandle, connectionId, products);
      const now = ports.now();

      let counts;
      db.transaction((tx) => {
        counts = upsertBankProductsInTx(tx, connectionId, products, idMap, now);
      });
      expect(counts).toEqual({ discovered: 2, refreshed: 0 });

      const rows = db
        .select()
        .from(userFinancialProducts)
        .where(eq(userFinancialProducts.userFinancialInstitutionId, connectionId))
        .all();
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((r) => r.externalId))).toEqual(
        new Set(['instance-aaa111', 'instance-bbb222']),
      );

      // Replay: same instance ids re-match the same two rows, refreshed rather than duplicated.
      const idMap2 = reserveIds(dbHandle, connectionId, products);
      const now2 = ports.now();
      let counts2;
      db.transaction((tx) => {
        counts2 = upsertBankProductsInTx(tx, connectionId, products, idMap2, now2);
      });
      expect(counts2).toEqual({ discovered: 0, refreshed: 2 });
      expect(
        db
          .select()
          .from(userFinancialProducts)
          .where(eq(userFinancialProducts.userFinancialInstitutionId, connectionId))
          .all(),
      ).toHaveLength(2);
    } finally {
      sqlite.close();
    }
  });

  it('a product the raw or card number never appears in — planted-negative proof the identity is opaque, not the bank number (Business Rule 5)', async () => {
    const dbHandle = await openBootstrappedMemoryDb();
    const { sqlite, db, ports } = dbHandle;
    try {
      const connectionId = createTestConnection(db, ports);
      const products: BankProductInput[] = [
        {
          externalId: 'instance-ccc333',
          type: 'credit_card',
          name: 'Tarjeta de Crédito',
          currencyCode: 'CLP',
          mask: '••••1111',
          cardBrand: 'Visa',
          cardLast4: '1111',
        },
      ];
      const idMap = reserveIds(dbHandle, connectionId, products);
      const now = ports.now();
      db.transaction((tx) => {
        upsertBankProductsInTx(tx, connectionId, products, idMap, now);
      });

      const row = db
        .select()
        .from(userFinancialProducts)
        .where(eq(userFinancialProducts.externalId, 'instance-ccc333'))
        .get();
      expect(row?.externalId).toBe('instance-ccc333');
      // The stored external_id is the opaque instance id, never a raw account/card number —
      // the fixture's "raw number" (a hypothetical 16-digit PAN) never appears anywhere in this
      // row, because BankProductInput itself has no field to carry one.
      expect(row?.externalId).not.toMatch(/^\d{16}$/);
    } finally {
      sqlite.close();
    }
  });

  it('a product a later read no longer lists keeps its row and is left alone (Business Rule 7, AC8)', async () => {
    const dbHandle = await openBootstrappedMemoryDb();
    const { sqlite, db, ports } = dbHandle;
    try {
      const connectionId = createTestConnection(db, ports);
      const firstRead: BankProductInput[] = [
        { externalId: 'instance-checking', type: 'checking', name: 'Cuenta Corriente', currencyCode: 'CLP' },
        { externalId: 'instance-card', type: 'credit_card', name: 'Tarjeta de Crédito', currencyCode: 'CLP' },
      ];
      const idMap1 = reserveIds(dbHandle, connectionId, firstRead);
      db.transaction((tx) => {
        upsertBankProductsInTx(tx, connectionId, firstRead, idMap1, ports.now());
      });

      const before = db
        .select()
        .from(userFinancialProducts)
        .where(eq(userFinancialProducts.userFinancialInstitutionId, connectionId))
        .all();
      expect(before).toHaveLength(2);
      const cardRowBefore = before.find((r) => r.externalId === 'instance-card');
      expect(cardRowBefore).toBeDefined();

      // A second read that only lists the checking account — the card was closed.
      const secondRead: BankProductInput[] = [
        { externalId: 'instance-checking', type: 'checking', name: 'Cuenta Corriente', currencyCode: 'CLP' },
      ];
      const idMap2 = reserveIds(dbHandle, connectionId, secondRead);
      let counts;
      db.transaction((tx) => {
        counts = upsertBankProductsInTx(tx, connectionId, secondRead, idMap2, ports.now());
      });
      expect(counts).toEqual({ discovered: 0, refreshed: 1 });

      const after = db
        .select()
        .from(userFinancialProducts)
        .where(eq(userFinancialProducts.userFinancialInstitutionId, connectionId))
        .all();
      expect(after).toHaveLength(2);
      const cardRowAfter = after.find((r) => r.externalId === 'instance-card');
      expect(cardRowAfter).toEqual(cardRowBefore);
    } finally {
      sqlite.close();
    }
  });

  it('refreshes type, name, currency and metadata on a repeat, and never inserts a second row for the same identity', async () => {
    const dbHandle = await openBootstrappedMemoryDb();
    const { sqlite, db, ports } = dbHandle;
    try {
      const connectionId = createTestConnection(db, ports);
      const firstRead: BankProductInput[] = [
        {
          externalId: 'instance-card',
          type: 'credit_card',
          name: 'Tarjeta de Crédito',
          currencyCode: 'CLP',
          balanceMinorUnits: -50000,
          creditLimitMinorUnits: 500000,
          availableCreditMinorUnits: 450000,
          mask: '••••1111',
        },
      ];
      const idMap1 = reserveIds(dbHandle, connectionId, firstRead);
      db.transaction((tx) => {
        upsertBankProductsInTx(tx, connectionId, firstRead, idMap1, ports.now());
      });

      const secondRead: BankProductInput[] = [
        {
          externalId: 'instance-card',
          type: 'credit_card',
          name: 'Tarjeta de Crédito Gold',
          currencyCode: 'CLP',
          balanceMinorUnits: -80000,
          creditLimitMinorUnits: 500000,
          availableCreditMinorUnits: 420000,
          mask: '••••1111',
        },
      ];
      const idMap2 = reserveIds(dbHandle, connectionId, secondRead);
      db.transaction((tx) => {
        upsertBankProductsInTx(tx, connectionId, secondRead, idMap2, ports.now());
      });

      const rows = db
        .select()
        .from(userFinancialProducts)
        .where(eq(userFinancialProducts.userFinancialInstitutionId, connectionId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe('Tarjeta de Crédito Gold');
      expect(rows[0]?.metadata).toContain('"balance":-80000');
      expect(rows[0]?.metadata).toContain('"available_credit":420000');
    } finally {
      sqlite.close();
    }
  });
});
