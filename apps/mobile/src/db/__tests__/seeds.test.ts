import { eq } from 'drizzle-orm';

import {
  financialInstitutions,
  merchantAliases,
  merchants,
  seedLedger,
  transactionCategories,
} from '../schema';
import { applySeeds } from '../seeds/apply';
import { openBootstrappedMemoryDb, openMigratedMemoryDb } from '../testing/memory-db';

/**
 * Scenarios 1, 2, 3, 17, 18, 19 and the "seed refresh never writes income" half of 29, per the
 * Testing Strategy's test-file table.
 */
describe('seeds', () => {
  it('a fresh bootstrap creates every table and applies all starter content, with no error and no set-up step (AC1)', async () => {
    const { sqlite } = await openBootstrappedMemoryDb();
    try {
      const tableCount = sqlite
        .prepare(
          `SELECT count(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
        )
        .get() as { count: number };
      expect(tableCount.count).toBe(13); // 12 declared tables + __drizzle_migrations
    } finally {
      sqlite.close();
    }
  });

  it('six institutions with exactly one available; sixteen categories with the exact slug set; every merchant has an alias and a default category (AC2)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const institutions = db.select().from(financialInstitutions).all();
      expect(institutions).toHaveLength(6);
      expect(institutions.filter((i) => i.scraperStatus === 'available')).toEqual([
        expect.objectContaining({ id: 'banco-de-chile' }),
      ]);

      const categories = db.select().from(transactionCategories).all();
      expect(categories.map((c) => c.slug).sort()).toEqual(
        [
          'comida',
          'supermercado',
          'transporte',
          'compras',
          'entretenimiento',
          'servicios',
          'salud',
          'educacion',
          'hogar',
          'otros-gasto',
          'sueldo',
          'freelance',
          'ingresos-extra',
          'inversiones',
          'bonos',
          'otros-ingreso',
        ].sort(),
      );

      const merchantRows = db.select().from(merchants).all();
      expect(merchantRows.length).toBeGreaterThanOrEqual(5);
      for (const merchant of merchantRows) {
        expect(merchant.transactionCategoryId).not.toBeNull();
        const aliases = db
          .select()
          .from(merchantAliases)
          .where(eq(merchantAliases.merchantId, merchant.id))
          .all();
        expect(aliases.length).toBeGreaterThanOrEqual(1);
      }
    } finally {
      sqlite.close();
    }
  });

  it('no category row has slug "uncategorized" and none carries the ❓ glyph (AC3)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const categories = db.select().from(transactionCategories).all();
      expect(categories.some((c) => c.slug === 'uncategorized')).toBe(false);
      expect(
        categories.some((c) => c.assets != null && JSON.parse(c.assets).emoji === '❓'),
      ).toBe(false);
    } finally {
      sqlite.close();
    }
  });

  it(
    'a seed refresh over a store with an edited starter category, a deleted starter merchant and ' +
      'person-created rows overwrites nothing, resurrects nothing and duplicates nothing (AC17)',
    async () => {
      const { sqlite, db, ports } = await openBootstrappedMemoryDb();
      try {
        // The person renamed, re-emojied and reordered "comida".
        db.update(transactionCategories)
          .set({
            labels: JSON.stringify({ es: 'Comidita', en: 'Food (edited)' }),
            assets: JSON.stringify({ emoji: '🍕' }),
            sortOrder: 99,
          })
          .where(eq(transactionCategories.id, 'comida'))
          .run();

        // The person deleted the starter "netflix" merchant (and, per the real cascade, its
        // aliases — simulated directly here since Step 7 owns deleteMerchant).
        db.delete(merchantAliases).where(eq(merchantAliases.merchantId, 'netflix')).run();
        db.delete(merchants).where(eq(merchants.id, 'netflix')).run();

        // The person created their own category and merchant (no seed_ledger row for either).
        db.insert(transactionCategories)
          .values({
            id: 'person-category-1',
            slug: 'mascotas',
            income: 0,
            labels: JSON.stringify({ es: 'Mascotas', en: 'Pets' }),
            sortOrder: 11,
            userId: null,
            createdAt: ports.now(),
          })
          .run();
        db.insert(merchants)
          .values({ id: 'person-merchant-1', name: 'Mi tienda', createdAt: ports.now() })
          .run();

        const beforeCategoryCount = db.select().from(transactionCategories).all().length;
        const beforeMerchantCount = db.select().from(merchants).all().length;

        applySeeds(db, ports.now());

        // Nothing overwritten: the edit survives byte-identical.
        const comida = db
          .select()
          .from(transactionCategories)
          .where(eq(transactionCategories.id, 'comida'))
          .get();
        expect(comida?.labels).toBe(JSON.stringify({ es: 'Comidita', en: 'Food (edited)' }));
        expect(comida?.assets).toBe(JSON.stringify({ emoji: '🍕' }));
        expect(comida?.sortOrder).toBe(99);

        // Nothing resurrected: netflix stays deleted.
        const netflix = db.select().from(merchants).where(eq(merchants.id, 'netflix')).get();
        expect(netflix).toBeUndefined();

        // Nothing duplicated: person-created rows survive unchanged and row counts did not grow
        // beyond the untouched starter rows plus the two person-created ones.
        expect(
          db.select().from(transactionCategories).where(eq(transactionCategories.id, 'person-category-1')).get(),
        ).toBeDefined();
        expect(
          db.select().from(merchants).where(eq(merchants.id, 'person-merchant-1')).get(),
        ).toBeDefined();
        expect(db.select().from(transactionCategories).all()).toHaveLength(beforeCategoryCount);
        expect(db.select().from(merchants).all()).toHaveLength(beforeMerchantCount);
      } finally {
        sqlite.close();
      }
    },
  );

  it('re-running the seeds with a starter record missing on this device (ledger row absent) inserts exactly that one row (AC18)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      // Simulate "a later app version added a starter record" from this device's perspective:
      // remove both the entity row and its ledger row for one seed, leaving every other seed's
      // ledger row intact.
      db.delete(financialInstitutions).where(eq(financialInstitutions.id, 'itau')).run();
      db.delete(seedLedger).where(eq(seedLedger.seedKey, 'financial_institution:itau')).run();

      const beforeInstitutionCount = db.select().from(financialInstitutions).all().length;
      expect(beforeInstitutionCount).toBe(5);

      applySeeds(db, ports.now());

      const institutions = db.select().from(financialInstitutions).all();
      expect(institutions).toHaveLength(6);
      const itau = db.select().from(financialInstitutions).where(eq(financialInstitutions.id, 'itau')).get();
      expect(itau).toEqual(
        expect.objectContaining({ id: 'itau', name: 'Banco Itaú', scraperStatus: 'coming_soon' }),
      );
    } finally {
      sqlite.close();
    }
  });

  it('a seed run forced to throw part-way leaves the store exactly as it was before the run (AC19)', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      // Sabotage: pre-insert a category row with a conflicting slug but a different id, bypassing
      // the seeder, so its own insert for 'comida' collides on UNIQUE(slug) partway through the
      // transaction. Institutions are seeded before categories, so this also proves the
      // already-applied institution inserts are rolled back too — the whole run is one
      // transaction (Business Rule 16).
      db.insert(transactionCategories)
        .values({
          id: 'sabotage-conflicting-row',
          slug: 'comida',
          income: 0,
          labels: JSON.stringify({ es: 'Saboteada' }),
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        })
        .run();

      expect(() => applySeeds(db, '2026-01-01T00:00:00.000Z')).toThrow();

      expect(db.select().from(financialInstitutions).all()).toHaveLength(0);
      expect(db.select().from(seedLedger).all()).toHaveLength(0);
      const categoryRows = db.select().from(transactionCategories).all();
      expect(categoryRows).toHaveLength(1);
      expect(categoryRows[0]?.id).toBe('sabotage-conflicting-row');
    } finally {
      sqlite.close();
    }
  });

  it('a seed refresh never writes income, even on the safe-to-correct path (AC29 half)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      // Corrupt income directly (bypassing the seeder entirely) to prove a refresh never
      // touches it, even though the row is otherwise untouched and eligible for correction.
      db.update(transactionCategories)
        .set({ income: 1 })
        .where(eq(transactionCategories.id, 'comida'))
        .run();

      applySeeds(db, ports.now());

      const row = db
        .select()
        .from(transactionCategories)
        .where(eq(transactionCategories.id, 'comida'))
        .get();
      expect(row?.income).toBe(1); // still corrupted — the seeder never wrote it
    } finally {
      sqlite.close();
    }
  });

  it('the sixteen starter categories carry the directions and per-direction orders of the Seed Data Contract (AC29)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const expenseOrder = [
        'comida',
        'supermercado',
        'transporte',
        'compras',
        'entretenimiento',
        'servicios',
        'salud',
        'educacion',
        'hogar',
        'otros-gasto',
      ];
      const incomeOrder = ['sueldo', 'freelance', 'ingresos-extra', 'inversiones', 'bonos', 'otros-ingreso'];

      const categories = db.select().from(transactionCategories).all();
      for (const [index, slug] of expenseOrder.entries()) {
        const row = categories.find((c) => c.slug === slug);
        expect(row?.income).toBe(0);
        expect(row?.sortOrder).toBe(index + 1);
      }
      for (const [index, slug] of incomeOrder.entries()) {
        const row = categories.find((c) => c.slug === slug);
        expect(row?.income).toBe(1);
        expect(row?.sortOrder).toBe(index + 1);
      }
    } finally {
      sqlite.close();
    }
  });
});
