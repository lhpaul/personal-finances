import type { CategorySuggestion } from '@finanzas/shared-domain';

import type { Category } from '../../../db/types';
import { MAX_CATEGORY_CHIPS, buildCategoryChoices } from '../category-choices';

/** Categorization flow (#13) implementation plan Testing Strategy, Scenario 15 (AC7, AC8, AC9). */

function category(id: string, sortOrder: number, income = false): Category {
  return { id, slug: id, income, name: id, emoji: '🏷️', sortOrder };
}

const TAXONOMY_EXPENSE: Category[] = [
  category('comida', 1),
  category('supermercado', 2),
  category('transporte', 3),
  category('compras', 4),
  category('otros-gasto', 10),
];

describe('buildCategoryChoices', () => {
  it('puts the suggestion first with the suggested flag, when a suggestion exists (AC8)', () => {
    const suggestion: CategorySuggestion = { transactionCategoryId: 'compras', source: 'auto' };
    const result = buildCategoryChoices({
      suggestion,
      used: [category('comida', 1), category('transporte', 3)],
      taxonomy: TAXONOMY_EXPENSE,
    });

    expect(result[0]).toEqual({ category: category('compras', 4), suggested: true });
    expect(result.filter((c) => c.suggested)).toHaveLength(1);
  });

  it('no chip carries the suggested flag when there is no suggestion (AC8)', () => {
    const result = buildCategoryChoices({
      suggestion: null,
      used: [category('comida', 1)],
      taxonomy: TAXONOMY_EXPENSE,
    });
    expect(result.every((c) => !c.suggested)).toBe(true);
  });

  it('never returns more than MAX_CATEGORY_CHIPS entries', () => {
    const bigTaxonomy = Array.from({ length: 12 }, (_, i) => category(`cat-${i}`, i));
    const result = buildCategoryChoices({ suggestion: null, used: [], taxonomy: bigTaxonomy });
    expect(result.length).toBeLessThanOrEqual(MAX_CATEGORY_CHIPS);
  });

  it('falls back to plain taxonomy order when nothing has been used yet (Decision 6)', () => {
    const result = buildCategoryChoices({ suggestion: null, used: [], taxonomy: TAXONOMY_EXPENSE });
    expect(result.map((c) => c.category.id)).toEqual(TAXONOMY_EXPENSE.map((c) => c.id));
  });

  it('excludes the suggested category from the "used" list, even if the caller did not already', () => {
    const suggestion: CategorySuggestion = { transactionCategoryId: 'comida', source: 'rule' };
    const result = buildCategoryChoices({
      suggestion,
      used: [category('comida', 1), category('transporte', 3)],
      taxonomy: TAXONOMY_EXPENSE,
    });
    expect(result.filter((c) => c.category.id === 'comida')).toHaveLength(1);
    expect(result[0]?.category.id).toBe('comida');
  });

  it('only offers categories from the given taxonomy — an income taxonomy never yields an expense category and vice versa (AC7)', () => {
    const incomeTaxonomy: Category[] = [category('sueldo', 1, true), category('freelance', 2, true)];
    const result = buildCategoryChoices({ suggestion: null, used: [], taxonomy: incomeTaxonomy });
    expect(result.every((c) => c.category.income === true)).toBe(true);
  });
});
