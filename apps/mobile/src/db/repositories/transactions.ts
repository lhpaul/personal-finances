import { deriveDateLocal } from '@finanzas/shared-utils';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SelectedFields,
  type SQL,
} from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import { assignOccurrenceIndexes, buildDedupInput } from '../dedup';
import { includedAmount, isIncluded, isPesoDenominated } from '../fragments';
import type { DbPorts } from '../ids';
import { mergeTransactionMetadata, parseAssets, parseCategoryLabels, parseProductMetadata } from '../json';
import type { SupportedLocale } from '../labels';
import { resolveLabel } from '../labels';
import { assertPositiveMinorUnits, canonicalizeCurrencyCode } from '../money';
import { merchants, transactionCategories, transactions, userFinancialProducts } from '../schema';
import type {
  AppDatabase,
  DirectionCategoryTotal,
  DirectionDayTotal,
  ManualTransactionInput,
  MonthCount,
  ProductSummary,
  RecentMovement,
  StageMovement,
  Transaction,
  TransactionContext,
  TransactionListCursor,
  TransactionListPage,
  TransactionListQueryParams,
  TransactionListRow,
  TransactionPageParams,
} from '../types';

/**
 * `transactions` repository (implementation plan Decision 15 (#3) and Decisions 1, 5-7, 9, 15
 * (#10); spec Business Rules 4, 6-10, 12-15, 17-21; AC1-AC6, AC14-AC22).
 *
 * There is no `deleteTransaction` export anywhere in this file or in `src/db` (Business Rule 15,
 * AC21) — a movement is never deleted, only excluded.
 *
 * The upsert is split into two phases (issue #10 Decision 5), because `db.transaction(...)`'s
 * callback in this codebase's `'sync'` drivers cannot `await`, while hashing
 * (`ports.digestSha256`) is asynchronous:
 *
 * - {@link prepareBankTransactions} — Phase A, async, no writes: validates every amount, assigns
 *   occurrence indexes (Decision 2) and computes every dedup hash.
 * - {@link writeBankTransactionsInTx} — Phase B, synchronous, runs inside a caller-supplied
 *   transaction: the lookup-then-upsert loop, with enrichment computed on the insert branch only
 *   (Decision 7).
 * - {@link upsertBankTransactions} — the public wrapper, unchanged in shape from issue #3, that
 *   opens its own transaction around the same in-transaction writer. Item #3's existing tests
 *   keep passing unchanged.
 */

/** What a recorded bank response carries per movement, before dedup and identity are resolved.
 * `externalId` is absent/`null` for a bank that supplies no identifier. */
export interface BankTransactionInput {
  externalId?: string | null;
  amount: number;
  type: 'debit' | 'credit';
  currencyCode?: string;
  occurredAt: string;
  dateLocal: string;
  rawDescription: string;
  metadata?: Record<string, unknown>;
}

/**
 * What {@link prepareBankTransactions} resolves per row, before the transaction opens (Decision
 * 5's Phase A). Opaque to callers outside this file — `writeBankTransactionsInTx` is the only
 * consumer.
 */
export interface PreparedBankTransaction {
  row: BankTransactionInput;
  id: string;
  dedupHash: string;
}

/**
 * The insert-only enrichment a sync computes once, on first storage (Decision 7, spec Business
 * Rules 18-20). `categorySource` is `null` exactly when `merchantId` matched nothing or the
 * matched merchant carries no default category (AC18) — `'user'` is unreachable from this shape
 * (AC17, AC20).
 */
export interface MovementEnrichment {
  merchantId: string | null;
  transactionCategoryId: string | null;
  categorySource: 'auto' | 'rule' | null;
}

/** Resolves the enrichment for one movement's raw description, on the insert branch only. */
export type MovementEnricher = (rawDescription: string) => MovementEnrichment;

const NO_ENRICHMENT: MovementEnrichment = {
  merchantId: null,
  transactionCategoryId: null,
  categorySource: null,
};

export interface BankTransactionWriteCounts {
  storedFirstTime: number;
  alreadyKnown: number;
}

/**
 * A structural defect in what a read reported (issue #10 Decision 6, spec Business Rule 12,
 * Decision 8, AC15): an amount that is not a whole positive number of minor units, or a movement
 * whose product cannot be resolved (Assumption A5). Carries the offending field name and row
 * index only — never the value and never the description (Business Rules 3, 30) — so a caught
 * instance is always safe to fold into a recorded failure message.
 */
export class MovementValidationError extends Error {
  readonly field: string;
  readonly rowIndex: number | undefined;

  constructor(field: string, rowIndex?: number) {
    super(
      rowIndex === undefined
        ? `Movement validation failed: ${field}`
        : `Movement validation failed: ${field} (row ${rowIndex})`,
    );
    this.name = 'MovementValidationError';
    this.field = field;
    this.rowIndex = rowIndex;
  }
}

