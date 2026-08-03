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
 * actually read — never the raw Drizzle row.
 */
export interface StageMovement {
  id: string;
  amount: number;
  type: 'debit' | 'credit';
  dateLocal: string;
  occurredAt: string;
  rawDescription: string;
  categorySource: 'auto' | 'user' | 'rule' | null;
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
