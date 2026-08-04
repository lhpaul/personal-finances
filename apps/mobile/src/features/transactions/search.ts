import { normalizeDescription } from '@finanzas/shared-domain';

import type { Category, TransactionSearch } from '../../db/types';

/**
 * Resolves a raw search box value into a {@link TransactionSearch} (implementation plan for issue
 * #15, Decision 5). Trims the term and, separately, resolves which category ids it matches by
 * name — comparing `normalizeDescription(categoryName)` against `normalizeDescription(term)`, so
 * category-name matching is accent- and case-insensitive by construction (Assumption A8).
 * Returns `null` for a blank or whitespace-only term, which the caller reads as "no search
 * active". Builds no SQL and no `LIKE` pattern — the repository owns that.
 */
export function resolveSearch(term: string, categories: Category[]): TransactionSearch | null {
  const trimmed = term.trim();
  if (trimmed === '') return null;

  const normalizedTerm = normalizeDescription(trimmed);
  const categoryIds = categories
    .filter((category) => normalizeDescription(category.name).includes(normalizedTerm))
    .map((category) => category.id);

  return { term: trimmed, categoryIds };
}
