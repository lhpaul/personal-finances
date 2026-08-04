import type { DirectionDayTotal } from '../../../db/types';
import {
  buildTrailingAverage,
  buildTrendReport,
  foldDailyTotalsIntoPeriods,
  toPeriodPolylinePoints,
  type TrendSeriesPoint,
} from '../trend-report';

const PERIOD_STARTS = [
  '2026-01-01',
  '2026-02-01',
  '2026-03-01',
  '2026-04-01',
  '2026-05-01',
  '2026-06-01',
];

/** Scenario 8 of the dashboard implementation plan's Testing Strategy (Decision 2). */
describe('foldDailyTotalsIntoPeriods', () => {
  it('assigns each day row to exactly one period and drops nothing', () => {
    const dailyTotals: DirectionDayTotal[] = [
      { dateLocal: '2026-01-15', type: 'debit', total: 100 },
      { dateLocal: '2026-01-20', type: 'debit', total: 50 },
      { dateLocal: '2026-03-05', type: 'credit', total: 200 },
      { dateLocal: '2026-06-30', type: 'debit', total: 10 },
    ];

    const result = foldDailyTotalsIntoPeriods(dailyTotals, PERIOD_STARTS);

    expect(result.debit).toEqual([
      { periodIndex: 0, total: 150 },
      { periodIndex: 1, total: 0 },
      { periodIndex: 2, total: 0 },
      { periodIndex: 3, total: 0 },
      { periodIndex: 4, total: 0 },
      { periodIndex: 5, total: 10 },
    ]);
    expect(result.credit).toEqual([
      { periodIndex: 0, total: 0 },
      { periodIndex: 1, total: 0 },
      { periodIndex: 2, total: 200 },
      { periodIndex: 3, total: 0 },
      { periodIndex: 4, total: 0 },
      { periodIndex: 5, total: 0 },
    ]);
  });

  it('produces one entry per period per direction, including periods with no rows, as 0', () => {
    const result = foldDailyTotalsIntoPeriods([], PERIOD_STARTS);
    expect(result.debit).toHaveLength(PERIOD_STARTS.length);
    expect(result.credit).toHaveLength(PERIOD_STARTS.length);
    expect(result.debit.every((point) => point.total === 0)).toBe(true);
    expect(result.credit.every((point) => point.total === 0)).toBe(true);
  });

  it('is order-independent with respect to the input rows', () => {
    const dailyTotals: DirectionDayTotal[] = [
      { dateLocal: '2026-02-10', type: 'debit', total: 10 },
      { dateLocal: '2026-02-11', type: 'debit', total: 20 },
      { dateLocal: '2026-05-04', type: 'credit', total: 5 },
    ];
    const forward = foldDailyTotalsIntoPeriods(dailyTotals, PERIOD_STARTS);
    const reversed = foldDailyTotalsIntoPeriods([...dailyTotals].reverse(), PERIOD_STARTS);
    expect(reversed).toEqual(forward);
  });
});

/** Scenario 9 of the dashboard implementation plan's Testing Strategy (Decision 15, Assumption
 * A6). */
describe('buildTrailingAverage', () => {
  const series: TrendSeriesPoint[] = [
    { periodIndex: 0, total: 100 },
    { periodIndex: 1, total: 200 },
    { periodIndex: 2, total: 300 },
    { periodIndex: 3, total: 400 },
  ];

  it('averages the previous three periods once three are available', () => {
    const result = buildTrailingAverage(series, 3);
    // point 0: mean(100) = 100
    // point 1: mean(100, 200) = 150
    // point 2: mean(100, 200, 300) = 200
    // point 3: mean(200, 300, 400) = 300
    expect(result.map((p) => p.total)).toEqual([100, 150, 200, 300]);
  });

  it('averages only the periods available for the first window-1 points', () => {
    const result = buildTrailingAverage(series, 3);
    expect(result[0]?.total).toBe(100); // mean of 1 period
    expect(result[1]?.total).toBe(150); // mean of 2 periods
  });

  it('uses integer floor division — no float leaks into a money value', () => {
    const oddSeries: TrendSeriesPoint[] = [
      { periodIndex: 0, total: 1 },
      { periodIndex: 1, total: 2 },
    ];
    const result = buildTrailingAverage(oddSeries, 3);
    // mean(1, 2) = 1.5 -> floors to 1
    expect(result[1]?.total).toBe(1);
    expect(Number.isInteger(result[1]?.total)).toBe(true);
  });

  it('preserves periodIndex and length', () => {
    const result = buildTrailingAverage(series, 3);
    expect(result.map((p) => p.periodIndex)).toEqual([0, 1, 2, 3]);
    expect(result).toHaveLength(series.length);
  });
});

/** Scenario 13 of the dashboard implementation plan's Testing Strategy (brief AC4, Decision
 * 11b). */
describe('toPeriodPolylinePoints', () => {
  const viewBox = { width: 300, height: 120 };

  it('renders no NaN/Infinity for an all-zero six-period series', () => {
    const series: TrendSeriesPoint[] = PERIOD_STARTS.map((_, periodIndex) => ({ periodIndex, total: 0 }));
    const points = toPeriodPolylinePoints(series, viewBox, 0);
    expect(points).not.toMatch(/NaN|Infinity/);
    expect(points.split(' ')).toHaveLength(6);
  });

  it('scales a single-period non-zero series without dividing by zero', () => {
    const series: TrendSeriesPoint[] = [{ periodIndex: 0, total: 500 }];
    const points = toPeriodPolylinePoints(series, viewBox, 500);
    expect(points).not.toMatch(/NaN|Infinity/);
    expect(points).toBe('0,0');
  });

  it('returns an empty string for an empty series', () => {
    expect(toPeriodPolylinePoints([], viewBox, 0)).toBe('');
  });
});

describe('buildTrendReport', () => {
  it('composes the fold and the trailing average, and reports the current period totals (Assumption A14)', () => {
    const dailyTotals: DirectionDayTotal[] = [
      { dateLocal: '2026-06-05', type: 'credit', total: 3700000 },
      { dateLocal: '2026-06-10', type: 'debit', total: 1352470 },
    ];
    const report = buildTrendReport(dailyTotals, PERIOD_STARTS);

    expect(report.currentIncomeTotal).toBe(3700000);
    expect(report.currentExpenseTotal).toBe(1352470);
    expect(report.incomeSeries).toHaveLength(PERIOD_STARTS.length);
    expect(report.expenseSeries).toHaveLength(PERIOD_STARTS.length);
    expect(report.averageSeries).toHaveLength(PERIOD_STARTS.length);
  });

  it('reports zero current totals for an empty window', () => {
    const report = buildTrendReport([], PERIOD_STARTS);
    expect(report.currentIncomeTotal).toBe(0);
    expect(report.currentExpenseTotal).toBe(0);
  });
});