interface TransactionRow {
  id: string;
  userFinancialProductId: string;
  externalId: string | null;
  dedupHash: string;
  amount: number;
  type: string;
  currencyCode: string;
  occurredAt: string;
  dateLocal: string;
  rawDescription: string;
  note: string | null;
  merchantId: string | null;
  transactionCategoryId: string | null;
  categorySource: string | null;
  reviewFlag: string | null;
  excludedAt: string | null;
  exclusionReason: string | null;
  exclusionNote: string | null;
  includedAmount: number | null;
  metadata: string | null;
  isManual: number;
  createdAt: string;
  updatedAt: string;
}

function mapTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userFinancialProductId: row.userFinancialProductId,
    externalId: row.externalId,
    amount: row.amount,
    type: row.type as Transaction['type'],
    currencyCode: row.currencyCode,
    occurredAt: row.occurredAt,
    dateLocal: row.dateLocal,
    rawDescription: row.rawDescription,
    note: row.note,
    merchantId: row.merchantId,
    transactionCategoryId: row.transactionCategoryId,
    categorySource: row.categorySource as Transaction['categorySource'],
    reviewFlag: row.reviewFlag as Transaction['reviewFlag'],
    excludedAt: row.excludedAt,
    exclusionReason: row.exclusionReason as Transaction['exclusionReason'],
    exclusionNote: row.exclusionNote,
    includedAmount: row.includedAmount,
    isManual: row.isManual === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Phase A (Decision 5): validates every amount, assigns occurrence indexes across the whole
 * batch (Decision 2 — grouped by the identity tuple, in the order given), and resolves every
 * dedup hash. Every `await` in the whole upsert happens here, before any transaction opens.
 *
 * Throws {@link MovementValidationError} on the first row whose amount is not a whole positive
 * number of minor units (Business Rule 12, AC15) — before any row's hash is even requested,
 * so a rejected batch never partially hashes.
 */
export async function prepareBankTransactions(
  userFinancialProductId: string,
  rows: BankTransactionInput[],
  ports: DbPorts,
): Promise<PreparedBankTransaction[]> {
  rows.forEach((row, index) => {
    try {
      assertPositiveMinorUnits(row.amount, 'transactions.amount');
    } catch {
      throw new MovementValidationError('transactions.amount', index);
    }
  });

  const occurrenceIndexes = assignOccurrenceIndexes(
    rows.map((row) => ({
      dateLocal: row.dateLocal,
      amount: row.amount,
      direction: row.type,
      rawDescription: row.rawDescription,
      externalId: row.externalId,
    })),
  );

  return Promise.all(
    rows.map(async (row, index) => {
      const id = ports.newId();
      const dedupInput = buildDedupInput({
        userFinancialProductId,
        dateLocal: row.dateLocal,
        amount: row.amount,
        direction: row.type,
        rawDescription: row.rawDescription,
        externalId: row.externalId,
        occurrenceIndex: occurrenceIndexes[index] as number,
        isManual: false,
        id,
      });
      const dedupHash = await ports.digestSha256(dedupInput);
      return { row, id, dedupHash };
    }),
  );
}

/**
 * Phase B (Decision 5): the lookup-then-upsert loop, synchronous, run inside a caller-supplied
 * transaction. By `(user_financial_product_id, external_id)` when the bank supplied an
 * identifier, otherwise by `dedup_hash`; on a hit, refreshes **only** the bank-owned columns; on
 * a miss, inserts — with `enricher` (Decision 7) computed and written **only** on the insert
 * branch. The nine person-owned columns (`transaction_category_id`, `category_source`, `note`,
 * `review_flag`, `excluded_at`, `exclusion_reason`, `exclusion_note`, `included_amount`,
 * `merchant_id`) and `is_manual` never appear in the `UPDATE` `set` object under any code path
 * (Business Rules 14-15, AC3, AC4, AC19, AC20).
 */
