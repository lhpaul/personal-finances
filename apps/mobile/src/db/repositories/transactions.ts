import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { buildDedupInput } from '../dedup';
import { includedAmount, isIncluded } from '../fragments';
import type { DbPorts } from '../ids';
import { mergeTransactionMetadata } from '../json';
import { assertPositiveMinorUnits } from '../money';
import { merchants, transactions } from '../schema';
import type { AppDatabase, StageMovement, Transaction } from '../types';

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
 * amounts in a period, read through the two shared inclusion-rule fragments — the one place that
 * condition is allowed to exist.
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
  flag: 'review_later' | 'uncertain',
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
  input: { reason: 'personal_transfer' | 'shared_expense' | 'not_relevant' | 'cash_withdrawal' | 'other'; note?: string | null },
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
