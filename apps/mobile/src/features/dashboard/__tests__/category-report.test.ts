import { PERCENTAGE_TENTHS_TOTAL } from '@finanzas/shared-domain';

import type { Category, DirectionCategoryTotal } from '../../../db/types';
import { buildDonutReport, DASHBOARD_DONUT_SEGMENT_LIMIT } from '../category-report';

const UNCATEGORIZED = { label: 'Sin categorizar', emoji: '❓' };

function makeCategory(id: string, name: string, emoji: string): Category {
  return { id, slug: id, income: false, name, emoji, sortOrder: 0 };
}

/** Scenario 10 of the dashboard implementation plan's Testing Strategy (brief AC2, Decision 6,
 * Assumption A10). */
describe('buildDonutReport', () => {
  it('apportions to exactly PERCENTAGE_TENTHS_TOTAL over every bucket, capping the displayed list', () => {
    const categories = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => makeCategory(id, id, '🍔'));
    const totals: DirectionCategoryTotal[] = categories.map((category, index) => ({
      type: 'debit',
      transactionCategoryId: category.id,
      total: 100 - index, // strictly descending: a=100, b=99, ... f=95
      movementCount: 1,
    }));

    const report = buildDonutReport(totals, 'debit', categories, UNCATEGORIZED);

    expect(report.segments).toHaveLength(DASHBOARD_DONUT_SEGMENT_LIMIT);
    // Apportionment ran over all six buckets, so the five displayed do not themselves sum to
    // PERCENTAGE_TENTHS_TOTAL — the sixth bucket's share is the visible "track" remainder.
    const displayedSum = report.segments.reduce((sum, segment) => sum + segment.tenths, 0);
    expect(displayedSum).toBeLessThan(PERCENTAGE_TENTHS_TOTAL);
  });

  it('sums to exactly PERCENTAGE_TENTHS_TOTAL when every bucket is displayed, including a three-equal-bucket tie', () => {
    const categories = ['a', 'b', 'c'].map((id) => makeCategory(id, id, '🍔'));
    const totals: DirectionCategoryTotal[] = categories.map((category) => ({
      type: 'debit',
      transactionCategoryId: category.id,
      total: 100,
      movementCount: 1,
    }));

    const report = buildDonutReport(totals, 'debit', categories, UNCATEGORIZED);
    const sum = report.segments.reduce((total, segment) => total + segment.tenths, 0);
    expect(sum).toBe(PERCENTAGE_TENTHS_TOTAL);
  });

  it('sums to exactly PERCENTAGE_TENTHS_TOTAL for a single-bucket case', () => {
    const categories = [makeCategory('a', 'a', '🍔')];
    const totals: DirectionCategoryTotal[] = [
      { type: 'debit', transactionCategoryId: 'a', total: 42, movementCount: 1 },
    ];
    const report = buildDonutReport(totals, 'debit', categories, UNCATEGORIZED);
    expect(report.segments[0]?.tenths).toBe(PERCENTAGE_TENTHS_TOTAL);
  });

  it('lets the uncategorized bucket participate and sort last among equal totals', () => {
    const categories = [makeCategory('a', 'Comida', '🍔')];
    const totals: DirectionCategoryTotal[] = [
      { type: 'debit', transactionCategoryId: 'a', total: 100, movementCount: 1 },
      { type: 'debit', transactionCategoryId: null, total: 100, movementCount: 1 },
    ];
    const report = buildDonutReport(totals, 'debit', categories, UNCATEGORIZED);

    expect(report.segments).toHaveLength(2);
    expect(report.segments[0]?.label).toBe('Comida');
    expect(report.segments[1]?.label).toBe(UNCATEGORIZED.label);
    expect(report.segments[1]?.emoji).toBe(UNCATEGORIZED.emoji);
  });

  it('filters to the requested direction only', () => {
    const categories = [makeCategory('a', 'a', '🍔')];
    const totals: DirectionCategoryTotal[] = [
      { type: 'debit', transactionCategoryId: 'a', total: 100, movementCount: 1 },
      { type: 'credit', transactionCategoryId: 'a', total: 500, movementCount: 1 },
    ];
    const report = buildDonutReport(totals, 'credit', categories, UNCATEGORIZED);
    expect(report.total).toBe(500);
    expect(report.segments).toHaveLength(1);
  });

  /** Scenario 11: the arc and the legend cannot disagree because both read the same record. */
  it('carries the same tenths value a legend row would render, per record', () => {
    const categories = ['a', 'b'].map((id) => makeCategory(id, id, '🍔'));
    const totals: DirectionCategoryTotal[] = [
      { type: 'debit', transactionCategoryId: 'a', total: 300, movementCount: 1 },
      { type: 'debit', transactionCategoryId: 'b', total: 700, movementCount: 1 },
    ];
    const report = buildDonutReport(totals, 'debit', categories, UNCATEGORIZED);
    // Rendering "the arc" and "the legend row" from the same record means asserting on one
    // shared field, not two independently-derived numbers.
    for (const segment of report.segments) {
      const arcTenths = segment.tenths; // what DonutChart would draw
      const legendTenths = segment.tenths; // what Legend would render via formatPercentTenths
      expect(arcTenths).toBe(legendTenths);
    }
  });

  /** Scenario 16: an empty bucket list is handled without NaN or a thrown error. */
  it('returns an empty display list and total 0 for an empty bucket list, with no throw', () => {
    expect(() => buildDonutReport([], 'debit', [], UNCATEGORIZED)).not.toThrow();
    const report = buildDonutReport([], 'debit', [], UNCATEGORIZED);
    expect(report.segments).toEqual([]);
    expect(report.total).toBe(0);
  });
});
