import { eq } from 'drizzle-orm';

import type { Merchant, MerchantAlias, MerchantMatchType } from '@finanzas/shared-domain';
import { resolveMerchant, suggestCategory } from '@finanzas/shared-domain';

import { merchantAliases, merchants, transactions } from '../schema';
import type { AppDatabase } from '../types';
import type { MovementEnricher, MovementEnrichment } from './transactions';

/**
 * `merchants` repository (implementation plan Layer-by-Layer, spec Business Rule 21, AC10, AC22;
 * issue #10 Decision 7, Business Rules 18-20, AC16-AC20).
 *
 * There is no `deleteTransaction` export anywhere in `src/db` (Business Rule 5, AC22) — a
 * movement is never deleted, only excluded. `deleteMerchant` reflects the same asymmetry on the
 * merchant side: its aliases go with it (`merchant_aliases.merchant_id` is
 * `ON DELETE CASCADE`), but every movement that named it survives and simply stops naming a
 * merchant.
 */
export function deleteMerchant(db: AppDatabase, merchantId: string): void {
  db.transaction((tx: AppDatabase) => {
    // `transactions.merchant_id` has no `ON DELETE` action, so with `PRAGMA foreign_keys = ON`
    // (Decision 5) the merchant row cannot be deleted while a movement still references it —
    // this update must run first, inside the same transaction, so the operation is indivisible.
    tx.update(transactions)
      .set({ merchantId: null })
      .where(eq(transactions.merchantId, merchantId))
      .run();
    // `merchant_aliases` cascades via its own foreign key (`ON DELETE CASCADE`).
    tx.delete(merchants).where(eq(merchants.id, merchantId)).run();
  });
}

export interface MerchantMatchingSet {
  merchants: Merchant[];
  aliases: MerchantAlias[];
}

/**
 * Loads every merchant and every alias, in `@finanzas/shared-domain` shapes, for the sync
 * engine's enrichment step (Decision 7). Loaded once per sync — not per movement — because a
 * sync's read can carry hundreds of movements against the same small catalogue.
 *
 * `isUserDefined = user_id !== null` is the schema's own "null = seeded; set = created by the
 * person" distinction (Conflict 4's resolution) — the only signal that separates an `auto`
 * suggestion from a `rule` one without a new column.
 */
export function loadMerchantMatchingSet(db: AppDatabase): MerchantMatchingSet {
  const merchantRows = db
    .select({
      id: merchants.id,
      name: merchants.name,
      transactionCategoryId: merchants.transactionCategoryId,
      userId: merchants.userId,
    })
    .from(merchants)
    .all() as { id: string; name: string; transactionCategoryId: string | null; userId: string | null }[];

  const aliasRows = db
    .select({
      id: merchantAliases.id,
      merchantId: merchantAliases.merchantId,
      rawPattern: merchantAliases.rawPattern,
      matchType: merchantAliases.matchType,
    })
    .from(merchantAliases)
    .all() as { id: string; merchantId: string; rawPattern: string; matchType: string }[];

  return {
    merchants: merchantRows.map((row) => ({
      id: row.id,
      name: row.name,
      transactionCategoryId: row.transactionCategoryId,
      isUserDefined: row.userId !== null,
    })),
    aliases: aliasRows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      rawPattern: row.rawPattern,
      matchType: row.matchType as MerchantMatchType,
    })),
  };
}

/**
 * Builds the `MovementEnricher` the sync engine passes to `writeBankTransactionsInTx` (Decision
 * 7, spec Business Rules 18-20). Resolves a merchant once per description via `resolveMerchant`,
 * then asks `suggestCategory` for its default category with `currentCategorySource: null` — the
 * only value this call site ever passes, because enrichment only ever runs on the insert branch
 * (a movement being inserted has no prior category source). `suggestCategory` therefore only
 * ever returns `'auto'` or `'rule'`, never `'user'` (AC17, AC20): `'user'` is unreachable from
 * this code path by construction, not by a runtime check.
 *
 * A match with no default category still sets `merchantId` — Business Rule 18 records the
 * category "when the merchant … carries a default category"; the merchant itself is recognised
 * either way. No match sets neither (AC18).
 */
export function createMovementEnricher(matchingSet: MerchantMatchingSet): MovementEnricher {
  const merchantsById = new Map(matchingSet.merchants.map((merchant) => [merchant.id, merchant]));

  return (rawDescription: string): MovementEnrichment => {
    const match = resolveMerchant(rawDescription, matchingSet.aliases);
    const merchant = match ? (merchantsById.get(match.merchantId) ?? null) : null;
    const suggestion = suggestCategory({ currentCategorySource: null, merchant });

    return {
      merchantId: merchant ? merchant.id : null,
      transactionCategoryId: suggestion ? suggestion.transactionCategoryId : null,
      // `suggestion.source` is typed as the broader `CategorySource` ('auto' | 'rule' | 'user'),
      // but `currentCategorySource: null` above makes `suggestCategory` return only 'auto' or
      // 'rule' by construction — never 'user' (AC17, AC20).
      categorySource: suggestion ? (suggestion.source as 'auto' | 'rule') : null,
    };
  };
}
