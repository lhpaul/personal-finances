import type { Transaction } from '../../db/types';

/**
 * `transaction-detail` (#16) implementation plan Decision 4: state resolution, the
 * auto-suggestion caption predicate, and the drawn action set. Pure — no React, no SQL.
 */
export type DetailState = 'categorized' | 'uncategorized' | 'excluded';

/**
 * `excluded` outranks everything, then `categorized`, then `uncategorized` (Decision 4). The
 * category row is data, not state: an excluded movement that was never categorized still shows
 * the "Sin categorizar" badge, and `resolveDetailState` never inspects the category to decide
 * `excluded` vs. not — only `excludedAt`.
 */
export function resolveDetailState(transaction: Transaction): DetailState {
  if (transaction.excludedAt !== null) return 'excluded';
  return transaction.transactionCategoryId !== null ? 'categorized' : 'uncategorized';
}

/**
 * AC2: *"Categoría sugerida automáticamente"* shows only when `category_source = 'auto'` **and**
 * a category is present — a `category_source` predicate, never a state predicate (Decision 4).
 * The mockup's `excluded` sample simply happens not to be auto-categorized; this function does
 * not special-case `excluded` to make that true.
 */
export function showsAutoSuggestionCaption(transaction: Transaction): boolean {
  return transaction.transactionCategoryId !== null && transaction.categorySource === 'auto';
}

/**
 * The drawn action kinds, one per `mu-btn-stack` block in `#screen=transaction-detail` (brief
 * actions, Decision 4). `exclude-sheet` is not a fourth `DetailState` — it is the `categorized` /
 * `uncategorized` screen with `ExcludeSheet` visible, drawing the same button stack behind the
 * overlay (Decision 4), so this function is never called with a fourth value.
 */
export type DetailAction = 'categorize' | 'change_category' | 'merchant' | 'exclude' | 'reinclude';

/**
 * Returns the drawn action list for `state`, omitting the merchant shortcut when no merchant
 * resolved for this movement (Decision 8, Assumption A6). `excluded` offers exactly one action
 * regardless of `hasMerchant` — the mockup draws no merchant shortcut on that state.
 */
export function resolveActionSet(state: DetailState, hasMerchant: boolean): DetailAction[] {
  if (state === 'excluded') return ['reinclude'];

  const actions: DetailAction[] = [state === 'categorized' ? 'change_category' : 'categorize'];
  if (hasMerchant) actions.push('merchant');
  actions.push('exclude');
  return actions;
}
