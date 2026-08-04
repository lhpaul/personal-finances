import type { TransactionListFilters } from '../../../db/types';
import { activeFilterCount, DEFAULT_TRANSACTION_FILTERS, isDefaultFilters } from '../filters';

/** Scenario 17 of the transactions-list implementation plan (Decision 7, brief AC4 — the
 * predicate behind the header's dot). */
describe('isDefaultFilters / activeFilterCount', () => {
  it('is true only for DEFAULT_TRANSACTION_FILTERS itself', () => {
    expect(isDefaultFilters(DEFAULT_TRANSACTION_FILTERS)).toBe(true);
    expect(isDefaultFilters({ ...DEFAULT_TRANSACTION_FILTERS })).toBe(true);
    expect(activeFilterCount(DEFAULT_TRANSACTION_FILTERS)).toBe(0);
  });

  it.each<[string, Partial<TransactionListFilters>]>([
    ['direction changed', { direction: 'credit' }],
    ['categorization changed', { categorization: 'uncategorized' }],
    ['productId changed', { productId: 'some-product-id' }],
    ['showExcluded changed (Decision 6)', { showExcluded: false }],
  ])('is false for a single-control deviation: %s', (_label, override) => {
    const filters: TransactionListFilters = { ...DEFAULT_TRANSACTION_FILTERS, ...override };
    expect(isDefaultFilters(filters)).toBe(false);
    expect(activeFilterCount(filters)).toBe(1);
  });

  it('counts every deviating control when several differ at once', () => {
    const filters: TransactionListFilters = {
      direction: 'debit',
      categorization: 'categorized',
      productId: 'p1',
      showExcluded: false,
    };
    expect(isDefaultFilters(filters)).toBe(false);
    expect(activeFilterCount(filters)).toBe(4);
  });
});
