import { eq } from 'drizzle-orm';

import { categorySeedId } from '../ids';
import { parseAssets, parseCategoryLabels, parseInstitutionMetadata } from '../json';
import {
  financialInstitutions,
  merchantAliases,
  merchants,
  seedLedger,
  transactionCategories,
} from '../schema';
import type { AppDatabase } from '../types';
import {
  buildCatalogue,
  type FinancialInstitutionSeed,
  type MerchantAliasSeed,
  type MerchantSeed,
  type SeedEntityType,
  type TransactionCategorySeed,
} from './catalogue';

/**
 * The ledger algorithm, applied to every seed record (implementation plan Decision 10). The
 * whole run is one transaction (spec Business Rule 16, AC19). Per seed record:
 *
 * 1. **No ledger row** → never applied on this device → insert the entity row and the ledger
 *    row (fresh install, AC1/AC2; a later app version's new starter record, AC18).
 * 2. **Ledger row exists, entity row missing** → the person deleted it → do nothing. The ledger
 *    row stays, so no later run resurrects it (Business Rule 15, AC17).
 * 3. **Ledger row exists, entity row present, current seed-owned values match `seeded_hash`** →
 *    untouched by the person → update it to the current catalogue values and refresh
 *    `seeded_hash` (lets a corrected `categoryLabels.en` reach existing users).
 * 4. **Ledger row exists, entity row present, hash differs** → the person edited it → do
 *    nothing, and do not refresh `seeded_hash` (Business Rule 15, AC17).
 *
 * `seeded_hash` is a deterministic canonical JSON serialisation of the seed-owned field values
 * (not a cryptographic digest — nothing here needs one, and every SQLite driver this app uses is
 * `'sync'`, so this stays synchronous and needs no `digestSha256` port). `transaction_categories.income`
 * is never part of a category's seed-owned values, so a catalogue correction can never flip an
 * existing category's direction (AC29). `merchant_aliases.match_count` is never part of a
 * merchant alias's seed-owned values either — it is a runtime-mutated counter a later item
 * increments; resetting it on every refresh would destroy usage data.
 */

function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

interface SeedRecordParams {
  tx: AppDatabase;
  seedKey: string;
  entityType: SeedEntityType;
  computeEntityId: () => string;
  seedOwnedValues: Record<string, unknown>;
  now: string;
  /** Returns the seed-owned values as currently stored, or `undefined` if the entity row is
   * missing (the person deleted it). */
  findCurrentSeedOwnedValues: (entityId: string) => Record<string, unknown> | undefined;
  insertEntity: (entityId: string) => void;
  updateEntity: (entityId: string) => void;
}

function applySeedRecord(params: SeedRecordParams): void {
  const { tx } = params;
  const ledgerRow = tx
    .select()
    .from(seedLedger)
    .where(eq(seedLedger.seedKey, params.seedKey))
    .get();

  if (!ledgerRow) {
    const entityId = params.computeEntityId();
    params.insertEntity(entityId);
    tx.insert(seedLedger)
      .values({
        seedKey: params.seedKey,
        entityType: params.entityType,
        entityId,
        seededHash: canonicalize(params.seedOwnedValues),
        createdAt: params.now,
        updatedAt: params.now,
      })
      .run();
    return;
  }

  const current = params.findCurrentSeedOwnedValues(ledgerRow.entityId);
  if (!current) return; // Deleted by the person — never resurrect (Business Rule 15).

  if (canonicalize(current) !== ledgerRow.seededHash) return; // Edited — never overwrite.

  params.updateEntity(ledgerRow.entityId);
  tx.update(seedLedger)
    .set({ seededHash: canonicalize(params.seedOwnedValues), updatedAt: params.now })
    .where(eq(seedLedger.seedKey, params.seedKey))
    .run();
}

function applyInstitutionSeed(tx: AppDatabase, seed: FinancialInstitutionSeed, now: string): void {
  const seedOwnedValues = {
    countryCode: seed.countryCode,
    name: seed.name,
    assets: seed.assets,
    metadata: seed.metadata,
    scraperStatus: seed.scraperStatus,
  };

  applySeedRecord({
    tx,
    seedKey: seed.seedKey,
    entityType: 'financial_institution',
    computeEntityId: () => seed.id,
    seedOwnedValues,
    now,
    findCurrentSeedOwnedValues: (entityId) => {
      const row = tx
        .select()
        .from(financialInstitutions)
        .where(eq(financialInstitutions.id, entityId))
        .get() as
        | {
            countryCode: string;
            name: string;
            assets: string | null;
            metadata: string | null;
            scraperStatus: string;
          }
        | undefined;
      if (!row) return undefined;
      return {
        countryCode: row.countryCode,
        name: row.name,
        assets: parseAssets(row.assets),
        metadata: parseInstitutionMetadata(row.metadata),
        scraperStatus: row.scraperStatus,
      };
    },
    insertEntity: (entityId) => {
      tx.insert(financialInstitutions)
        .values({
          id: entityId,
          countryCode: seed.countryCode,
          name: seed.name,
          assets: JSON.stringify(seed.assets),
          metadata: JSON.stringify(seed.metadata),
          scraperStatus: seed.scraperStatus,
        })
        .run();
    },
    updateEntity: (entityId) => {
      tx.update(financialInstitutions)
        .set({
          countryCode: seed.countryCode,
          name: seed.name,
          assets: JSON.stringify(seed.assets),
          metadata: JSON.stringify(seed.metadata),
          scraperStatus: seed.scraperStatus,
        })
        .where(eq(financialInstitutions.id, entityId))
        .run();
    },
  });
}

