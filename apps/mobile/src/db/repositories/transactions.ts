import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { assignOccurrenceIndexes, buildDedupInput } from '../dedup';
import { includedAmount, isIncluded, isPesoDenominated } from '../fragments';
import type { DbPorts } from '../ids';
import { mergeTransactionMetadata } from '../json';
import { assertPositiveMinorUnits } from '../money';
import { transactions } from '../schema';
import type { AppDatabase, Transaction } from '../types';

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
          currencyCode: row.currencyCode ?? 'CLP',
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
