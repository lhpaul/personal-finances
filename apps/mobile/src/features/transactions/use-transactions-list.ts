import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { SupportedLocale } from '../../db/labels';
import { insertManualTransaction } from '../../db/repositories/transactions';
import { createRuntimePorts, getAppDatabase } from '../../db/runtime';
import type {
  AppDatabase,
  Category,
  TransactionListFilters,
  TransactionListPage,
  TransactionListRow,
  TransactionPageParams,
  UserProduct,
} from '../../db/types';
import { SEARCH_DEBOUNCE_MS, TRANSACTIONS_PAGE_SIZE } from './constants';
import { DEFAULT_TRANSACTION_FILTERS } from './filters';
import type { ManualEntryDraft, ManualEntryError } from './manual-entry';
import { validateManualEntry } from './manual-entry';
import type { TransactionsPageData } from './read-transactions-page';
import { readTransactionsPage } from './read-transactions-page';
import { resolveSearch } from './search';

export interface UseTransactionsListParams {
  locale: SupportedLocale;
}

export interface LoadTransactionsPageArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  params: TransactionPageParams;
  locale: SupportedLocale;
  isCancelled: () => boolean;
}

export type LoadTransactionsPageResult =
  | { status: 'ready'; data: TransactionsPageData }
  | { status: 'error'; error: unknown };

/**
 * The cancellation-guarded read (implementation plan for issue #15, Concurrency addendum),
 * extracted from the hook so the guard is testable without a renderer — item #12's
 * `loadHomeData` precedent, applied to both the replacing first-page read and the appending
 * next-page read (they are the same shape; only the caller's cursor and merge behaviour differ).
 */
export async function loadTransactionsPage(
  args: LoadTransactionsPageArgs,
): Promise<LoadTransactionsPageResult | undefined> {
  const { getAppDatabase: getDb, params, locale, isCancelled } = args;
  try {
    const db = await getDb();
    if (isCancelled()) return undefined;
    return { status: 'ready', data: readTransactionsPage(db, params, locale) };
  } catch (error: unknown) {
    if (isCancelled()) return undefined;
    return { status: 'error', error };
  }
}

/** Appends a resolved next page onto the already-loaded rows — pure, so the "no row skipped or
 * repeated while appending" property is checkable without a renderer. */
export function appendPage(rows: TransactionListRow[], page: TransactionListPage): TransactionListPage {
  return { rows: [...rows, ...page.rows], nextCursor: page.nextCursor };
}

/**
 * Decides whether a just-completed read must be retried once more (found in review on PR #82):
 * if a nonblank search term was committed before `getAppDatabase()`'s first resolution, the
 * category catalogue was still empty when {@link resolveSearch} ran, so a category-name match
 * could be silently under-resolved (`categoryIds: []`) even though the person's category
 * genuinely exists. Once a read reports a nonempty catalogue for the first time, retry the same
 * committed term exactly once against it — `alreadyRetried` makes the retry one-shot, so this can
 * never loop.
 *
 * A blank search term never needs this: `resolveSearch('', …)` returns `null` regardless of the
 * catalogue.
 */
export function shouldRetryForCategoryBootstrap(args: {
  categoriesBeforeRequest: Category[];
  committedSearchTerm: string;
  categoriesAfterRequest: Category[];
  alreadyRetried: boolean;
}): boolean {
  const { categoriesBeforeRequest, committedSearchTerm, categoriesAfterRequest, alreadyRetried } = args;
  if (alreadyRetried) return false;
  if (committedSearchTerm === '') return false;
  if (categoriesBeforeRequest.length > 0) return false;
  return categoriesAfterRequest.length > 0;
}

export type TransactionsListState =
  | { status: 'pending' }
  | {
      status: 'ready';
      rows: TransactionListRow[];
      hasNextPage: boolean;
      monthCounts: TransactionsPageData['monthCounts'];
      categories: Category[];
      products: UserProduct[];
    }
  | { status: 'error'; error: unknown };

export interface UseTransactionsListResult {
  state: TransactionsListState;
  filters: TransactionListFilters;
  searchInput: string;
  committedSearchTerm: string;
  isAppending: boolean;
  setSearchInput: (value: string) => void;
  applyFilters: (next: TransactionListFilters) => void;
  loadNextPage: () => void;
  submitManualEntry: (draft: ManualEntryDraft) => Promise<ManualEntryError | null>;
}

/**
 * `transactions`'s single feature hook (implementation plan for issue #15, Decision 1). Awaits
 * `getAppDatabase()` (item #8's memoized runtime handle) and then calls `readTransactionsPage`.
 * No provider, no query client — every screen in the app reads the database the same way.
 *
 * A monotonically increasing `requestToken` is captured when a read starts and compared before
 * `setState`; a read whose token is no longer current is discarded (Concurrency addendum). This
 * subsumes the plain `cancelled` boolean item #12 uses, because this screen has an *appending*
 * read as well as a *replacing* one and needs to know which generation a resolved append belongs
 * to.
 */
