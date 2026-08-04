import { and, asc, eq } from 'drizzle-orm';

import { mergeProductMetadata, type ProductMetadata } from '../json';
import { userFinancialProducts } from '../schema';
import type { AppDatabase, UserProduct } from '../types';

/**
 * `user_financial_products` repository (implementation plan Decision 4, Layer-by-Layer; spec
 * Business Rules 5-8; AC7, AC8).
 *
 * A product is recognised across reads by the scraper's opaque per-instance identity
 * (`ScrapedProduct.instanceId`), stored verbatim in `external_id` — never the product kind, never
 * a raw account/card number (Business Rule 5, Conflict 3). Everything the bank reports about a
 * product is refreshed on every sync (Business Rule 6); nothing about a product is the person's
 * to decide in the MVP (Assumption A4), so a refresh overwrites no decision. There is no delete
 * path here: a product a later read does not list keeps its row and every movement attached to it
 * (Business Rule 7, AC8).
 */

/** What a recorded read carries per product, before identity resolution (Decision 4). Money
 * fields are minor units; `mask` is the read's `maskedIdentifier` verbatim (Assumption A3). */
export interface BankProductInput {
  externalId: string;
  type: string;
  name: string;
  currencyCode: string;
  mask?: string;
  balanceMinorUnits?: number;
  creditLimitMinorUnits?: number;
  availableCreditMinorUnits?: number;
  cardBrand?: string;
  cardCategory?: string;
  cardLast4?: string;
}

export interface BankProductWriteCounts {
  discovered: number;
  refreshed: number;
}

/**
 * Phase A's id resolution (Decision 5, step 1): the ids of every product already stored under
 * this connection, keyed by the read's instance identity (`external_id`). A product the read
 * reports that is **not** in this map is a new product; the caller reserves an id for it with
 * `ports.newId()` before hashing any of its movements, because `dedup_hash` folds in the product
 * id (issue #10's `dedup.ts` Decision 1) and a brand-new product has no id yet.
 */
export function listProductIdsByExternalId(
  db: AppDatabase,
  userFinancialInstitutionId: string,
): Map<string, string> {
  const rows = db
    .select({ id: userFinancialProducts.id, externalId: userFinancialProducts.externalId })
    .from(userFinancialProducts)
    .where(eq(userFinancialProducts.userFinancialInstitutionId, userFinancialInstitutionId))
    .all() as { id: string; externalId: string }[];
  return new Map(rows.map((row) => [row.externalId, row.id]));
}

function buildMetadataPatch(product: BankProductInput): Partial<ProductMetadata> {
  const patch: Partial<ProductMetadata> = {};
  if (product.mask !== undefined) patch.mask = product.mask;
  if (product.balanceMinorUnits !== undefined) patch.balance = product.balanceMinorUnits;
  if (product.creditLimitMinorUnits !== undefined) patch.credit_limit = product.creditLimitMinorUnits;
  if (product.availableCreditMinorUnits !== undefined) {
    patch.available_credit = product.availableCreditMinorUnits;
  }
  if (product.cardBrand !== undefined) patch.card_brand = product.cardBrand;
  if (product.cardCategory !== undefined) patch.card_category = product.cardCategory;
  if (product.cardLast4 !== undefined) patch.card_last4 = product.cardLast4;
  return patch;
}

/**
 * Phase B (Decision 5): products upsert, run inside the caller's transaction. `productIdByExternalId`
 * is the total map Phase A built — every product this call is given already has a reserved id in
 * it, whether that id came from an existing row or was freshly generated. Existence is decided
 * independently, by a fresh lookup inside this transaction (the same shape as
 * `writeBankTransactionsInTx`'s lookup), not by trusting which ids were "new" in the caller's map
 * — so this function's own bookkeeping (`discovered` vs `refreshed`) can never drift from what it
 * actually wrote.
 *
 * Refreshes `type`, `name`, `currency_code`, `metadata` (through `mergeProductMetadata`, so the
 * money guards run on every write) and `updated_at`. There is no `DELETE` anywhere in this file —
 * a product the read no longer lists is simply never visited (Business Rule 7, AC8).
 */
export function upsertBankProductsInTx(
  tx: AppDatabase,
  userFinancialInstitutionId: string,
  products: BankProductInput[],
  productIdByExternalId: Map<string, string>,
  now: string,
): BankProductWriteCounts {
  let discovered = 0;
  let refreshed = 0;

  for (const product of products) {
    const id = productIdByExternalId.get(product.externalId);
    if (id === undefined) {
      throw new Error(
        `upsertBankProductsInTx: no reserved id for external id "${product.externalId}" — Phase A must reserve an id for every product before this runs`,
      );
    }

    const existing = tx
      .select({ id: userFinancialProducts.id, metadata: userFinancialProducts.metadata })
      .from(userFinancialProducts)
      .where(
        and(
          eq(userFinancialProducts.userFinancialInstitutionId, userFinancialInstitutionId),
          eq(userFinancialProducts.externalId, product.externalId),
        ),
      )
      .get() as { id: string; metadata: string | null } | undefined;

    const metadata = mergeProductMetadata(existing?.metadata ?? null, buildMetadataPatch(product));

    if (existing) {
      refreshed += 1;
      tx.update(userFinancialProducts)
        .set({
          type: product.type,
          name: product.name,
          currencyCode: product.currencyCode,
          metadata,
          updatedAt: now,
        })
        .where(eq(userFinancialProducts.id, existing.id))
        .run();
    } else {
      discovered += 1;
      tx.insert(userFinancialProducts)
        .values({
          id,
          userFinancialInstitutionId,
          externalId: product.externalId,
          type: product.type,
          name: product.name,
          currencyCode: product.currencyCode,
          metadata,
          updatedAt: now,
        })
        .run();
    }
  }

  return { discovered, refreshed };
}

/**
 * Spec "What are every one of my products, across every connection?" (`transactions`, Assumption
 * A6) — drives the **Producto** filter pills, one per row, ordered by name. Not scoped to a
 * single connection: the sheet's pills describe every product the person has, not one bank's.
 */
export function listUserProducts(db: AppDatabase): UserProduct[] {
  const rows = db
    .select({
      id: userFinancialProducts.id,
      name: userFinancialProducts.name,
      type: userFinancialProducts.type,
    })
    .from(userFinancialProducts)
    .orderBy(asc(userFinancialProducts.name))
    .all() as UserProduct[];
  return rows;
}
