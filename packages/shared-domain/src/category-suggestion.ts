import type { CategorySource, Merchant } from './types';

/**
 * Category suggestion (implementation plan Decision 14; brief Scope bullet 3; Business Rule 6).
 *
 * A suggestion never overrides a human: if the movement's current `categorySource` is `'user'`,
 * `suggestCategory` returns `null` no matter what the merchant says. Otherwise it returns the
 * resolved merchant's default category with `source: 'rule'` when the merchant is
 * user-configured (`merchants.user_id !== null`) or `source: 'auto'` when it is seeded — the
 * only signal in the schema that separates the three provenance values without inventing a
 * column. It returns `null` when there is no merchant or the merchant has no default category.
 * It never mutates; persistence is the caller's decision.
 */
export interface CategorySuggestion {
  transactionCategoryId: string;
  source: CategorySource;
}

export interface SuggestCategoryInput {
  currentCategorySource: CategorySource | null;
  /** The already-resolved merchant for this movement (see `resolveMerchant`), or `null` if none
   * matched. */
  merchant: Merchant | null;
}

export function suggestCategory(input: SuggestCategoryInput): CategorySuggestion | null {
  if (input.currentCategorySource === 'user') return null;
  if (input.merchant === null) return null;
  if (input.merchant.transactionCategoryId === null) return null;

  return {
    transactionCategoryId: input.merchant.transactionCategoryId,
    source: input.merchant.isUserDefined ? 'rule' : 'auto',
  };
}