function applyCategorySeed(tx: AppDatabase, seed: TransactionCategorySeed, now: string): void {
  // `income` is deliberately excluded — a catalogue correction must never flip an existing
  // category's direction (spec Seed Data Contract, AC29).
  const seedOwnedValues = {
    labels: seed.labels,
    assets: seed.assets,
    sortOrder: seed.sortOrder,
  };

  applySeedRecord({
    tx,
    seedKey: seed.seedKey,
    entityType: 'transaction_category',
    computeEntityId: () => seed.id,
    seedOwnedValues,
    now,
    findCurrentSeedOwnedValues: (entityId) => {
      const row = tx
        .select()
        .from(transactionCategories)
        .where(eq(transactionCategories.id, entityId))
        .get() as
        | { labels: string; assets: string | null; sortOrder: number }
        | undefined;
      if (!row) return undefined;
      return {
        labels: parseCategoryLabels(row.labels),
        assets: parseAssets(row.assets),
        sortOrder: row.sortOrder,
      };
    },
    insertEntity: (entityId) => {
      tx.insert(transactionCategories)
        .values({
          id: entityId,
          slug: seed.slug,
          income: seed.income,
          labels: JSON.stringify(seed.labels),
          assets: JSON.stringify(seed.assets),
          userId: null,
          parentCategoryId: null,
          sortOrder: seed.sortOrder,
          createdAt: now,
        })
        .run();
    },
    updateEntity: (entityId) => {
      tx.update(transactionCategories)
        .set({
          labels: JSON.stringify(seed.labels),
          assets: JSON.stringify(seed.assets),
          sortOrder: seed.sortOrder,
        })
        .where(eq(transactionCategories.id, entityId))
        .run();
    },
  });
}

function applyMerchantSeed(tx: AppDatabase, seed: MerchantSeed, now: string): void {
  const transactionCategoryId = categorySeedId(seed.defaultCategorySlug);
  const seedOwnedValues = {
    name: seed.name,
    countryCode: seed.countryCode,
    transactionCategoryId,
  };

  applySeedRecord({
    tx,
    seedKey: seed.seedKey,
    entityType: 'merchant',
    computeEntityId: () => seed.id,
    seedOwnedValues,
    now,
    findCurrentSeedOwnedValues: (entityId) => {
      const row = tx.select().from(merchants).where(eq(merchants.id, entityId)).get() as
        | { name: string; countryCode: string | null; transactionCategoryId: string | null }
        | undefined;
      if (!row) return undefined;
      return {
        name: row.name,
        countryCode: row.countryCode,
        transactionCategoryId: row.transactionCategoryId,
      };
    },
    insertEntity: (entityId) => {
      tx.insert(merchants)
        .values({
          id: entityId,
          name: seed.name,
          assets: null,
          transactionCategoryId,
          countryCode: seed.countryCode,
          userId: null,
          createdAt: now,
        })
        .run();
    },
    updateEntity: (entityId) => {
      tx.update(merchants)
        .set({ name: seed.name, countryCode: seed.countryCode, transactionCategoryId })
        .where(eq(merchants.id, entityId))
        .run();
    },
  });
}

function applyMerchantAliasSeed(tx: AppDatabase, seed: MerchantAliasSeed, now: string): void {
  // `matchCount` is deliberately excluded — it is a runtime-mutated counter a later item
  // increments; resetting it on every refresh would destroy usage data.
  const seedOwnedValues = { rawPattern: seed.rawPattern, matchType: seed.matchType };
  const merchantId = seed.merchantSlug; // merchantSeedId(slug) === slug (Decision 11).

  applySeedRecord({
    tx,
    seedKey: seed.seedKey,
    entityType: 'merchant_alias',
    computeEntityId: () => seed.id,
    seedOwnedValues,
    now,
    findCurrentSeedOwnedValues: (entityId) => {
      const row = tx
        .select()
        .from(merchantAliases)
        .where(eq(merchantAliases.id, entityId))
        .get() as { rawPattern: string; matchType: string } | undefined;
      if (!row) return undefined;
      return { rawPattern: row.rawPattern, matchType: row.matchType };
    },
    insertEntity: (entityId) => {
      tx.insert(merchantAliases)
        .values({
          id: entityId,
          merchantId,
          rawPattern: seed.rawPattern,
          matchType: seed.matchType,
        })
        .run();
    },
    updateEntity: (entityId) => {
      tx.update(merchantAliases)
        .set({ rawPattern: seed.rawPattern, matchType: seed.matchType })
        .where(eq(merchantAliases.id, entityId))
        .run();
    },
  });
}

export function applySeeds(db: AppDatabase, now: string): void {
  const catalogue = buildCatalogue();

  db.transaction((tx: AppDatabase) => {
    for (const seed of catalogue.financialInstitutions) applyInstitutionSeed(tx, seed, now);
    for (const seed of catalogue.transactionCategories) applyCategorySeed(tx, seed, now);
    for (const seed of catalogue.merchants) applyMerchantSeed(tx, seed, now);
    for (const seed of catalogue.merchantAliases) applyMerchantAliasSeed(tx, seed, now);
  });
}
