import fs from 'node:fs';
import path from 'node:path';

import type { DirectionDayTotal } from '../../../db/types';
import { buildDonutReport } from '../category-report';
import { buildSpendingOverview } from '../spending-overview';
import { buildTrendReport, toPeriodPolylinePoints } from '../trend-report';

/**
 * Scenario 23 of the dashboard implementation plan's Testing Strategy (brief AC — "charts must
 * not recompute on unrelated re-renders"). `@testing-library/react-native` is not installed
 * (item #2 precedent), so — mirroring `home`'s `memoization.test.ts` — this is a source scan for
 * the `React.memo` wiring plus a referential-stability check on the pure shaping functions each
 * card feeds into its own `useMemo` calls.
 */
describe('dashboard chart memoization (brief AC4)', () => {
  const componentsDir = path.resolve(__dirname, '..', 'components');

  it.each([
    'TrendCard.tsx',
    'SpendingOverviewCard.tsx',
    'CategoryReportCard.tsx',
    'DonutSection.tsx',
  ])('%s is wrapped in React.memo', (fileName) => {
    const source = fs.readFileSync(path.join(componentsDir, fileName), 'utf8');
    expect(source).toMatch(new RegExp(`export const \\w+ = memo\\(`));
  });

  it('TrendCard derives its polylines through useMemo', () => {
    const source = fs.readFileSync(path.join(componentsDir, 'TrendCard.tsx'), 'utf8');
    expect(source).toMatch(/const incomePoints = useMemo\(/);
    expect(source).toMatch(/const expensePoints = useMemo\(/);
    expect(source).toMatch(/const averagePoints = useMemo\(/);
  });

  it('DonutSection derives its segments and legend items through useMemo', () => {
    const source = fs.readFileSync(path.join(componentsDir, 'DonutSection.tsx'), 'utf8');
    expect(source).toMatch(/const segments = useMemo\(/);
    expect(source).toMatch(/const legendItems = useMemo\(/);
  });

  it('buildTrendReport + toPeriodPolylinePoints are referentially transparent: identical inputs (by value, not by reference) produce deep-equal output — safe to skip via useMemo', () => {
    const periodStarts = ['2026-01-01', '2026-02-01'];
    const dailyTotals: DirectionDayTotal[] = [
      { dateLocal: '2026-01-15', type: 'debit', total: 100 },
      { dateLocal: '2026-02-05', type: 'credit', total: 200 },
    ];

    const first = buildTrendReport(dailyTotals, periodStarts);
    const second = buildTrendReport([...dailyTotals], [...periodStarts]);
    expect(first).toEqual(second);

    const viewBox = { width: 300, height: 120 };
    const firstPoints = toPeriodPolylinePoints(first.incomeSeries, { ...viewBox }, 200);
    const secondPoints = toPeriodPolylinePoints(second.incomeSeries, { ...viewBox }, 200);
    expect(firstPoints).toBe(secondPoints);
  });

  it('buildSpendingOverview and buildDonutReport are referentially transparent', () => {
    const series = [
      { periodIndex: 0, total: 100 },
      { periodIndex: 1, total: 200 },
    ];
    expect(buildSpendingOverview(series)).toEqual(buildSpendingOverview([...series]));

    const totals = [{ type: 'debit' as const, transactionCategoryId: 'a', total: 100, movementCount: 1 }];
    const categories = [{ id: 'a', slug: 'a', income: false, name: 'A', emoji: '🍔', sortOrder: 0 }];
    const uncategorized = { label: 'Sin categorizar', emoji: '❓' };
    expect(buildDonutReport(totals, 'debit', categories, uncategorized)).toEqual(
      buildDonutReport([...totals], 'debit', [...categories], { ...uncategorized }),
    );
  });
});
