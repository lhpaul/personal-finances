/**
 * Shared numeric constants for the `transactions` screen (implementation plan for issue #15,
 * Decisions 4-5).
 */

/** Keyset page size (Decision 4). The repository fetches `limit + 1` rows to decide whether a
 * next page exists without a second count query. */
export const TRANSACTIONS_PAGE_SIZE = 50;

/** Debounce window, in milliseconds, between the last keystroke and the committed search term
 * (Decision 5) — the only timer this screen owns. */
export const SEARCH_DEBOUNCE_MS = 250;
