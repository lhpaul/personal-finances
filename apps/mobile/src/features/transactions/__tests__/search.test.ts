import type { Category } from '../../../db/types';
import { resolveSearch } from '../search';

function category(overrides: Partial<Category> & { id: string; name: string }): Category {
  return { slug: overrides.id, income: false, emoji: undefined, sortOrder: 0, ...overrides };
}

/** Scenario 21 of the transactions-list implementation plan (Decision 5). */
describe('resolveSearch', () => {
  const categories: Category[] = [
    category({ id: 'comida', name: 'Comida' }),
    category({ id: 'nunoa', name: 'Ñuñoa' }),
  ];

  it('returns null for a blank term', () => {
    expect(resolveSearch('', categories)).toBeNull();
  });

  it('returns null for a whitespace-only term', () => {
    expect(resolveSearch('   ', categories)).toBeNull();
  });

  it('trims the term', () => {
    expect(resolveSearch('  uber  ', categories)?.term).toBe('uber');
  });

  it('resolves matching category ids, case-insensitively', () => {
    expect(resolveSearch('comida', categories)?.categoryIds).toEqual(['comida']);
    expect(resolveSearch('COMIDA', categories)?.categoryIds).toEqual(['comida']);
  });

  it('resolves matching category ids, diacritic-insensitively (Assumption A8)', () => {
    expect(resolveSearch('nunoa', categories)?.categoryIds).toEqual(['nunoa']);
  });

  it('returns an empty categoryIds array when nothing matches', () => {
    expect(resolveSearch('uber', categories)?.categoryIds).toEqual([]);
  });

  it('builds no SQL and no LIKE pattern — only the plain term and resolved ids', () => {
    const result = resolveSearch('Comida', categories);
    expect(result).toEqual({ term: 'Comida', categoryIds: ['comida'] });
  });
});
