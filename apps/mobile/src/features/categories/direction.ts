/**
 * The single translation between `#screen=settings-categories`'s tab (`Segment`'s `value`) and
 * the `transaction_categories.income` column (implementation plan for issue #21, Decision 7).
 * Direction is the tab, never a field: the edit sheet has no direction control, and
 * `createUserCategory`/`renameCategory` cannot express a direction change.
 */

export type CategoryDirection = 'expense' | 'income';

export const CATEGORY_DIRECTIONS: readonly CategoryDirection[] = ['expense', 'income'];

export function incomeFlagFor(direction: CategoryDirection): 0 | 1 {
  return direction === 'income' ? 1 : 0;
}
