import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { buildDedupInput } from '../dedup';
import { includedAmount, isIncluded } from '../fragments';
import type { DbPorts } from '../ids';
import { mergeTransactionMetadata, parseAssets, parseCategoryLabels } from '../json';
import type { SupportedLocale } from '../labels';
import { resolveLabel } from '../labels';
import { assertPositiveMinorUnits } from '../money';
import { merchants, transactionCategories, transactions } from '../schema';
import type {
  AppDatabase,
  DirectionCategoryTotal,
  DirectionDayTotal,
  RecentMovement,
  Transaction,
} from '../types';

/**
 * `transactions` repository (implementation plan Decision 15, Layer-by-Layer; spec Business
 * Rules 4, 6-8, 21; AC4, AC6, AC7, AC20-AC23).
 *
 * There is no `deleteTransaction` export anywhere in this file or in `src/db` (Business Rule 5,
 * AC22) — a movement is never deleted, only excluded.
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
 * The idempotent bank-movement upsert (Decision 15). Per row, inside one transaction: looks up
 * by `(user_financial_product_id, external_id)` when the bank supplies an identifier, otherwise
 * by `dedup_hash` (Decision 14's extended formula); on a hit, refreshes **only** the bank-owned
 * columns; on a miss, inserts. The nine person-owned columns
 * (`transaction_category_id`, `category_source`, `note`, `review_flag`, `excluded_at`,
 * `exclusion_reason`, `exclusion_note`, `included_amount`, `merchant_id`) and `is_manual` never
 * appear in the update `set` object under any code path (Business Rule 8, AC7).
 *
 * `dedup_hash` is computed through the injected `digestSha256` port, which is asynchronous
 * (Decision 13 — `expo-crypto` in the runtime, `node:crypto` in tests). SQLite transactions in
 * this codebase's `'sync'` drivers cannot await mid-transaction, so every row's dedup hash — and
 * every `assertPositiveMinorUnits` check — is resolved **before** the transaction opens. A
 * rejected amount therefore throws before any row of the batch is written, not partway through
 * (Business Rule 4, AC4).
 */
export async function upsertBankTransactions(
  db: AppDatabase,
  userFinancialProductId: string,
  rows: BankTransactionInput[],
  ports: DbPorts,
): Promise<void> {
  const prepared = await Promise.all(
    rows.map(async (row) => {
      assertPositiveMinorUnits(row.amount, 'transactions.amount');
      const id = ports.newId();
      const dedupInput = buildDedupInput({
        userFinancialProductId,
        dateLocal: row.dateLocal,
        amount: row.amount,
        rawDescription: row.rawDescription,
        externalId: row.externalId,
        isManual: false,
        id,
      });
      const dedupHash = await ports.digestSha256(dedupInput);
      return { row, id, dedupHash };
    }),
  );

  const now = ports.now();

  db.transaction((tx: AppDatabase) => {
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
        // Bank-owned columns only — the person-owned nine (plus `is_manual`) are never named
        // here, under any call shape (Decision 15).
        tx.update(transactions)
          .set({
            amount: row.amount,
            type: row.type,
            currencyCode: row.currencyCode ?? 'CLP',
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
        tx.insert(transactions)
          .values({
            id,
            userFinancialProductId,
            externalId: row.externalId ?? null,
            dedupHash,
            amount: row.amount,
            type: row.type,
            currencyCode: row.currencyCode ?? 'CLP',
            occurredAt: row.occurredAt,
            dateLocal: row.dateLocal,
            rawDescription: row.rawDescription,
            metadata,
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }
  });
}

/**
 * Spec "How many movements still need a category (excluding ones already excluded)?" (`home`,
 * every app open). The `WHERE` clause matches the `transactions_uncategorized_idx` partial
 * index's predicate exactly, including reading the "not excluded" half through `isIncluded` — the
 * one place that condition is allowed to exist (`src/db/fragments.ts`).
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
 * Spec "What is the total for this category over this period?" (`dashboard`). Reads through both
 * shared fragments — `isIncluded` and `includedAmount` — so this is not a second statement of the
 * inclusion rule, only a consumer of it (AC20).
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

/** A `home`/`dashboard` period boundary, expressed in `date_local` terms (implementation plan
 * for issue #12, Decision 8 — never a UTC instant). */
export interface DateLocalPeriod {
  startDateLocal: string;
  endDateLocal: string;
}

/**
 * `home`'s two stat tiles, its balance line and its whole category card, and #17 dashboard's
 * per-category report — the **same** function, not merely the same fragment (implementation plan
 * Decision 1, Risks — "home and dashboard still diverge"). Reads through both shared fragments,
 * so this is a consumer of the inclusion rule, never a second statement of it (item #3 Decision
 * 9, Business Rule 4).
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
 * once per period (current, previous). Reads through both shared fragments, exactly like
 * {@link sumIncludedByDirectionAndCategory}. */
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