export function writeBankTransactionsInTx(
  tx: AppDatabase,
  userFinancialProductId: string,
  prepared: PreparedBankTransaction[],
  now: string,
  enricher?: MovementEnricher,
): BankTransactionWriteCounts {
  let storedFirstTime = 0;
  let alreadyKnown = 0;

  for (const { row, id, dedupHash } of prepared) {
    let existing: { id: string; metadata: string | null } | undefined;
    if (row.externalId) {
      existing = tx
        .select({ id: transactions.id, metadata: transactions.metadata })
        .from(transactions)
        .where(
          and(
            eq(transactions.userFinancialProductId, userFinancialProductId),
            eq(transactions.externalId, row.externalId),
          ),
        )
        .get() as { id: string; metadata: string | null } | undefined;
    }
    if (!existing) {
      existing = tx
        .select({ id: transactions.id, metadata: transactions.metadata })
        .from(transactions)
        .where(eq(transactions.dedupHash, dedupHash))
        .get() as { id: string; metadata: string | null } | undefined;
    }

    const metadata = row.metadata
      ? mergeTransactionMetadata(existing?.metadata ?? null, row.metadata)
      : (existing?.metadata ?? null);

    if (existing) {
      alreadyKnown += 1;
      // Bank-owned columns only — the person-owned nine (plus `is_manual`) are never named
      // here, under any call shape (Business Rules 14-15).
      tx.update(transactions)
        .set({
          amount: row.amount,
          type: row.type,
          currencyCode: canonicalizeCurrencyCode(row.currencyCode),
          occurredAt: row.occurredAt,
          dateLocal: row.dateLocal,
          rawDescription: row.rawDescription,
          metadata,
          dedupHash,
          updatedAt: now,
        })
        .where(eq(transactions.id, existing.id))
        .run();
    } else {
      storedFirstTime += 1;
      const enrichment = enricher ? enricher(row.rawDescription) : NO_ENRICHMENT;
      tx.insert(transactions)
        .values({
          id,
          userFinancialProductId,
          externalId: row.externalId ?? null,
          dedupHash,
          amount: row.amount,
          type: row.type,
          currencyCode: canonicalizeCurrencyCode(row.currencyCode),
          occurredAt: row.occurredAt,
          dateLocal: row.dateLocal,
          rawDescription: row.rawDescription,
          metadata,
          merchantId: enrichment.merchantId,
          transactionCategoryId: enrichment.transactionCategoryId,
          categorySource: enrichment.categorySource,
          isManual: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  return { storedFirstTime, alreadyKnown };
}

/**
 * The idempotent bank-movement upsert — the public wrapper (Decision 5). Opens its own
 * transaction around {@link writeBankTransactionsInTx}, after resolving
 * {@link prepareBankTransactions} outside it. `enricher` is optional so item #3's direct callers
 * (and its own tests) are unaffected; the sync engine (`src/features/sync`) always supplies one.
 */
export async function upsertBankTransactions(
  db: AppDatabase,
  userFinancialProductId: string,
  rows: BankTransactionInput[],
  ports: DbPorts,
  enricher?: MovementEnricher,
): Promise<BankTransactionWriteCounts> {
  const prepared = await prepareBankTransactions(userFinancialProductId, rows, ports);
  const now = ports.now();

  let result: BankTransactionWriteCounts = { storedFirstTime: 0, alreadyKnown: 0 };
  db.transaction((tx: AppDatabase) => {
    result = writeBankTransactionsInTx(tx, userFinancialProductId, prepared, now, enricher);
  });
  return result;
}

/**
 * Spec "How many movements still need a category (excluding ones already excluded)?" (`home`,
 * every app open). The `WHERE` clause matches the `transactions_uncategorized_idx` partial
 * index's predicate exactly, including reading the "not excluded" half through `isIncluded` — the
 * one place that condition is allowed to exist (`src/db/fragments.ts`). Deliberately does **not**
 * filter on `isPesoDenominated` (Decision 15) — a foreign-currency movement still needs a
 * category, and hiding it here would hide it from the person entirely.
 */
export function countUncategorized(db: AppDatabase): number {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(sql`${transactions.transactionCategoryId} is null`, isIncluded))
    .get() as { count: number } | undefined;
  return row?.count ?? 0;
}

/** Spec "What are this month's movements, newest first?" (`transactions`) — backed by
 * `transactions_date_local_idx` (`date_local desc`). */
export function listMonth(
  db: AppDatabase,
  params: { startDateLocal: string; endDateLocal: string },
): Transaction[] {
  const rows = db
    .select()
    .from(transactions)
    .where(
      and(
        gte(transactions.dateLocal, params.startDateLocal),
        lte(transactions.dateLocal, params.endDateLocal),
      ),
    )
    .orderBy(desc(transactions.dateLocal))
    .all() as TransactionRow[];
  return rows.map(mapTransactionRow);
}

/**
 * Spec "What is the total for this category over this period?" (`dashboard`). Reads through
 * three shared fragments — `isIncluded`, `includedAmount` and, since issue #10, `isPesoDenominated`
 * (Decision 15) — so this is not a second statement of either rule, only a consumer of both
 * (AC20, AC22). A foreign-currency movement is stored (Business Rule 17) but never summed into a
 * peso total.
 */
export function totalForCategoryInPeriod(
  db: AppDatabase,
  categoryId: string,
  period: { startDateLocal: string; endDateLocal: string },
): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${includedAmount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.transactionCategoryId, categoryId),
        isIncluded,
        isPesoDenominated,
        gte(transactions.dateLocal, period.startDateLocal),
        lte(transactions.dateLocal, period.endDateLocal),
      ),
    )
    .get() as { total: number } | undefined;
  return row?.total ?? 0;
}

/** Spec "Which movements belong to this merchant?" (`merchant-edit`) — backed by
 * `transactions_merchant_id_idx`. */
export function listByMerchant(db: AppDatabase, merchantId: string): Transaction[] {
  const rows = db
    .select()
    .from(transactions)
    .where(eq(transactions.merchantId, merchantId))
    .orderBy(desc(transactions.dateLocal))
    .all() as TransactionRow[];
  return rows.map(mapTransactionRow);
}

// -------------------------------------------------------------------------------------------
// Categorization flow (#13, implementation plan Decision 4, Decision 5). The write functions
// below never name `included_amount` in their `set` object (spec AC22, AC24) and never delete a
// row (spec Business Rule 4, AC21) — consistent with the file-level guarantee above.
// -------------------------------------------------------------------------------------------

