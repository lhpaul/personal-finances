import { resolveActionSet, resolveDetailState, showsAutoSuggestionCaption } from '../detail-state';
import type { Transaction } from '../../../db/types';

/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenarios 12-14 (Decision 4).
 */
const BASE: Transaction = {
  id: 'tx-1',
  userFinancialProductId: 'product-1',
  externalId: null,
  amount: 35000,
  type: 'debit',
  currencyCode: 'CLP',
  occurredAt: '2025-01-24T14:20:00.000Z',
  dateLocal: '2025-01-24',
  rawDescription: 'COMPRA LIDER EXPRESS',
  note: null,
  merchantId: null,
  transactionCategoryId: null,
  categorySource: null,
  reviewFlag: null,
  excludedAt: null,
  exclusionReason: null,
  exclusionNote: null,
  includedAmount: null,
  isManual: false,
  createdAt: '2025-01-24T14:20:00.000Z',
  updatedAt: '2025-01-24T14:20:00.000Z',
};

describe('resolveDetailState (Scenario 12, Decision 4)', () => {
  it('excluded outranks categorized — an excluded movement that also has a category is "excluded"', () => {
    const transaction: Transaction = {
      ...BASE,
      transactionCategoryId: 'supermercado',
      excludedAt: '2025-01-25T12:00:00.000Z',
      exclusionReason: 'shared_expense',
    };
    expect(resolveDetailState(transaction)).toBe('excluded');
  });

  it('excluded outranks uncategorized — an excluded movement with no category is still "excluded"', () => {
    const transaction: Transaction = {
      ...BASE,
      excludedAt: '2025-01-25T12:00:00.000Z',
      exclusionReason: 'other',
    };
    expect(resolveDetailState(transaction)).toBe('excluded');
  });

  it('a non-excluded movement with a category is "categorized"', () => {
    const transaction: Transaction = { ...BASE, transactionCategoryId: 'supermercado' };
    expect(resolveDetailState(transaction)).toBe('categorized');
  });

  it('a non-excluded movement with no category is "uncategorized"', () => {
    expect(resolveDetailState(BASE)).toBe('uncategorized');
  });
});

describe('showsAutoSuggestionCaption (Scenario 13, AC2)', () => {
  it('is true only for category_source = "auto" with a category present', () => {
    const transaction: Transaction = { ...BASE, transactionCategoryId: 'supermercado', categorySource: 'auto' };
    expect(showsAutoSuggestionCaption(transaction)).toBe(true);
  });

  it('is false for category_source = "user"', () => {
    const transaction: Transaction = { ...BASE, transactionCategoryId: 'supermercado', categorySource: 'user' };
    expect(showsAutoSuggestionCaption(transaction)).toBe(false);
  });

  it('is false for category_source = "rule"', () => {
    const transaction: Transaction = { ...BASE, transactionCategoryId: 'supermercado', categorySource: 'rule' };
    expect(showsAutoSuggestionCaption(transaction)).toBe(false);
  });

  it('is false for category_source = null', () => {
    const transaction: Transaction = { ...BASE, transactionCategoryId: 'supermercado', categorySource: null };
    expect(showsAutoSuggestionCaption(transaction)).toBe(false);
  });

  it('is false for a movement with no category, even if category_source were somehow "auto"', () => {
    const transaction: Transaction = { ...BASE, transactionCategoryId: null, categorySource: 'auto' };
    expect(showsAutoSuggestionCaption(transaction)).toBe(false);
  });
});

describe('resolveActionSet (Scenario 14, Decision 8, A6)', () => {
  it('uncategorized with a merchant: categorize, merchant, exclude', () => {
    expect(resolveActionSet('uncategorized', true)).toEqual(['categorize', 'merchant', 'exclude']);
  });

  it('uncategorized with no merchant omits the merchant action', () => {
    expect(resolveActionSet('uncategorized', false)).toEqual(['categorize', 'exclude']);
  });

  it('categorized with a merchant: change_category, merchant, exclude', () => {
    expect(resolveActionSet('categorized', true)).toEqual(['change_category', 'merchant', 'exclude']);
  });

  it('categorized with no merchant omits the merchant action', () => {
    expect(resolveActionSet('categorized', false)).toEqual(['change_category', 'exclude']);
  });

  it('excluded offers exactly one action, regardless of hasMerchant', () => {
    expect(resolveActionSet('excluded', true)).toEqual(['reinclude']);
    expect(resolveActionSet('excluded', false)).toEqual(['reinclude']);
  });
});