export function useTransactionsList({ locale }: UseTransactionsListParams): UseTransactionsListResult {
  const [filters, setFilters] = useState<TransactionListFilters>(DEFAULT_TRANSACTION_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [committedSearchTerm, setCommittedSearchTerm] = useState('');
  const [state, setState] = useState<TransactionsListState>({ status: 'pending' });
  const [isAppending, setIsAppending] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const requestTokenRef = useRef(0);
  const hasFocusedOnce = useRef(false);
  // One-shot latch for the category-catalogue bootstrap retry (Concurrency addendum, found in
  // review on PR #82) — set once the catalogue is known to be nonempty, or once a retry has
  // already been issued, whichever comes first.
  const categoryBootstrapSettledRef = useRef(false);
  // Held so `loadNextPage` and `submitManualEntry` can read the latest snapshot without becoming
  // an effect dependency themselves.
  const latestRef = useRef({ filters, committedSearchTerm, state, locale });
  latestRef.current = { filters, committedSearchTerm, state, locale };

  // Decision 5: debounces the raw input into a committed term, cleared on unmount/change — the
  // only timer this screen owns.
  useEffect(() => {
    const handle = setTimeout(() => setCommittedSearchTerm(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useFocusEffect(
    useCallback(() => {
      // The mount effect below already performs the first read; only a later re-focus should
      // trigger a re-read (item #12's `useHomeData` precedent) — a movement categorized or
      // excluded elsewhere (#13, #16) is reflected on return.
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      setReloadToken((token) => token + 1);
    }, []),
  );

  useEffect(() => {
    const myToken = requestTokenRef.current + 1;
    requestTokenRef.current = myToken;
    setIsAppending(false);

    const categoriesBeforeRequest = state.status === 'ready' ? state.categories : [];
    const search = resolveSearch(committedSearchTerm, categoriesBeforeRequest);

    loadTransactionsPage({
      getAppDatabase,
      params: {
        filters,
        search,
        cursor: null,
        limit: TRANSACTIONS_PAGE_SIZE,
      },
      locale,
      isCancelled: () => requestTokenRef.current !== myToken,
    }).then((result) => {
      if (result === undefined || requestTokenRef.current !== myToken) return;
      if (result.status === 'error') {
        setState({ status: 'error', error: result.error });
        return;
      }
      setState({
        status: 'ready',
        rows: result.data.page.rows,
        hasNextPage: result.data.page.nextCursor !== null,
        monthCounts: result.data.monthCounts,
        categories: result.data.categories,
        products: result.data.products,
      });

      if (
        shouldRetryForCategoryBootstrap({
          categoriesBeforeRequest,
          committedSearchTerm,
          categoriesAfterRequest: result.data.categories,
          alreadyRetried: categoryBootstrapSettledRef.current,
        })
      ) {
        categoryBootstrapSettledRef.current = true;
        setReloadToken((token) => token + 1);
      } else if (result.data.categories.length > 0) {
        categoryBootstrapSettledRef.current = true;
      }
    });
    // `state.categories` is deliberately not a dependency: it is read once per run through
    // `latestRef`-free direct closure over `state` at effect-definition time, which already
    // re-runs this effect on every `state` change would be wrong — category resolution only
    // needs *a* recent catalogue, not the one this very read is about to replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, committedSearchTerm, locale, reloadToken]);

  const loadNextPage = useCallback(() => {
    const current = latestRef.current;
    if (current.state.status !== 'ready' || !current.state.hasNextPage) return;
    const cursorRow = current.state.rows[current.state.rows.length - 1];
    if (cursorRow === undefined) return;

    const myToken = requestTokenRef.current + 1;
    requestTokenRef.current = myToken;
    setIsAppending(true);

    const search = resolveSearch(current.committedSearchTerm, current.state.categories);
    loadTransactionsPage({
      getAppDatabase,
      params: {
        filters: current.filters,
        search,
        cursor: { dateLocal: cursorRow.dateLocal, id: cursorRow.id },
        limit: TRANSACTIONS_PAGE_SIZE,
      },
      locale: current.locale,
      isCancelled: () => requestTokenRef.current !== myToken,
    }).then((result) => {
      // Found in review on PR #82: check the token *before* clearing the indicator — otherwise
      // a stale, superseded response could clear `isAppending` while a newer append (from a
      // second overlapping `onEndReached`) is still genuinely in flight.
      if (result === undefined || requestTokenRef.current !== myToken) return;
      setIsAppending(false);
      if (result.status === 'error') {
        setState({ status: 'error', error: result.error });
        return;
      }
      setState((prev) => {
        if (prev.status !== 'ready') return prev;
        const merged = appendPage(prev.rows, result.data.page);
        return {
          status: 'ready',
          rows: merged.rows,
          hasNextPage: merged.nextCursor !== null,
          monthCounts: result.data.monthCounts,
          categories: result.data.categories,
          products: result.data.products,
        };
      });
    });
  }, []);

  const applyFilters = useCallback((next: TransactionListFilters) => setFilters(next), []);

  const submitManualEntry = useCallback(async (draft: ManualEntryDraft): Promise<ManualEntryError | null> => {
    const validated = validateManualEntry(draft);
    if ('field' in validated) return validated;

    const db = await getAppDatabase();
    await insertManualTransaction(db, validated, createRuntimePorts());
    setReloadToken((token) => token + 1);
    return null;
  }, []);

  // Surfaces a bootstrap or read failure to the route's `ErrorBoundary` (concurrency addendum).
  if (state.status === 'error') throw state.error;

  return {
    state,
    filters,
    searchInput,
    committedSearchTerm,
    isAppending,
    setSearchInput,
    applyFilters,
    loadNextPage,
    submitManualEntry,
  };
}
