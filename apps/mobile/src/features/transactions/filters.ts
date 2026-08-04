import type { TransactionListFilters } from '../../db/types';

/**
 * The filter sheet's default state (implementation plan for issue #15, Decision 7). `showExcluded`
 * defaults to `true` — excluded movements are visible by default, attenuated (Decision 6). This is
 * the **one** named place a reversal of Decision 6 would change (Risks table).
 */
export const DEFAULT_TRANSACTION_FILTERS: TransactionListFilters = {
  direction: 'all',
  categorization: 'all',
  productId: null,
  showExcluded: true,
};

/** `true` only for a filter set identical to {@link DEFAULT_TRANSACTION_FILTERS} — the predicate
 * behind the header's `mu-head__action--dot` (AC4). */
export function isDefaultFilters(filters: TransactionListFilters): boolean {
  return (
    filters.direction === DEFAULT_TRANSACTION_FILTERS.direction &&
    filters.categorization === DEFAULT_TRANSACTION_FILTERS.categorization &&
    filters.productId === DEFAULT_TRANSACTION_FILTERS.productId &&
    filters.showExcluded === DEFAULT_TRANSACTION_FILTERS.showExcluded
  );
}

/** How many of the four controls differ from the default — not surfaced on the drawn header
 * (which shows a dot, not a count), but useful for tests and any future badge. */
export function activeFilterCount(filters: TransactionListFilters): number {
  let count = 0;
  if (filters.direction !== DEFAULT_TRANSACTION_FILTERS.direction) count += 1;
  if (filters.categorization !== DEFAULT_TRANSACTION_FILTERS.categorization) count += 1;
  if (filters.productId !== DEFAULT_TRANSACTION_FILTERS.productId) count += 1;
  if (filters.showExcluded !== DEFAULT_TRANSACTION_FILTERS.showExcluded) count += 1;
  return count;
}
