import type { DirectionDayTotal } from '../../../db/types';
import { buildCumulativeSeries, maxCumulativeTotal, toPolylinePoints } from '../trend-series';

/** Scenarios 13-14 of the home-screen implementation plan's Testing Strategy (Assumption A7). */
describe('buildCumulativeSeries', () => {
  const period = { start: '2026-02-01', end: '2026-02-05' };

  it('emits one point per day of the period, carrying the previous day forward on a day with no movement', () => {
    const dailyTotals: DirectionDayTotal[] = [
      { dateLocal: '2026-02-01', type: 'debit', total: 1000 },
      { dateLocal: '2026-02-03', type: 'debit', total: 500 },
    ];

    const series = buildCumulativeSeries(dailyTotals, period, 'debit');

    expect(series).toEqual([
      { dateLocal: '2026-02-01', cumulativeTotal: 1000 },
      { dateLocal: '2026-02-02', cumulativeTotal: 1000 },
      { dateLocal: '2026-02-03', cumulativeTotal: 1500 },
      { dateLocal: '2026-02-04', cumulativeTotal: 1500 },
      { dateLocal: '2026-02-05', cumulativeTotal: 1500 },
    ]);
  });

  it('is monotonically non-decreasing', () => {
    const dailyTotals: DirectionDayTotal[] = [
      { dateLocal: '2026-02-02', type: 'credit', total: 200 },
      { dateLocal: '2026-02-04', type: 'credit', total: 300 },
    ];
    const series = buildCumulativeSeries(dailyTotals, period, 'credit');
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i]?.cumulativeTotal).toBeGreaterThanOrEqual(series[i - 1]?.cumulativeTotal ?? 0);
    }
  });

  it('ignores rows of the other direction', () => {
    const dailyTotals: DirectionDayTotal[] = [{ dateLocal: '2026-02-01', type: 'credit', total: 999 }];
    const series = buildCumulativeSeries(dailyTotals, period, 'debit');
    expect(series.every((point) => point.cumulativeTotal === 0)).toBe(true);
  });

  it('returns an empty series for an empty period (end before start)', () => {
    const series = buildCumulativeSeries([], { start: '2026-02-05', end: '2026-02-01' }, 'debit');
    expect(series).toEqual([]);
  });
});

describe('toPolylinePoints', () => {
  const viewBox = { width: 300, height: 120 };

  it('maps an empty series to an empty string', () => {
    expect(toPolylinePoints([], viewBox, 0)).toBe('');
  });

  it('maps a single point without dividing by zero', () => {
    const points = toPolylinePoints([{ dateLocal: '2026-02-01', cumulativeTotal: 100 }], viewBox, 100);
    expect(points).toBe('0,0');
  });

  it('renders a flat all-zero series at the track bottom, with no NaN', () => {
    const series = [
      { dateLocal: '2026-02-01', cumulativeTotal: 0 },
      { dateLocal: '2026-02-02', cumulativeTotal: 0 },
    ];
    const points = toPolylinePoints(series, viewBox, 0);
    expect(points).not.toMatch(/NaN/);
    expect(points).toBe('0,120 300,120');
  });

  it('normalizes to a shared max across two series with different lengths (Assumption A7)', () => {
    const current = [
      { dateLocal: '2026-02-01', cumulativeTotal: 50 },
      { dateLocal: '2026-02-02', cumulativeTotal: 100 },
    ];
    const previous = [
      { dateLocal: '2026-01-01', cumulativeTotal: 200 },
      { dateLocal: '2026-01-02', cumulativeTotal: 200 },
      { dateLocal: '2026-01-03', cumulativeTotal: 200 },
    ];
    const sharedMax = Math.max(maxCumulativeTotal(current), maxCumulativeTotal(previous));
    expect(sharedMax).toBe(200);

    const currentPoints = toPolylinePoints(current, viewBox, sharedMax);
    // 100 / 200 of the shared max -> halfway up the track, not full height (would be if
    // normalized only to its own max, the pre-fix bug this test guards against).
    expect(currentPoints).toBe('0,90 300,60');
  });
});