interface StageMovementRow {
  id: string;
  amount: number;
  type: string;
  dateLocal: string;
  occurredAt: string;
  rawDescription: string;
  categorySource: string | null;
  merchantId: string | null;
  merchantName: string | null;
  merchantCategoryId: string | null;
  merchantUserId: string | null;
}

function mapStageMovementRow(row: StageMovementRow): StageMovement {
  return {
    id: row.id,
    amount: row.amount,
    type: row.type as StageMovement['type'],
    dateLocal: row.dateLocal,
    occurredAt: row.occurredAt,
    rawDescription: row.rawDescription,
    categorySource: row.categorySource as StageMovement['categorySource'],
    merchant:
      row.merchantId !== null && row.merchantName !== null
        ? {
            id: row.merchantId,
            name: row.merchantName,
            transactionCategoryId: row.merchantCategoryId,
            isUserDefined: row.merchantUserId !== null,
          }
        : null,
  };
}

/**
 * The categorization queue (implementation plan Decision 4; spec A3, Business Rule 11, AC1,
 * AC2, AC4): pending movements — no category, not excluded — newest first, tie-broken by the
 * bank's own instant, then by id so two devices holding the same rows see the same order. The
 * `WHERE` clause matches `countUncategorized`'s predicate exactly, so the intro's count and the
 * batch this reads can never disagree.
 */
export function listPendingBatch(db: AppDatabase, params: { limit: number }): StageMovement[] {
  const rows = db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      type: transactions.type,
      dateLocal: transactions.dateLocal,
      occurredAt: transactions.occurredAt,
      rawDescription: transactions.rawDescription,
      categorySource: transactions.categorySource,
      merchantId: merchants.id,
      merchantName: merchants.name,
      merchantCategoryId: merchants.transactionCategoryId,
      merchantUserId: merchants.userId,
    })
    .from(transactions)
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .where(and(sql`${transactions.transactionCategoryId} is null`, isIncluded))
    .orderBy(desc(transactions.dateLocal), desc(transactions.occurredAt), asc(transactions.id))
    .limit(params.limit)
    .all() as StageMovementRow[];
  return rows.map(mapStageMovementRow);
}

/**
 * The `done` completion state's total (spec A6, Assumption P4): every movement that carries a
 * category, whether or not it is later excluded — a categorized-then-excluded movement is still
 * categorized.
 */
export function countCategorized(db: AppDatabase): number {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(sql`${transactions.transactionCategoryId} is not null`)
    .get() as { count: number } | undefined;
  return row?.count ?? 0;
}

/**
 * Both completion tiles (spec Business Rule 6, AC31, Decision 11): the sum of included expense
 * amounts in a period, read through three shared fragments — `isIncluded`, `includedAmount` and
 * `isPesoDenominated` (issue #86, matching {@link totalForCategoryInPeriod}'s pattern) — the one
 * place those conditions are allowed to exist. A foreign-currency movement is stored (Business
 * Rule 17) but never summed into a peso total.
 */
export function sumIncludedExpensesInPeriod(
  db: AppDatabase,
  period: { startDateLocal: string; endDateLocal: string },
): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${includedAmount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'debit'),
        isIncluded,
        isPesoDenominated,
        gte(transactions.dateLocal, period.startDateLocal),
        lte(transactions.dateLocal, period.endDateLocal),
      ),
    )
    .get() as { total: number } | undefined;
  return row?.total ?? 0;
}

/**
 * Records the person's own category choice (spec Use Case 2/3, Business Rule 3, AC10). Writes
 * `category_source = 'user'` — the only value this flow ever writes — and clears any deferral
 * mark, since the movement now has a category. `included_amount` is deliberately absent from the
 * `set` object (AC22, AC24).
 */
export function setUserCategory(
  db: AppDatabase,
  transactionId: string,
  categoryId: string,
  ports: { now: () => string },
): void {
  db.update(transactions)
    .set({
      transactionCategoryId: categoryId,
      categorySource: 'user',
      reviewFlag: null,
      updatedAt: ports.now(),
    })
    .where(eq(transactions.id, transactionId))
    .run();
}

/**
 * "Revisar más tarde" / "No recuerdo" (spec Use Case 4, AC14, AC15): writes the deferral mark
 * only — no category, no exclusion. The movement stays pending.
 */
export function setReviewFlag(
  db: AppDatabase,
  transactionId: string,
  flag: NonNullable<Transaction['reviewFlag']>,
  ports: { now: () => string },
): void {
  db.update(transactions)
    .set({ reviewFlag: flag, updatedAt: ports.now() })
    .where(eq(transactions.id, transactionId))
    .run();
}

/**
 * Excludes a movement from analysis (spec Use Case 5, Business Rules 3-5, AC19, AC21, AC22,
 * AC24). An `UPDATE`, never a `DELETE` — the row and everything the bank said survive
 * unconditionally. `included_amount` is deliberately absent from the `set` object, as it is from
 * every write in this file.
 */
