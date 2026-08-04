import type { TrendSeriesPoint } from '../trend-report';
import { buildSpendingOverview, describeSpendingDelta } from '../spending-overview';

/** Scenario 14 of the dashboard implementation plan's Testing Strategy (brief AC4, Decision 16,
 * Assumption A7). */
describe('buildSpendingOverview', () => {
  it('returns heightRatio 0 for every column when the window maximum is 0', () => {
    const series: TrendSeriesPoint[] = Array.from({ length: 6 }, (_, periodIndex) => ({
      periodIndex,
      total: 0,
    }));
    const overview = buildSpendingOverview(series);
    expect(overview.columns.every((column) => column.heightRatio === 0)).toBe(true);
    expect(overview.delta).toBeNull();
  });

  it('scales the last two columns against the six-period window maximum, clamped to [0, 1]', () => {
    const series: TrendSeriesPoint[] = [
      { periodIndex: 0, total: 100 },
      { periodIndex: 1, total: 200 },
      { periodIndex: 2, total: 1000 }, // the window's maximum
      { periodIndex: 3, total: 300 },
      { periodIndex: 4, total: 780 }, // previous
      { periodIndex: 5, total: 680 }, // current
    ];
    const overview = buildSpendingOverview(series);

    expect(overview.columns).toEqual([
      { key: 'previous', total: 780, heightRatio: 0.78 },
      { key: 'current', total: 680, heightRatio: 0.68 },
    ]);
    overview.columns.forEach((column) => {
      expect(column.heightRatio).toBeGreaterThanOrEqual(0);
      expect(column.heightRatio).toBeLessThanOrEqual(1);
    });
  });

  it('reads the current and previous totals from the last two periods of the window', () => {
    const series: TrendSeriesPoint[] = [
      { periodIndex: 0, total: 10 },
      { periodIndex: 1, total: 1352470 },
    ];
    const overview = buildSpendingOverview(series);
    expect(overview.currentTotal).toBe(1352470);
    expect(overview.previousTotal).toBe(10);
  });
});

/** Scenario 15 of the dashboard implementation plan's Testing Strategy (Decision 16, Assumption
 * A9). */
describe('describeSpendingDelta', () => {
  it('returns null when previous is 0', () => {
    expect(describeSpendingDelta({ current: 500, previous: 0 })).toBeNull();
  });

  it("returns 'down' with a whole percent when spending fell (the mockup's drawn case)", () => {
    // Reproduces the mockup's "▼ 12% vs período anterior" from 1352470 vs ~1536898.
    expect(describeSpendingDelta({ current: 1000, previous: 1136 })).toEqual({
      direction: 'down',
      percentWhole: 12,
    });
  });

  it("returns 'up' when spending rose", () => {
    expect(describeSpendingDelta({ current: 1200, previous: 1000 })).toEqual({
      direction: 'up',
      percentWhole: 20,
    });
  });

  it("returns 'flat' with 0% when current equals previous", () => {
    expect(describeSpendingDelta({ current: 500, previous: 500 })).toEqual({
      direction: 'flat',
      percentWhole: 0,
    });
  });

  it('rounds to the nearest whole percent', () => {
    // |1050 - 1000| / 1000 * 100 = 5 exactly.
    expect(describeSpendingDelta({ current: 1050, previous: 1000 })?.percentWhole).toBe(5);
  });
});
