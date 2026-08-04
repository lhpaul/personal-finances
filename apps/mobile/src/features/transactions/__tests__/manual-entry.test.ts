import type { ManualEntryDraft } from '../manual-entry';
import { validateManualEntry } from '../manual-entry';

function draft(overrides: Partial<ManualEntryDraft> = {}): ManualEntryDraft {
  return {
    amountText: '5000',
    description: 'Efectivo prestado',
    type: 'debit',
    productId: 'product-1',
    ...overrides,
  };
}

/** Scenario 22 of the transactions-list implementation plan (Decision 12). */
describe('validateManualEntry', () => {
  it('rejects a blank description', () => {
    expect(validateManualEntry(draft({ description: '' }))).toEqual({ field: 'description' });
    expect(validateManualEntry(draft({ description: '   ' }))).toEqual({ field: 'description' });
  });

  it('rejects a non-numeric amount', () => {
    expect(validateManualEntry(draft({ amountText: 'abc' }))).toEqual({ field: 'amount' });
    expect(validateManualEntry(draft({ amountText: '12.5' }))).toEqual({ field: 'amount' });
    expect(validateManualEntry(draft({ amountText: '-100' }))).toEqual({ field: 'amount' });
  });

  it('rejects 0', () => {
    expect(validateManualEntry(draft({ amountText: '0' }))).toEqual({ field: 'amount' });
  });

  it('rejects a negative amount', () => {
    expect(validateManualEntry(draft({ amountText: '-1' }))).toEqual({ field: 'amount' });
  });

  it('rejects a missing product', () => {
    expect(validateManualEntry(draft({ productId: null }))).toEqual({ field: 'product' });
  });

  it('accepts a valid draft, trimming the description and parsing the amount', () => {
    const result = validateManualEntry(draft({ description: '  Efectivo prestado  ', amountText: '5000' }));
    expect(result).toEqual({
      userFinancialProductId: 'product-1',
      type: 'debit',
      amount: 5000,
      rawDescription: 'Efectivo prestado',
    });
  });

  it('accepts a credit draft', () => {
    const result = validateManualEntry(draft({ type: 'credit', amountText: '1200000' }));
    expect(result).toEqual({
      userFinancialProductId: 'product-1',
      type: 'credit',
      amount: 1200000,
      rawDescription: 'Efectivo prestado',
    });
  });
});
