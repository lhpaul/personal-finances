import type { CategorySuggestion } from '@finanzas/shared-domain';

import type { Category } from '../../db/types';

/**
 * Categorization flow (#13) implementation plan Decision 6, spec A7, AC7, AC8, AC9.
 *
 * Chip order: the suggestion first (when there is one), then the categories of the movement's
 * own direction the person has actually used — ordered by usage descending, ties broken by
 * `sortOrder` (already the order `listMostUsedCategories` returns) — falling back to plain
 * taxonomy order when nothing has been used yet, truncated to `MAX_CATEGORY_CHIPS`. "Elegir
 * otra" is appended by the caller (`CategoryGrid`); it is not a `Category` and is not part of
 * this array.
 */
export const MAX_CATEGORY_CHIPS = 7;

export interface CategoryChoice {
  category: Category;
  suggested: boolean;
}

export interface BuildCategoryChoicesInput {
  suggestion: CategorySuggestion | null;
  /** Usage-ordered categories of the movement's own direction (may already exclude the
   * suggestion — this function filters again defensively either way). */
  used: Category[];
  /** The full taxonomy for the movement's own direction, in `sortOrder` order. */
  taxonomy: Category[];
}

export function buildCategoryChoices(input: BuildCategoryChoicesInput): CategoryChoice[] {
  const suggested = input.suggestion
    ? input.taxonomy.find((category) => category.id === input.suggestion?.transactionCategoryId)
    : undefined;

  const rest = input.used.length > 0 ? input.used : input.taxonomy;
  const filteredRest = rest.filter((category) => category.id !== suggested?.id);

  const ordered: CategoryChoice[] = suggested ? [{ category: suggested, suggested: true }] : [];
  for (const category of filteredRest) {
    ordered.push({ category, suggested: false });
  }

  return ordered.slice(0, MAX_CATEGORY_CHIPS);
}
