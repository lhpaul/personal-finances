/**
 * Resolves which of the four manifest states (`list`, `search`, `filters`, `empty`) the
 * `transactions` screen renders (implementation plan for issue #15, Decision 9). The order is
 * total, so exactly one state is always selected.
 */

export type TransactionsScreenState = 'list' | 'search' | 'filters' | 'empty';

export interface TransactionsStateInput {
  filterSheetOpen: boolean;
  searchTerm: string;
  resultCount: number;
}

/**
 * `filters` outranks the others because the mockup's `filters` state draws the sheet **over**
 * the populated list body (`data-states="list filters"` on the same block). `empty` outranks
 * `search` because the mockup's `empty` state also draws a focused search box (`🔍 zzz`) — the
 * empty result is what distinguishes them.
 */
export function resolveTransactionsState({
  filterSheetOpen,
  searchTerm,
  resultCount,
}: TransactionsStateInput): TransactionsScreenState {
  if (filterSheetOpen) return 'filters';
  if (resultCount === 0) return 'empty';
  if (searchTerm !== '') return 'search';
  return 'list';
}
