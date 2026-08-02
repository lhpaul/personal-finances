/**
 * Canonical domain types for `@finanzas/shared-domain` (issue #5, Decision 16 —
 * `docs/best-practices/stack/typescript.md`: "Domain types are defined once, in
 * `@finanzas/shared-domain`, and re-exported").
 *
 * `DateLocal` and `Period` are **type-only** re-exports from `@finanzas/shared-utils` so a
 * screen importing domain types needs one import site; the *values* that build them
 * (`deriveDateLocal`, `getMonthPeriod`, …) stay in `shared-utils`.
 *
 * **Temporary duplication (Decision 16, tracked as a follow-up item):** item #3's plan states
 * its own row types live beside their repositories in `apps/mobile/src/db/types.ts` until a
 * later item promotes them. Until that promotion, the four literal unions below
 * (`CategorySource`, `ReviewFlag`, `ExclusionReason`, `MerchantMatchType`) are duplicated,
 * closed-set copies of `apps/mobile/src/db/types.ts`'s equivalents, both derived from
 * `docs/project/4-database-model.md`. This package cannot import from `apps/` (the purity rule
 * forbids it), so the duplication is documented rather than silent.
 */
import type { DateLocal as SharedUtilsDateLocal, Period as SharedUtilsPeriod } from '@finanzas/shared-utils';

export type DateLocal = SharedUtilsDateLocal;
export type Period = SharedUtilsPeriod;

/** `transactions.type` — the scraper's own vocabulary. Immutable bank fact (Decision 9). */
export type MovementType = 'debit' | 'credit';

/** Computed from `MovementType`, never from a category's `income` flag (Decision 9). */
export type MovementDirection = 'expense' | 'income';

/** `transactions.category_source` (data model gap #4). */
export type CategorySource = 'auto' | 'rule' | 'user';

/** `transactions.review_flag` (data model gap #5). */
export type ReviewFlag = 'review_later' | 'uncertain';

/** `transactions.exclusion_reason`. */
export type ExclusionReason =
  | 'personal_transfer'
  | 'shared_expense'
  | 'not_relevant'
  | 'cash_withdrawal'
  | 'other';

/** `merchant_aliases.match_type`, defaulting to `'prefix'` at the schema level. */
export type MerchantMatchType = 'prefix' | 'contains' | 'exact';

/**
 * A bank movement (`transactions` row), in domain shape: camelCase, money as a `number` in
 * minor units, dates as `DateLocal` strings — never a `Date`.
 */
export interface Movement {
  id: string;
  dateLocal: DateLocal;
  amount: number;
  type: MovementType;
  merchantId: string | null;
  transactionCategoryId: string | null;
  categorySource: CategorySource | null;
  reviewFlag: ReviewFlag | null;
  excludedAt: string | null;
  exclusionReason: ExclusionReason | null;
  /** **No UI in the MVP** — always `null` today (`docs/project/4-database-model.md`). The rule
   * that reads it is general; see `inclusion.ts`. */
  includedAmount: number | null;
}

/**
 * The fields the inclusion rule (`inclusion.ts`) actually reads, defined once so the shape
 * cannot drift from `Movement` (Decision 1, Layer-by-Layer).
 */
export type MovementInclusionFields = Pick<Movement, 'amount' | 'includedAmount' | 'excludedAt'>;

/** `merchants` row, in domain shape. */
export interface Merchant {
  id: string;
  name: string;
  transactionCategoryId: string | null;
  /** `merchants.user_id !== null` — the schema's own "Null = seeded; set = created by the user"
   * distinction (Decision 14). */
  isUserDefined: boolean;
}

/** `merchant_aliases` row, in domain shape. */
export interface MerchantAlias {
  id: string;
  merchantId: string;
  rawPattern: string;
  matchType: MerchantMatchType;
}

/** `transaction_categories` row, in domain shape. */
export interface TransactionCategory {
  id: string;
  income: boolean;
}