export function excludeTransaction(
  db: AppDatabase,
  transactionId: string,
  input: { reason: NonNullable<Transaction['exclusionReason']>; note?: string | null },
  ports: { now: () => string },
): void {
  const now = ports.now();
  db.update(transactions)
    .set({
      excludedAt: now,
      exclusionReason: input.reason,
      exclusionNote: input.note?.trim() ? input.note.trim() : null,
      updatedAt: now,
    })
    .where(eq(transactions.id, transactionId))
    .run();
}

interface TransactionContextMerchantRow {
  id: string;
  name: string;
  transactionCategoryId: string | null;
  userId: string | null;
}

interface TransactionContextRow {
  transaction: TransactionRow;
  merchant: TransactionContextMerchantRow | null;
  productId: string;
  productName: string;
  productMetadata: string | null;
}

/**
 * `transaction-detail`'s single-movement read (implementation plan for issue #16, Decision 3).
 * No inclusion predicate — an excluded movement must still open (Business Rule 3). Joins
 * `merchants` (nullable — a movement can have none) and `user_financial_products` (required by
 * the `NOT NULL` foreign key). The category itself is **not** re-read here: the caller resolves
 * it through the already-exported `getCategory` (`repositories/categories.ts`), so this file
 * gains no second category mapper.
 */
export function getTransactionContext(
  db: AppDatabase,
  transactionId: string,
): TransactionContext | undefined {
  const row = db
    .select({
      transaction: transactions,
      merchant: merchants,
      productId: userFinancialProducts.id,
      productName: userFinancialProducts.name,
      productMetadata: userFinancialProducts.metadata,
    })
    .from(transactions)
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .innerJoin(userFinancialProducts, eq(transactions.userFinancialProductId, userFinancialProducts.id))
    .where(eq(transactions.id, transactionId))
    .get() as TransactionContextRow | undefined;
  if (!row) return undefined;

  const product: ProductSummary = {
    id: row.productId,
    name: row.productName,
    mask: parseProductMetadata(row.productMetadata).mask,
  };
  const mappedTransaction = mapTransactionRow(row.transaction);

  return {
    transaction: mappedTransaction,
    // Renamed here, once, at the `src/db` boundary — see `TransactionContext`'s doc comment
    // (`db/types.ts`) for why the screen tier never spells the bank column's own identifier.
    bankDescription: mappedTransaction.rawDescription,
    merchantName: row.merchant?.name ?? null,
    merchant: row.merchant
      ? {
          id: row.merchant.id,
          name: row.merchant.name,
          transactionCategoryId: row.merchant.transactionCategoryId,
          isUserDefined: row.merchant.userId !== null,
        }
      : null,
    product,
  };
}

/**
 * Writes the person's own note for a movement (implementation plan for issue #16, Decision 3;
 * brief *"the editable note"*). Trims the draft and stores `null` for a blank or whitespace-only
 * value, so an empty string never reaches the column (Assumption A8). Nothing else is named in
 * the `set` object — never a bank fact, never `included_amount`.
 */
export function setTransactionNote(
  db: AppDatabase,
  transactionId: string,
  note: string | null,
  ports: { now: () => string },
): void {
  const trimmed = note?.trim();
  db.update(transactions)
    .set({ note: trimmed ? trimmed : null, updatedAt: ports.now() })
    .where(eq(transactions.id, transactionId))
    .run();
}

/**
 * Re-includes a movement in every total and chart (implementation plan for issue #16, Decision
 * 6; brief *"re-inclusion"*, AC3). An `UPDATE` that clears exactly three columns — `excludedAt`,
 * `exclusionReason` and `exclusionNote` — and never the category: the exclusion and the category
 * are separate decisions, so a person who categorized a movement and then excluded it gets that
 * category back (Assumption A2). `included_amount` is deliberately absent, as it is from every
 * write in this file — partial inclusion has no UI in the MVP. Idempotent: re-running this on an
 * already-included movement writes the same three nulls and bumps `updated_at` without throwing.
 */
export function reincludeTransaction(
  db: AppDatabase,
  transactionId: string,
  ports: { now: () => string },
): void {
  db.update(transactions)
    .set({
      excludedAt: null,
      exclusionReason: null,
      exclusionNote: null,
      updatedAt: ports.now(),
    })
    .where(eq(transactions.id, transactionId))
    .run();
}

/** A `home`/`dashboard` period boundary, expressed in `date_local` terms (implementation plan
 * for issue #12, Decision 8 — never a UTC instant). */
export interface DateLocalPeriod {
  startDateLocal: string;
  endDateLocal: string;
}

/**
 * `home`'s two stat tiles, its balance line and its whole category card, and #17 dashboard's
 * per-category report — the **same** function, not merely the same fragment (implementation plan
 * Decision 1, Risks — "home and dashboard still diverge"). Reads through three shared fragments —
 * `isIncluded`, `includedAmount` and, since issue #86, `isPesoDenominated` — so this is a consumer
 * of the inclusion rule and the currency guard, never a second statement of either (item #3
 * Decision 9, Business Rule 4; issue #10 Decision 15, Business Rule 17). A foreign-currency
 * movement is stored but never summed into, or counted toward, a peso total.
 *
 * The `null` `transaction_category_id` group is the "Sin categorizar" bucket and is returned like
 * any other: categorization is never mandatory, so an uncategorized movement must never be
 * silently dropped from a total (item #5 Decision 10).
 */
