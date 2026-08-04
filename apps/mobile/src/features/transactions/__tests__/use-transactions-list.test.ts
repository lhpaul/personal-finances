import type { AppDatabase, Category, TransactionListPage, TransactionListRow, TransactionPageParams } from '../../../db/types';
import { appendPage, loadTransactionsPage, shouldRetryForCategoryBootstrap } from '../use-transactions-list';

// `jest.mock` calls are hoisted above every import by `babel-plugin-jest-hoist` — mirrors item
// #12's `use-home-data.test.ts` precedent. `readTransactionsPage` is stubbed rather than given a
// real `AppDatabase`, because this suite exercises the cancellation/token race, not the
// four-repository-call composition (that is Scenario 15, against a real store).
jest.mock('../read-transactions-page', () => ({
  readTransactionsPage: jest.fn(() => ({
    page: { rows: [], nextCursor: null },
    monthCounts: [],
    categories: [],
    products: [],
  })),
}));

/**
 * Scenario 24 of the transactions-list implementation plan (Concurrency addendum). Driven as a
 * plain function over a stubbed `getAppDatabase`, following item #2's no-renderer precedent.
 */
describe('loadTransactionsPage', () => {
  const params: TransactionPageParams = {
    filters: { direction: 'all', categorization: 'all', productId: null, showExcluded: true },
    search: null,
    cursor: null,
    limit: 50,
  };

  it('resolves to a ready state when getAppDatabase resolves and isCancelled never flips', async () => {
    const fakeDb = {} as AppDatabase;
    const getAppDatabase = jest.fn().mockResolvedValue(fakeDb);

    const result = await loadTransactionsPage({ getAppDatabase, params, locale: 'es', isCancelled: () => false });

    expect(result?.status).toBe('ready');
  });

  it('discards a resolved read after unmount: returns undefined once isCancelled flips true before the handle resolves', async () => {
    let cancelled = false;
    const getAppDatabase = jest.fn().mockImplementation(() => {
      cancelled = true; // simulates teardown racing the in-flight promise
      return Promise.resolve({} as AppDatabase);
    });

    const result = await loadTransactionsPage({ getAppDatabase, params, locale: 'es', isCancelled: () => cancelled });

    expect(result).toBeUndefined();
  });

  it('resolves to an error state when getAppDatabase rejects and isCancelled never flips', async () => {
    const rejection = new Error('bootstrap failed');
    const getAppDatabase = jest.fn().mockRejectedValue(rejection);

    const result = await loadTransactionsPage({ getAppDatabase, params, locale: 'es', isCancelled: () => false });

    expect(result).toEqual({ status: 'error', error: rejection });
  });

  it('a newer search token supersedes an in-flight read rather than racing it into state', async () => {
    const fakeDb = {} as AppDatabase;
    // Models two overlapping reads (e.g. two keystrokes): the first is superseded before it
    // resolves, the second is the live one. The hook's own `requestTokenRef` comparison is what
    // `isCancelled` stands in for here.
    const firstIsCancelled = jest.fn().mockReturnValue(true);
    const secondIsCancelled = jest.fn().mockReturnValue(false);

    const [first, second] = await Promise.all([
      loadTransactionsPage({
        getAppDatabase: () => Promise.resolve(fakeDb),
        params,
        locale: 'es',
        isCancelled: firstIsCancelled,
      }),
      loadTransactionsPage({
        getAppDatabase: () => Promise.resolve(fakeDb),
        params,
        locale: 'es',
        isCancelled: secondIsCancelled,
      }),
    ]);

    expect(first).toBeUndefined();
    expect(second?.status).toBe('ready');
  });

  it('an in-flight page append is discarded when the filters change mid-flight (the append\'s own isCancelled flips)', async () => {
    const fakeDb = {} as AppDatabase;
    // Models `loadNextPage` in flight when `applyFilters` bumps the request token — the append's
    // `isCancelled` (bound to the token captured when the append started) flips true.
    let filtersChanged = false;
    const appendResult = loadTransactionsPage({
      getAppDatabase: () => {
        filtersChanged = true; // the filter change "arrives" while the append awaits the handle
        return Promise.resolve(fakeDb);
      },
      params,
      locale: 'es',
      isCancelled: () => filtersChanged,
    });

    await expect(appendResult).resolves.toBeUndefined();
  });
});

function row(id: string, dateLocal: string): TransactionListRow {
  return {
    id,
    dateLocal,
    amount: 1000,
    type: 'debit',
    rawDescription: 'Movement',
    note: null,
    excludedAt: null,
    exclusionReason: null,
    includedAmount: null,
    merchantName: undefined,
    merchantEmoji: undefined,
    categoryName: undefined,
    categoryEmoji: undefined,
  };
}

describe('appendPage', () => {
  it('appends the new page\'s rows after the existing ones, with no row skipped or repeated, and adopts the new cursor', () => {
    const existing = [row('a', '2026-01-03'), row('b', '2026-01-02')];
    const page: TransactionListPage = {
      rows: [row('c', '2026-01-01')],
      nextCursor: { dateLocal: '2026-01-01', id: 'c' },
    };

    const merged = appendPage(existing, page);

    expect(merged.rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(merged.nextCursor).toEqual({ dateLocal: '2026-01-01', id: 'c' });
  });

  it('adopts a null nextCursor when the appended page was the last one', () => {
    const merged = appendPage([row('a', '2026-01-03')], { rows: [row('b', '2026-01-02')], nextCursor: null });
    expect(merged.nextCursor).toBeNull();
  });
});

const CATEGORY: Category = { id: 'comida', slug: 'comida', income: false, name: 'Comida', emoji: undefined, sortOrder: 0 };

/**
 * Found in review on PR #82 (Concurrency addendum): a committed search resolved while the
 * category catalogue was still empty (database bootstrap) must be retried exactly once, once the
 * catalogue becomes available — never for a blank term, never more than once.
 */
describe('shouldRetryForCategoryBootstrap', () => {
  it('retries once when a nonblank term was committed before the catalogue was available', () => {
    expect(
      shouldRetryForCategoryBootstrap({
        categoriesBeforeRequest: [],
        committedSearchTerm: 'comida',
        categoriesAfterRequest: [CATEGORY],
        alreadyRetried: false,
      }),
    ).toBe(true);
  });

  it('never retries for a blank search term, regardless of catalogue state', () => {
    expect(
      shouldRetryForCategoryBootstrap({
        categoriesBeforeRequest: [],
        committedSearchTerm: '',
        categoriesAfterRequest: [CATEGORY],
        alreadyRetried: false,
      }),
    ).toBe(false);
  });

  it('does not retry once the catalogue was already known to be nonempty before this request', () => {
    expect(
      shouldRetryForCategoryBootstrap({
        categoriesBeforeRequest: [CATEGORY],
        committedSearchTerm: 'comida',
        categoriesAfterRequest: [CATEGORY],
        alreadyRetried: false,
      }),
    ).toBe(false);
  });

  it('does not retry when the catalogue is still empty after this request (a genuinely empty store)', () => {
    expect(
      shouldRetryForCategoryBootstrap({
        categoriesBeforeRequest: [],
        committedSearchTerm: 'comida',
        categoriesAfterRequest: [],
        alreadyRetried: false,
      }),
    ).toBe(false);
  });

  it('never retries a second time once alreadyRetried is true (one-shot latch)', () => {
    expect(
      shouldRetryForCategoryBootstrap({
        categoriesBeforeRequest: [],
        committedSearchTerm: 'comida',
        categoriesAfterRequest: [CATEGORY],
        alreadyRetried: true,
      }),
    ).toBe(false);
  });
});
