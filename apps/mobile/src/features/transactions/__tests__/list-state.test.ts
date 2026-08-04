import { resolveTransactionsState } from '../list-state';

/** Scenario 16 of the transactions-list implementation plan (Decision 9, brief AC4). */
describe('resolveTransactionsState', () => {
  it('the sheet open with results -> filters (outranks everything)', () => {
    expect(resolveTransactionsState({ filterSheetOpen: true, searchTerm: '', resultCount: 10 })).toBe(
      'filters',
    );
  });

  it('the sheet open with no results -> filters (still outranks empty)', () => {
    expect(resolveTransactionsState({ filterSheetOpen: true, searchTerm: '', resultCount: 0 })).toBe(
      'filters',
    );
  });

  it('the sheet open with a search term and results -> filters', () => {
    expect(resolveTransactionsState({ filterSheetOpen: true, searchTerm: 'uber', resultCount: 2 })).toBe(
      'filters',
    );
  });

  it('empty with a search term, sheet closed -> empty', () => {
    expect(resolveTransactionsState({ filterSheetOpen: false, searchTerm: 'zzz', resultCount: 0 })).toBe(
      'empty',
    );
  });

  it('empty without a search term, sheet closed -> empty', () => {
    expect(resolveTransactionsState({ filterSheetOpen: false, searchTerm: '', resultCount: 0 })).toBe(
      'empty',
    );
  });

  it('a search term with results, sheet closed -> search', () => {
    expect(resolveTransactionsState({ filterSheetOpen: false, searchTerm: 'uber', resultCount: 2 })).toBe(
      'search',
    );
  });

  it('no term, results present, sheet closed -> list (the default)', () => {
    expect(resolveTransactionsState({ filterSheetOpen: false, searchTerm: '', resultCount: 13 })).toBe(
      'list',
    );
  });
});
