import fs from 'node:fs';
import path from 'node:path';

import { buildCumulativeSeries, toPolylinePoints } from '../trend-series';

/**
 * Scenario 23 of the home-screen implementation plan's Testing Strategy (brief AC4 — "Charts are
 * memoized; no recomputation on unrelated re-renders"). `@testing-library/react-native` is not
 * installed (item #2 precedent), so this is a source scan for the memoization wiring plus a
 * referential-stability check on the pure functions `TrendCard` feeds into its `useMemo` calls —
 * proving recomputing them is safe (same inputs -> deep-equal output) is exactly what justifies
 * skipping the recomputation with `useMemo` in the first place.
 */
describe('home chart memoization (brief AC4)', () => {
  const componentsDir = path.resolve(__dirname, '..', 'components');
  const trendCardSource = fs.readFileSync(path.join(componentsDir, 'TrendCard.tsx'), 'utf8');
  const categoryBreakdownSource = fs.readFileSync(
    path.join(componentsDir, 'CategoryBreakdownCard.tsx'),
    'utf8',
  );

  it('TrendCard is wrapped in React.memo', () => {
    expect(trendCardSource).toMatch(/export const TrendCard = memo\(/);
  });

  it('CategoryBreakdownCard is wrapped in React.memo', () => {
    expect(categoryBreakdownSource).toMatch(/export const CategoryBreakdownCard = memo\(/);
  });

  it("TrendCard derives LineChart's points and comparisonPoints through useMemo", () => {
    expect(trendCardSource).toMatch(/const points = useMemo\(/);
    expect(trendCardSource).toMatch(/const comparisonPoints = useMemo\(/);
    // The values actually passed to LineChart are the memoized ones, not a fresh computation.
    expect(trendCardSource).toMatch(/<LineChart[\s\S]*?points=\{points\}[\s\S]*?comparisonPoints=\{comparisonPoints\}/);
  });

  it('buildCumulativeSeries + toPolylinePoints are referentially transparent: identical inputs (by value, not by reference) produce deep-equal output — safe to skip via useMemo', () => {
    const period = { start: '2026-02-01', end: '2026-02-05' };
    const dailyTotals = [
      { dateLocal: '2026-02-01', type: 'debit' as const, total: 1000 },
      { dateLocal: '2026-02-03', type: 'debit' as const, total: 500 },
    ];
    const viewBox = { width: 300, height: 120 };

    const firstSeries = buildCumulativeSeries(dailyTotals, period, 'debit');
    const secondSeries = buildCumulativeSeries([...dailyTotals], { ...period }, 'debit');
    expect(firstSeries).toEqual(secondSeries);

    const firstPoints = toPolylinePoints(firstSeries, { ...viewBox }, 1500);
    const secondPoints = toPolylinePoints(secondSeries, { ...viewBox }, 1500);
    expect(firstPoints).toBe(secondPoints);
  });
});
