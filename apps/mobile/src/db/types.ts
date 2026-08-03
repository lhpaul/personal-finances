import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/**
 * The shared database-handle type every repository function accepts (implementation plan
 * Decision 1). Both concrete drivers — `ExpoSQLiteDatabase` (`src/db/client.ts`) and
 * `BetterSQLite3Database` (`src/db/testing/memory-db.ts`) — extend
 * `BaseSQLiteDatabase<'sync', ...>`, so a repository function written once against this type runs
 * unchanged against either. The `RunResult` and schema generics are intentionally erased to
 * `any` here: this is the one place in `src/db` that needs to be driver-agnostic across two
 * concrete `RunResult` shapes (`SQLiteRunResult` vs better-sqlite3's own), and repository code
 * never inspects a raw run-result shape directly — it always reads through `.get()` / `.all()` /
 * the domain types below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see the doc comment above.
export type AppDatabase = BaseSQLiteDatabase<'sync', any, any>;

/**
 * Domain types repositories return, so a caller never sees a Drizzle row type
 * (`docs/best-practices/stack/typescript.md`). Populated incrementally as repositories are
 * added (Step 7).
 */

export type SupportedCurrency = 'CLP';

export interface Category {
  id: string;
  slug: string;
  income: boolean;
  name: string;
  emoji: string | undefined;
  sortOrder: number;
}

export interface ConnectableInstitution {
  id: string;
  name: string;
  countryCode: string;
  scraperStatus: 'available' | 'coming_soon';
  logoUrl: string | undefined;
}

/**
 * `onboarding-ready`'s "how many banks, and which ones" summary (implementation plan Decision 7).
 * `connectionCount` and `productCount` are always non-negative integers; `institutionNames` is
 * empty exactly when `connectionCount` is `0`.
 */
export interface ConnectedBanksSummary {
  connectionCount: number;
  institutionNames: string[];
  productCount: number;
}

/**
 * The `app_settings` reminder-settings value contract this item defines for item #18 to write
 * (implementation plan Decision 8). `reminderDays` uses ISO weekday integers, `1` = Monday …
 * `7` = Sunday (Assumption A8). Every field is independently optional/defensive: a missing or
 * malformed value degrades to "this field is unknown", never to a thrown error.
 */
export interface ReminderSettings {
  enabled: boolean;
  /** `"HH:mm"`, 24-hour, zero-padded — `undefined` when absent or malformed. */
  timeOfDay: string | undefined;
  /** ISO weekday integers, `1..7` — `undefined` when absent or malformed. */
  days: number[] | undefined;
}

/**
 * `user_financial_institutions`, in sync-engine shape (implementation plan Decision 8, issue
 * #10). `credentialsKey` is the secure-store *key name*, never a credential value (Business Rule
 * 2) — the sync engine reads it only to hand it, unread, to the injected `ScraperRunner`.
 */
export interface SyncConnection {
  id: string;
  financialInstitutionId: string;
  /** Not stored on `user_financial_institutions`; joined from `financial_institutions.country_code`
   * so a `ScraperRunner` call has everything it needs without a second lookup. */
  countryCode: string;
  status: 'active' | 'inactive' | 'disconnected';
  credentialsKey: string;
  syncStatus: 'idle' | 'syncing' | 'ok' | 'error';
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: 'invalid_credentials' | 'session_closed' | 'network' | 'parse_failed' | null;
  lastErrorMessage: string | null;
}

/**
 * `home`'s (and #17 dashboard's) per-category money buckets (implementation plan for issue #12,
 * Decision 1). `transactionCategoryId: null` is the *Sin categorizar* bucket, returned like any
 * other — categorization is never mandatory, so an uncategorized movement must never be silently
 * dropped from a total (item #5's Decision 10).
 */
export interface DirectionCategoryTotal {
  type: 'debit' | 'credit';
  transactionCategoryId: string | null;
  total: number;
  movementCount: number;
}

/** `home`'s trend chart's source series, one row per `(dateLocal, type)` pair present in the
 * period (implementation plan for issue #12, Decision 1). A day with no included movement of a
 * given direction has no row — callers that need a dense per-day series build it themselves
 * (`src/features/home/trend-series.ts`). */
export interface DirectionDayTotal {
  dateLocal: string;
  type: 'debit' | 'credit';
  total: number;
}

/**
 * `home`'s "Transacciones recientes" row shape (implementation plan for issue #12, Decision 2).
 * `merchantName`/`merchantEmoji` and `categoryName`/`categoryEmoji` are `undefined` when the
 * movement has no merchant or no category, respectively — a screen falls back through them
 * (Assumption A9), never crashes on a missing join.
 */
export interface RecentMovement {
  id: string;
  amount: number;
  type: 'debit' | 'credit';
  dateLocal: string;
  rawDescription: string;
  excluded: boolean;
  merchantName: string | undefined;
  merchantEmoji: string | undefined;
  categoryName: string | undefined;
  categoryEmoji: string | undefined;
}

