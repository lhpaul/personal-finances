import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { buildDedupInput } from '../dedup';
import { includedAmount, isIncluded } from '../fragments';
import type { DbPorts } from '../ids';
import { mergeTransactionMetadata } from '../json';
import { assertPositiveMinorUnits } from '../money';
import { transactions } from '../schema';
import type { AppDatabase, Transaction } from '../types';

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