export function sumIncludedByDirectionAndCategory(
  db: AppDatabase,
  period: DateLocalPeriod,
): DirectionCategoryTotal[] {
  const rows = db
    .select({
      type: transactions.type,
      transactionCategoryId: transactions.transactionCategoryId,
      total: sql<number>`coalesce(sum(${includedAmount}), 0)`,
      movementCount: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        isIncluded,
        isPesoDenominated,
        gte(transactions.dateLocal, period.startDateLocal),
        lte(transactions.dateLocal, period.endDateLocal),
      ),
    )
    .groupBy(transactions.type, transactions.transactionCategoryId)
    .all() as { type: string; transactionCategoryId: string | null; total: number; movementCount: number }[];

  return rows.map((row) => ({
    type: row.type as DirectionCategoryTotal['type'],
    transactionCategoryId: row.transactionCategoryId,
    total: row.total,
    movementCount: row.movementCount,
  }));
}

/** `home`'s trend chart's source series (implementation plan for issue #12, Decision 1), called
 * once per period (current, previous). Reads through all three shared fragments, exactly like
 * {@link sumIncludedByDirectionAndCategory} (issue #86). */
export function sumIncludedByDirectionAndDay(
  db: AppDatabase,
  period: DateLocalPeriod,
): DirectionDayTotal[] {
  const rows = db
    .select({
      dateLocal: transactions.dateLocal,
      type: transactions.type,
      total: sql<number>`coalesce(sum(${includedAmount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        isIncluded,
        isPesoDenominated,
        gte(transactions.dateLocal, period.startDateLocal),
        lte(transactions.dateLocal, period.endDateLocal),
      ),
    )
    .groupBy(transactions.dateLocal, transactions.type)
    .orderBy(asc(transactions.dateLocal))
    .all() as { dateLocal: string; type: string; total: number }[];

  return rows.map((row) => ({
    dateLocal: row.dateLocal,
    type: row.type as DirectionDayTotal['type'],
    total: row.total,
  }));
}

interface RecentMovementRow {
  id: string;
  amount: number;
  type: string;
  dateLocal: string;
  rawDescription: string;
  excludedAt: string | null;
  merchantName: string | null;
  merchantAssets: string | null;
  categoryLabels: string | null;
  categoryAssets: string | null;
}

/**
 * `home`'s "Transacciones recientes" (implementation plan for issue #12, Decision 2). `limit`-
 * bounded, backed by `transactions_date_local_idx` (`date_local desc`) — the screen never reduces
 * a table in JavaScript. **No inclusion filter**: an excluded movement still appears, dimmed
 * (Assumption A8) — this reads no money value through a fragment, so it is not a restatement of
 * the inclusion rule.
 */
export function listRecentMovements(
  db: AppDatabase,
  params: { limit: number; locale: SupportedLocale },
): RecentMovement[] {
  const rows = db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      type: transactions.type,
      dateLocal: transactions.dateLocal,
      rawDescription: transactions.rawDescription,
      excludedAt: transactions.excludedAt,
      merchantName: merchants.name,
      merchantAssets: merchants.assets,
      categoryLabels: transactionCategories.labels,
      categoryAssets: transactionCategories.assets,
    })
    .from(transactions)
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .leftJoin(transactionCategories, eq(transactions.transactionCategoryId, transactionCategories.id))
    // `date_local` has day granularity; `occurredAt` then `id` break ties deterministically among
    // same-day movements, so both the surviving `limit`-bounded set and the within-day display
    // order are stable across re-syncs (found in review). `date_local desc` stays the leading key
    // so `transactions_date_local_idx` still applies.
    .orderBy(desc(transactions.dateLocal), desc(transactions.occurredAt), desc(transactions.id))
    .limit(params.limit)
    .all() as RecentMovementRow[];

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    type: row.type as RecentMovement['type'],
    dateLocal: row.dateLocal,
    rawDescription: row.rawDescription,
    excluded: row.excludedAt !== null,
    merchantName: row.merchantName ?? undefined,
    merchantEmoji: row.merchantName === null ? undefined : parseAssets(row.merchantAssets).emoji,
    categoryName:
      row.categoryLabels === null ? undefined : resolveLabel(parseCategoryLabels(row.categoryLabels), params.locale),
    categoryEmoji: row.categoryLabels === null ? undefined : parseAssets(row.categoryAssets).emoji,
  }));
}

// -------------------------------------------------------------------------------------------
// `transactions` screen (implementation plan for issue #15, Decisions 2, 4-6, 8, 12).
// -------------------------------------------------------------------------------------------

/** Escapes the three characters SQLite's `LIKE` treats specially, so a typed `%`/`_`/`\` matches
 * itself literally rather than acting as a wildcard/escape (Decision 5, Scenario 6). */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * The one place this screen's filter semantics exist (Decision 2, module-private — **not
 * exported**). {@link listTransactionsPage} and {@link countTransactionsByMonth} both call it, so
 * a filter cannot be applied to the rows and forgotten in the counts. The "hide excluded" branch
 * reads through the **imported** `isIncluded` fragment — the only sanctioned way to express that
 * condition outside `src/db/fragments.ts` (Business Rule 4); this file carries no `excluded_at`
 * literal, no `sql`-tagged template mentioning `excluded`, and no `isNull(x.excludedAt)`.
 */
function buildTransactionListPredicates(params: TransactionListQueryParams): SQL[] {
  const { filters, search } = params;
  const predicates: SQL[] = [];

  if (filters.direction !== 'all') predicates.push(eq(transactions.type, filters.direction));
  if (filters.categorization === 'uncategorized') {
    predicates.push(isNull(transactions.transactionCategoryId));
  }
  if (filters.categorization === 'categorized') {
    predicates.push(isNotNull(transactions.transactionCategoryId));
  }
  if (filters.productId !== null) {
    predicates.push(eq(transactions.userFinancialProductId, filters.productId));
  }
  if (!filters.showExcluded) predicates.push(isIncluded);

  if (search !== null) {
    // Lower-cased and escaped once per query, not once per row.
    const pattern = `%${escapeLikeTerm(search.term.toLowerCase())}%`;
    const textMatches = [
      sql`lower(${transactions.rawDescription}) like ${pattern} escape '\\'`,
      sql`lower(${merchants.name}) like ${pattern} escape '\\'`,
      sql`lower(${transactions.note}) like ${pattern} escape '\\'`,
    ];
    if (search.categoryIds.length > 0) {
      textMatches.push(inArray(transactions.transactionCategoryId, search.categoryIds));
    }
    predicates.push(or(...textMatches) as SQL);
  }

  return predicates;
}

/** The columns {@link listTransactionsPage} selects — module-private; nothing outside `src/db`
 * ever sees a column name (Layer-by-Layer, `TransactionListQueryRow` stays module-private). */
const TRANSACTION_LIST_COLUMNS = {
  id: transactions.id,
  dateLocal: transactions.dateLocal,
  amount: transactions.amount,
  type: transactions.type,
  rawDescription: transactions.rawDescription,
  note: transactions.note,
  excludedAt: transactions.excludedAt,
  exclusionReason: transactions.exclusionReason,
  includedAmount: transactions.includedAmount,
  merchantName: merchants.name,
  merchantAssets: merchants.assets,
  categoryLabels: transactionCategories.labels,
  categoryAssets: transactionCategories.assets,
};

/** `substr(date_local, 1, 7)` — the month-group key (Decision 8), computed from the column
 * `deriveDateLocal` produced at write time, never from `occurred_at`. */
const MONTH_KEY = sql<string>`substr(${transactions.dateLocal}, 1, 7)`;

interface TransactionListQueryRow {
  id: string;
  dateLocal: string;
  amount: number;
  type: string;
  rawDescription: string;
  note: string | null;
  excludedAt: string | null;
  exclusionReason: string | null;
  includedAmount: number | null;
  merchantName: string | null;
  merchantAssets: string | null;
  categoryLabels: string | null;
  categoryAssets: string | null;
}

/**
 * The `FROM transactions` + `LEFT JOIN merchants` + `LEFT JOIN transaction_categories` +
 * `INNER JOIN user_financial_products` shape both {@link listTransactionsPage} and
 * {@link countTransactionsByMonth} select from (Decision 2, module-private) — so the shared
 * predicates from {@link buildTransactionListPredicates} always resolve against the same columns.
 * The product join is a defensive `INNER JOIN` on the `NOT NULL` FK (every transaction belongs to
 * exactly one product); no product column is selected by either caller today.
 *
 * `selection`'s shape differs per caller (the row columns vs. the month-count aggregate); both
 * cast their own `.all()` result to a named row interface immediately.
 */
function transactionListQuery(db: AppDatabase, selection: SelectedFields<SQLiteColumn, SQLiteTable>) {
  return db
    .select(selection)
    .from(transactions)
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .leftJoin(transactionCategories, eq(transactions.transactionCategoryId, transactionCategories.id))
    .innerJoin(userFinancialProducts, eq(transactions.userFinancialProductId, userFinancialProducts.id));
}

function mapTransactionListRow(row: TransactionListQueryRow, locale: SupportedLocale): TransactionListRow {
  return {
    id: row.id,
    dateLocal: row.dateLocal,
    amount: row.amount,
    type: row.type as TransactionListRow['type'],
    rawDescription: row.rawDescription,
    note: row.note,
    excludedAt: row.excludedAt,
    exclusionReason: row.exclusionReason as TransactionListRow['exclusionReason'],
    includedAmount: row.includedAmount,
    merchantName: row.merchantName ?? undefined,
    merchantEmoji: row.merchantName === null ? undefined : parseAssets(row.merchantAssets).emoji,
    categoryName:
      row.categoryLabels === null ? undefined : resolveLabel(parseCategoryLabels(row.categoryLabels), locale),
    categoryEmoji: row.categoryLabels === null ? undefined : parseAssets(row.categoryAssets).emoji,
  };
}

/**
 * Spec "Give me the next page of movements matching these filters and this search term, newest
 * first" (`transactions`, Decision 4). Ordered `date_local desc, id desc` — a total order because
 * `id` is the primary key, so the keyset cursor can never skip or repeat a row. `LIMIT limit + 1`
 * answers "is there a next page?" without a second count query. **No inclusion filter unless the
 * caller asks for one** — `filters.showExcluded` (Decision 6) — so an excluded movement is
 * returned by default, for the screen to render dimmed.
 */
export function listTransactionsPage(
  db: AppDatabase,
  params: TransactionPageParams,
  locale: SupportedLocale,
): TransactionListPage {
  const { cursor, limit } = params;
  const cursorPredicate: SQL | undefined =
    cursor === null
      ? undefined
      : (or(
          lt(transactions.dateLocal, cursor.dateLocal),
          and(eq(transactions.dateLocal, cursor.dateLocal), lt(transactions.id, cursor.id)),
        ) as SQL);

  const rows = transactionListQuery(db, TRANSACTION_LIST_COLUMNS)
    .where(and(...buildTransactionListPredicates(params), cursorPredicate))
    .orderBy(desc(transactions.dateLocal), desc(transactions.id))
    .limit(limit + 1)
    .all() as unknown as TransactionListQueryRow[];

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor: TransactionListCursor | null =
    rows.length > limit && last !== undefined ? { dateLocal: last.dateLocal, id: last.id } : null;

  return { rows: page.map((row) => mapTransactionListRow(row, locale)), nextCursor };
}

/**
 * Spec "How many matching movements are in each month?" (`transactions`, Decision 8) — the
 * `(31)` in `📅 Enero de 2025 (31)`. Grouped by {@link MONTH_KEY}, over the **same** predicates
 * {@link listTransactionsPage} uses, so a group header's count and the rows underneath it can
 * never describe different sets (Decision 2). Sums nothing, so `isPesoDenominated` /
 * `peso-total-scan` do not apply.
 */
export function countTransactionsByMonth(db: AppDatabase, params: TransactionListQueryParams): MonthCount[] {
  const rows = transactionListQuery(db, { monthKey: MONTH_KEY, count: sql<number>`count(*)` })
    .where(and(...buildTransactionListPredicates(params)))
    .groupBy(MONTH_KEY)
    .orderBy(desc(MONTH_KEY))
    .all() as { monthKey: string; count: number }[];

  return rows.map((row) => ({ monthKey: row.monthKey, count: row.count }));
}

/**
 * Spec "Record a movement the bank never reported" (`transactions`, Decision 12). `occurred_at`
 * and `date_local` are stamped from `ports.now()` — there is no bank instant for a manual entry,
 * and the mockup's "Fecha" field is not editable in this item. `currency_code` is read from the
 * selected product's own `currencyCode`, canonicalized the same way a bank-sourced write is
 * (found in review on PR #82) — never hard-coded to `'CLP'`, so a manual entry against a
 * foreign-currency product is not silently mislabeled into peso totals. `dedup_hash` folds in the
 * reserved row id (`isManual: true`), which is exactly what lets two otherwise-identical manual
 * entries both persist (Business Rule 5). Writes no person-owned column other than the ones the
 * person just supplied — `merchant_id`, `transaction_category_id` and `category_source` are
 * `null`, so the movement joins the categorization queue like any other (Business Rule 6).
 */
export async function insertManualTransaction(
  db: AppDatabase,
  input: ManualTransactionInput,
  ports: DbPorts,
): Promise<string> {
  assertPositiveMinorUnits(input.amount, 'transactions.amount');

  // CodeRabbit finding on PR #82: the manual-entry sheet lists every product, including a
  // foreign-currency one. A hard-coded 'CLP' would mislabel a USD product's entry, making it
  // eligible for a peso total the `isPesoDenominated` guard (`fragments.ts`) is supposed to keep
  // it out of. Read the selected product's own stated currency instead.
  const product = db
    .select({ currencyCode: userFinancialProducts.currencyCode })
    .from(userFinancialProducts)
    .where(eq(userFinancialProducts.id, input.userFinancialProductId))
    .get() as { currencyCode: string } | undefined;
  const currencyCode = canonicalizeCurrencyCode(product?.currencyCode);

  const id = ports.newId();
  const now = ports.now();
  const dateLocal = deriveDateLocal(new Date(now));
  const dedupInput = buildDedupInput({
    userFinancialProductId: input.userFinancialProductId,
    dateLocal,
    amount: input.amount,
    direction: input.type,
    rawDescription: input.rawDescription,
    externalId: null,
    occurrenceIndex: 0,
    isManual: true,
    id,
  });
  const dedupHash = await ports.digestSha256(dedupInput);

  db.insert(transactions)
    .values({
      id,
      userFinancialProductId: input.userFinancialProductId,
      externalId: null,
      dedupHash,
      amount: input.amount,
      type: input.type,
      currencyCode,
      occurredAt: now,
      dateLocal,
      rawDescription: input.rawDescription,
      merchantId: null,
      transactionCategoryId: null,
      categorySource: null,
      isManual: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}
