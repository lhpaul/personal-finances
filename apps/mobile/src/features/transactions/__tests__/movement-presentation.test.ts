import type { TransactionListRow } from '../../../db/types';
import { describeMovement } from '../movement-presentation';

function row(overrides: Partial<TransactionListRow>): TransactionListRow {
  return {
    id: 'row-1',
    dateLocal: '2026-01-27',
    amount: 12000,
    type: 'debit',
    rawDescription: 'RAW DESCRIPTION',
    note: null,
    excludedAt: null,
    exclusionReason: null,
    includedAmount: null,
    merchantName: undefined,
    merchantEmoji: undefined,
    categoryName: undefined,
    categoryEmoji: undefined,
    ...overrides,
  };
}

/**
 * Scenario 20 of the transactions-list implementation plan: reproduces all nine drawn rows
 * (Assumptions A9-A11, brief AC2).
 */
describe('describeMovement', () => {
  it('A9: prefers the merchant emoji, then the category emoji, then the direction fallback', () => {
    expect(describeMovement(row({ merchantEmoji: '🛒', categoryEmoji: '🍔' })).icon).toBe('🛒');
    expect(describeMovement(row({ merchantEmoji: undefined, categoryEmoji: '🍔' })).icon).toBe('🍔');
    expect(describeMovement(row({ type: 'credit', merchantEmoji: undefined, categoryEmoji: undefined })).icon).toBe(
      '💰',
    );
    expect(describeMovement(row({ type: 'debit', merchantEmoji: undefined, categoryEmoji: undefined })).icon).toBe(
      '💳',
    );
  });

  it('A10: an uncategorized debit is state="pending" with a pending meta descriptor', () => {
    const result = describeMovement(row({ type: 'debit', categoryName: undefined }));
    expect(result.state).toBe('pending');
    expect(result.meta).toEqual({ kind: 'pending' });
  });

  it('A10: an uncategorized credit is not pending — pending is a debit-only warning', () => {
    const result = describeMovement(row({ type: 'credit', categoryName: undefined }));
    expect(result.state).toBe('default');
    expect(result.meta).toEqual({ kind: 'plain', dateLocal: '2026-01-27', categoryName: undefined, note: undefined });
  });

  it('A10: a categorized row carries the date, category and note in its plain meta', () => {
    const result = describeMovement(row({ categoryName: 'Comida', note: 'Compras semanales' }));
    expect(result.state).toBe('default');
    expect(result.meta).toEqual({
      kind: 'plain',
      dateLocal: '2026-01-27',
      categoryName: 'Comida',
      note: 'Compras semanales',
    });
  });

  it('A11: an excluded row is state="excluded" with the exclusion reason in its meta, regardless of category', () => {
    const result = describeMovement(
      row({ excludedAt: '2026-01-14T10:05:00.000Z', exclusionReason: 'shared_expense', categoryName: 'Comida' }),
    );
    expect(result.state).toBe('excluded');
    expect(result.meta).toEqual({ kind: 'excluded', dateLocal: '2026-01-27', reason: 'shared_expense' });
  });

  it('an excluded, uncategorized debit is "excluded", never "pending" — exclusion outranks the categorization warning', () => {
    const result = describeMovement(
      row({ excludedAt: '2026-01-14T10:05:00.000Z', exclusionReason: 'other', categoryName: undefined }),
    );
    expect(result.state).toBe('excluded');
  });

  it('a credit renders with the "in" direction and a "+" via formatClp', () => {
    const result = describeMovement(row({ type: 'credit', amount: 2500000 }));
    expect(result.direction).toBe('in');
    expect(result.amount).toBe('+$2.500.000');
  });

  it('a debit renders with the "out" direction and no sign', () => {
    const result = describeMovement(row({ type: 'debit', amount: 35000 }));
    expect(result.direction).toBe('out');
    expect(result.amount).toBe('$35.000');
  });

  it('the row name prefers the merchant name over the raw description', () => {
    expect(describeMovement(row({ merchantName: 'Líder', rawDescription: 'LIDER SUPERMERCADO' })).name).toBe(
      'Líder',
    );
    expect(describeMovement(row({ merchantName: undefined, rawDescription: 'UBER BV' })).name).toBe('UBER BV');
  });
});