/**
 * `home`'s "Bancos conectados" row shape (implementation plan for issue #12, Decision 4 inputs).
 * Returned for **every** connection regardless of `status` — unlike #8's
 * `getConnectedBanksSummary`, which only counts `'active'` ones (a different question, for
 * `onboarding-ready`).
 */
export interface BankConnection {
  id: string;
  institutionName: string;
  institutionLogoUrl: string | undefined;
  institutionShortName: string | undefined;
  institutionBrandColor: string | undefined;
  status: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
}

/**
 * `transactions` screen filter state (implementation plan for issue #15, Decision 7). Declared
 * once here and imported by the feature layer — the shape is not redeclared in `src/features/`.
 * `direction: 'all'` / `categorization: 'all'` / `productId: null` are each their control's
 * "Todos"/"Todas" pill. `showExcluded` defaults to `true` (Decision 6).
 */
export interface TransactionListFilters {
  direction: 'all' | 'debit' | 'credit';
  categorization: 'all' | 'uncategorized' | 'categorized';
  productId: string | null;
  showExcluded: boolean;
}

/** A resolved, non-blank search term plus the category ids it already matched in TypeScript
 * (implementation plan for issue #15, Decision 5) — the repository turns `term` into a `LIKE`
 * pattern itself and adds `categoryIds` as an `IN (...)` disjunct. */
export interface TransactionSearch {
  term: string;
  categoryIds: string[];
}

/** Shared by {@link listTransactionsPage} (via {@link TransactionPageParams}) and
 * {@link countTransactionsByMonth}, so a filter cannot be applied to one and forgotten in the
 * other (implementation plan for issue #15, Decision 2). */
export interface TransactionListQueryParams {
  filters: TransactionListFilters;
  search: TransactionSearch | null;
}

/** The keyset cursor for {@link listTransactionsPage} — the last row's `(dateLocal, id)` pair,
 * a total order because `id` is the primary key (implementation plan for issue #15, Decision
 * 4). */
export interface TransactionListCursor {
  dateLocal: string;
  id: string;
}

export interface TransactionPageParams extends TransactionListQueryParams {
  /** `null` for the first page. */
  cursor: TransactionListCursor | null;
  limit: number;
}

/**
 * One row of `listTransactionsPage`'s result, in domain shape (implementation plan for issue
 * #15, Decision 2). Carries the raw inclusion fields (`amount`, `includedAmount`, `excludedAt`)
 * rather than a precomputed `excluded` boolean, so the feature layer reads exclusion through
 * `isIncludedInAnalysis` (`@finanzas/shared-domain`) — the sanctioned in-memory statement of the
 * rule — instead of a repository-computed shortcut (Decision 6).
 */
export interface TransactionListRow {
  id: string;
  dateLocal: string;
  amount: number;
  type: 'debit' | 'credit';
  rawDescription: string;
  excludedAt: string | null;
  exclusionReason: Transaction['exclusionReason'];
  includedAmount: number | null;
  merchantName: string | undefined;
  merchantEmoji: string | undefined;
  categoryName: string | undefined;
  categoryEmoji: string | undefined;
}

export interface TransactionListPage {
  rows: TransactionListRow[];
  /** `null` when this page's last row is the table's last matching row. */
  nextCursor: TransactionListCursor | null;
}

/** One `📅 {month} ({count})` group header's source row (implementation plan for issue #15,
 * Decision 8). `monthKey` is `substr(date_local, 1, 7)` — `"2025-01"` — never derived from
 * `occurred_at`. */
export interface MonthCount {
  monthKey: string;
  count: number;
}

/** Drives the **Producto** filter pills (implementation plan for issue #15, Assumption A6) — one
 * per row in `user_financial_products`, not a fixed taxonomy. */
export interface UserProduct {
  id: string;
  name: string;
  type: string;
}

/** The validated manual-entry draft `insertManualTransaction` writes (implementation plan for
 * issue #15, Decision 12). Carries no date: `date_local` and `occurred_at` are stamped from
 * `ports.now()` at write time — there is no bank instant for a manual entry, and the mockup's
 * "Fecha" field is not editable in this item. */
export interface ManualTransactionInput {
  userFinancialProductId: string;
  type: 'debit' | 'credit';
  amount: number;
  rawDescription: string;
}

export interface Transaction {
  id: string;
  userFinancialProductId: string;
  externalId: string | null;
  amount: number;
  type: 'debit' | 'credit';
  currencyCode: string;
  occurredAt: string;
  dateLocal: string;
  rawDescription: string;
  note: string | null;
  merchantId: string | null;
  transactionCategoryId: string | null;
  categorySource: 'auto' | 'user' | 'rule' | null;
  reviewFlag: 'review_later' | 'uncertain' | null;
  excludedAt: string | null;
  exclusionReason: 'personal_transfer' | 'shared_expense' | 'not_relevant' | 'cash_withdrawal' | 'other' | null;
  exclusionNote: string | null;
  includedAmount: number | null;
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
}
