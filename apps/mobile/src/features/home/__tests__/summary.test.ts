import { PERCENTAGE_TENTHS_TOTAL } from '@finanzas/shared-domain';

import type { DirectionCategoryTotal } from '../../../db/types';
import { theme } from '../../../theme';
import { buildCategoryBreakdown, buildFinancialSummary } from '../summary';

/** Scenarios 11-12 of the home-screen implementation plan's Testing Strategy (Decision 3,
 * Assumption A6). */
describe('buildFinancialSummary', () => {
  it('computes the balance as income minus expenses and reports per-direction movement counts', () => {
    const totals: DirectionCategoryTotal[] = [
      { type: 'credit', transactionCategoryId: null, total: 3_700_000, movementCount: 2 },
      { type: 'debit', transactionCategoryId: 'comida', total: 900_000, movementCount: 18 },
      { type: 'debit', transactionCategoryId: 'compras', total: 500_000, movementCount: 6 },
    ];

    expect(buildFinancialSummary(totals)).toEqual({
      incomeTotal: 3_700_000,
      incomeMovementCount: 2,
      expenseTotal: 1_400_000,
      expenseMovementCount: 24,
      balance: 2_300_000,
    });
  });

  it('returns zeros for an empty input', () => {
    expect(buildFinancialSummary([])).toEqual({
      incomeTotal: 0,
      incomeMovementCount: 0,
      expenseTotal: 0,
      expenseMovementCount: 0,
      balance: 0,
    });
  });
});

describe('buildCategoryBreakdown', () => {
  it("percentages sum to exactly PERCENTAGE_TENTHS_TOTAL, including a three-equal-bucket tie, and the uncategorized bucket sorts last among equals with the slate fill", () => {
    const totals: DirectionCategoryTotal[] = [
      { type: 'debit', transactionCategoryId: 'comida', total: 100_000, movementCount: 1 },
      { type: 'debit', transactionCategoryId: 'compras', total: 100_000, movementCount: 1 },
      { type: 'debit', transactionCategoryId: null, total: 100_000, movementCount: 1 },
      // A credit row must never leak into the expense breakdown.
      { type: 'credit', transactionCategoryId: null, total: 999_999, movementCount: 1 },
    ];

    const buckets = buildCategoryBreakdown(totals);

    expect(buckets).toHaveLength(3);
    const percentSum = buckets.reduce((sum, bucket) => sum + bucket.percentTenths, 0);
    expect(percentSum).toBe(PERCENTAGE_TENTHS_TOTAL);

    // The uncategorized bucket sorts last among the three-way tie.
    expect(buckets[2]?.transactionCategoryId).toBeNull();
    expect(buckets[2]?.fillColor).toBe(theme.colors.palette.slate['300']);
    expect(buckets[0]?.transactionCategoryId).not.toBeNull();
    expect(buckets[1]?.transactionCategoryId).not.toBeNull();
  });

  it('a single bucket takes 100% and a ratio of 1', () => {
    const totals: DirectionCategoryTotal[] = [
      { type: 'debit', transactionCategoryId: 'comida', total: 42_000, movementCount: 3 },
    ];
    const buckets = buildCategoryBreakdown(totals);
    expect(buckets).toEqual([
      expect.objectContaining({ transactionCategoryId: 'comida', percentTenths: PERCENTAGE_TENTHS_TOTAL, ratio: 1 }),
    ]);
  });

  it('bar ratios are relative to the largest bucket, sorted by total descending', () => {
    const totals: DirectionCategoryTotal[] = [
      { type: 'debit', transactionCategoryId: 'comida', total: 279_000, movementCount: 5 },
      { type: 'debit', transactionCategoryId: 'compras', total: 235_000, movementCount: 2 },
      { type: 'debit', transactionCategoryId: 'salud', total: 193_000, movementCount: 3 },
      { type: 'debit', transactionCategoryId: null, total: 156_000, movementCount: 3 },
    ];

    const buckets = buildCategoryBreakdown(totals);
    expect(buckets.map((bucket) => bucket.transactionCategoryId)).toEqual([
      'comida',
      'compras',
      'salud',
      null,
    ]);
    expect(buckets[0]?.ratio).toBe(1);
    expect(buckets[1]?.ratio).toBeCloseTo(235_000 / 279_000, 5);
    expect(buckets[3]?.fillColor).toBe(theme.colors.palette.slate['300']);
  });

  it('returns an empty array for no expense rows', () => {
    expect(buildCategoryBreakdown([])).toEqual([]);
  });

  it('keeps percentages and ratios at zero when every expense bucket totals zero (found in review)', () => {
    const totals: DirectionCategoryTotal[] = [
      { type: 'debit', transactionCategoryId: 'comida', total: 0, movementCount: 0 },
      { type: 'debit', transactionCategoryId: null, total: 0, movementCount: 0 },
    ];

    const buckets = buildCategoryBreakdown(totals);

    expect(buckets).toHaveLength(2);
    for (const bucket of buckets) {
      expect(bucket.percentTenths).toBe(0);
      expect(bucket.ratio).toBe(0);
    }
  });
});
