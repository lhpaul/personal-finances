import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type { AliasCandidate, PeriodDelta } from '@finanzas/shared-domain';

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
  /** `financial_institutions.id` (implementation plan for issue #20, Decision 13) — the identity
   * `home`'s own bank row navigates on, since `[bankId]` (`/settings/banks/[bankId]`) is the
   * institution id, not this connection's own `id`. */
  institutionId: string;
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
 * `settings-banks` (list) and `bank-review` (detail)'s shared connection row shape
 * (implementation plan for issue #20, Layer-by-Layer, Resolution R6). Unlike {@link BankConnection}
 * (issue #12, unfiltered) and {@link ConnectedBankSummary} (issue #9, `status === 'active' &&
 * last_success_at is not null` only), this item's own two repository reads —
 * `listSettingsBankConnections` (filtered to `'active' | 'inactive'`, Assumption A7) and
 * `getBankConnectionSummary` (unfiltered, so a caller can tell "no connection" apart from "a
 * disconnected one") — both return this shape. Converging the four is item #9's already-recorded
 * follow-up F2/F3; this item adds the fourth shape rather than resolving that debt mid-campaign.
 */
export interface BankConnectionSummary {
  id: string;
  /** `financial_institutions.id` — also the scraper's own `bankId` and the `[bankId]` route
   * param (Decision 13, Assumption A11). */
  institutionId: string;
  name: string;
  shortName: string | undefined;
  brandColor: string | undefined;
  logoUrl: string | undefined;
  status: 'active' | 'inactive' | 'disconnected';
  syncStatus: 'idle' | 'syncing' | 'ok' | 'error';
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: 'invalid_credentials' | 'session_closed' | 'network' | 'parse_failed' | null;
  /** Already the literal catalogue key `sync.errors.<code>` written by issue #10's
   * `composeFailureMessageKey` — never bank-supplied free text. Carried through for shape parity
   * with the column; `resolveSyncErrorKey` (Decision 10) computes its return value from
   * `lastErrorCode` alone and never renders this field's content. */
  lastErrorMessage: string | null;
  productCount: number;
}

/**
 * `bank-review`'s "Productos" row shape (implementation plan for issue #20, Decision 5). Money
 * fields are already-parsed integer minor units (through `parseProductMetadata`'s
 * `assertMinorUnits` guard) or `undefined` when the stored metadata carries none — never `0` as
 * a stand-in for "absent" (Decision 5's table: "absent → no amount is rendered").
 */
export interface BankProductSummary {
  id: string;
  externalId: string;
  type: string;
  name: string;
  currencyCode: string;
  mask: string | undefined;
  balanceMinorUnits: number | undefined;
  creditLimitMinorUnits: number | undefined;
  availableCreditMinorUnits: number | undefined;
}

/**
 * `bank-picker`'s row shape (implementation plan for issue #9, Layer-by-Layer). Unlike
 * {@link ConnectableInstitution} — which filters to `scraperStatus === 'available'` for a caller
 * that only cares which banks can actually be connected — this carries **every** catalogue row,
 * because the picker also draws the coming-soon banks (spec Decision 1).
 */
export interface PickerInstitution {
  id: string;
  name: string;
  scraperStatus: 'available' | 'coming_soon';
  shortName: string | undefined;
  brandColor: string | undefined;
}

/**
 * `bank-connected`'s row shape (implementation plan for issue #9, Layer-by-Layer, Decision 9).
 * Returned only for a connection that has **completed** a sync — `status === 'active'` and
 * `last_success_at` is set (spec Business Rule 23) — unlike {@link BankConnection}, which returns
 * every connection regardless of status for the home screen's own card.
 */
export interface ConnectedBankSummary {
  id: string;
  institutionName: string;
  institutionShortName: string | undefined;
  institutionBrandColor: string | undefined;
  productCount: number;
  movementCount: number;
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
  note: string | null;
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

/**
 * A resolved merchant, in the shape `@finanzas/shared-domain`'s `suggestCategory` accepts
 * (implementation plan Decision 5, categorization flow #13). `isUserDefined` is derived from
 * `merchants.user_id !== null` (Null = seeded; set = created by the person).
 */
export interface StageMerchant {
  id: string;
  name: string;
  transactionCategoryId: string | null;
  isUserDefined: boolean;
}

/**
 * A pending movement, joined with its resolved merchant (categorization flow #13, Layer-by-Layer
 * "Database / Data Layer"). Only the fields the categorization screens and `suggestCategory`
 * actually read — never the raw Drizzle row. The shared fields are derived from `Transaction`
 * (below) rather than redeclared, so this type cannot drift if a column's type changes later —
 * the same fix already applied to `setReviewFlag`'s `flag`, `excludeTransaction`'s `reason`, and
 * `StageExclusionReason` (CodeRabbit finding on PR #79).
 */
export interface StageMovement
  extends Pick<
    Transaction,
    'id' | 'amount' | 'type' | 'dateLocal' | 'occurredAt' | 'rawDescription' | 'categorySource'
  > {
  merchant: StageMerchant | null;
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

/**
 * The bank product a movement belongs to, reduced to what `transaction-detail`'s *Producto* row
 * needs (implementation plan for issue #16, Decision 3). `mask` is `undefined` when the stored
 * `metadata` carries none — the same optionality `json.ts`'s `parseProductMetadata` already
 * returns (Testing Strategy Scenario 3).
 */
export interface ProductSummary {
  id: string;
  name: string;
  mask: string | undefined;
}

/**
 * The single-movement read `transaction-detail` opens on (implementation plan for issue #16,
 * Decision 3). Carries no inclusion predicate — an excluded movement must still open (Business
 * Rule 3). `merchantName` is the display string for the *Comercio* row; `merchant` is the
 * structured shape `suggestCategory` (`@finanzas/shared-domain`) and `CategoryPickerSheet`'s ✨
 * chip need — the plan's Layer-by-Layer only named `merchantName`, and this field is an additive
 * extension so the category picker's suggestion (Decision 7) does not need a second query.
 * `product` is `null` only if the referenced row is somehow missing (the foreign key is
 * `NOT NULL`, so this is defensive, not an expected path). `bankDescription` mirrors
 * `transaction.rawDescription` under a renamed field: the immutability guard's Scope A (Testing
 * Strategy Scenario 18, Parser-risk addendum) never allows the literal identifier `rawDescription`
 * to appear under `src/features/transaction-detail/`, so the screen tier reads the bank's own
 * description through this field instead — the rename happens once, here, at the `src/db`
 * boundary, rather than being re-derived (and re-spelling the forbidden identifier) in every
 * consuming file.
 */
export interface TransactionContext {
  transaction: Transaction;
  bankDescription: string;
  merchantName: string | null;
  merchant: StageMerchant | null;
  product: ProductSummary | null;
}

/**
 * `#screen=merchant-edit` (implementation plan for issue #14, Decision 13). `merchants` row, in
 * domain shape. `isUserDefined` is `merchants.user_id !== null` — the schema's own "Null =
 * seeded; set = created by the user" distinction (Decision 6).
 */
export interface MerchantProfile {
  id: string;
  name: string;
  transactionCategoryId: string | null;
  isUserDefined: boolean;
}

/** One `merchant_aliases` row, in domain shape — a "Actual" row on `#screen=merchant-edit&state=suggestions`.
 * `matchCount` is always freshly recomputed (Decision 7), never a stale stored value. */
export interface MerchantAliasView {
  id: string;
  rawPattern: string;
  matchType: 'prefix' | 'contains' | 'exact';
  matchCount: number;
}

/** One bar of the merchant's spending-statistics chart (Decision 12). */
export interface MerchantMonthTotal {
  /** Three-letter Spanish month abbreviation via `formatMonthAbbreviation` — e.g. `'nov'`. */
  monthLabel: string;
  /** Integer minor units — the sum of this merchant's included, peso-denominated expense
   * movements (`type = 'debit'`) in that month. */
  total: number;
}

/** `#screen=merchant-edit`'s "Estadísticas de gasto" card data (Decision 12). */
export interface MerchantSpendingStats {
  /** Exactly three entries, oldest to newest, left to right — the current month and the two
   * before it, anchored to the caller's `today`. */
  months: MerchantMonthTotal[];
  /** `Math.round(sum(months.map((m) => m.total)) / 3)` — integer minor units. */
  monthlyAverage: number;
  /** Current month vs. the one immediately before it. */
  delta: PeriodDelta;
}

/**
 * The one consistent read `readMerchantEditor` returns (Decision 13) — every state of
 * `#screen=merchant-edit` renders from this single snapshot, so the disclosure count can never
 * disagree with the "Actual" / "Agrupar" rows, and the suggestions card's counts can never
 * disagree with the stats card's totals.
 */
export interface MerchantEditorSnapshot {
  merchant: MerchantProfile;
  /** The "Actual" rows. */
  aliases: MerchantAliasView[];
  /** The "Agrupar" rows, from `suggestAliasCandidates` (`@finanzas/shared-domain`). */
  candidates: AliasCandidate[];
  /** The category-picker grid, for the merchant's observed direction (Assumption A5). */
  categories: Category[];
  stats: MerchantSpendingStats;
}

/**
 * `#screen=settings-account`'s single read (implementation plan for issue #19, Decisions 5, 10,
 * 15, 16). `rut` is `null` when no credential entry exists anywhere (Assumption A5) — the screen
 * renders an em dash rather than fabricating one. `firstLaunchAt` is the raw ISO instant;
 * `local-profile.ts`'s `buildLocalProfile` derives the displayed month from it.
 */
export interface LocalProfile {
  rut: string | null;
  firstLaunchAt: string | undefined;
  transactionCount: number;
}

/**
 * `#screen=settings`'s five live subtitle sources, read together by `useSettingsHub()`
 * (implementation plan for issue #19, Decision 15) so the hub's rows compose the same numbers the
 * account/about screens verify independently. `bankCount` / `productCount` are already reduced
 * from `listConnectedBankSummaries(db)` (issue #9) — the count of fully-synced connections and
 * the sum of their product counts — not a raw list, because the hub subtitle needs only the two
 * totals (Decision 15).
 */
export interface SettingsHubRow {
  rut: string | null;
  bankCount: number;
  productCount: number;
  reminders: ReminderSettings;
  categories: { expense: number; income: number };
  appVersion: string;
}
