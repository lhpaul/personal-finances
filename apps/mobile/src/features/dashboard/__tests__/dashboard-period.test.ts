import {
  DASHBOARD_TREND_PERIOD_COUNT,
  resolveDashboardPeriods,
  toRepositoryPeriod,
} from '../dashboard-period';

/** Scenarios 1-2 of the dashboard implementation plan's Testing Strategy (Decision 3, brief
 * AC1). */
describe('resolveDashboardPeriods — month', () => {
  it('returns the calendar month of the local day, the previous month, and a six-month trend window', () => {
    const result = resolveDashboardPeriods('2026-02-15', 'month');

    expect(result.period).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(result.previousPeriod).toEqual({ start: '2026-01-01', end: '2026-01-31' });
    expect(result.trendWindow).toEqual({ start: '2025-09-01', end: '2026-02-28' });
    expect(result.periodStarts).toEqual([
      '2025-09-01',
      '2025-10-01',
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
    expect(result.periodStarts).toHaveLength(DASHBOARD_TREND_PERIOD_COUNT);
  });

  it('is correct across a leap-year February (2024-02-29 is the month end)', () => {
    const result = resolveDashboardPeriods('2024-02-10', 'month');

    expect(result.period).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(result.trendWindow).toEqual({ start: '2023-09-01', end: '2024-02-29' });
  });

  it('is correct across a non-leap-year February (2026-02-28 is the month end)', () => {
    const result = resolveDashboardPeriods('2026-02-10', 'month');

    expect(result.period).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('walks back across a year boundary for a window starting in January', () => {
    const result = resolveDashboardPeriods('2026-01-15', 'month');

    // 5 months before January 2026 is August 2025.
    expect(result.periodStarts[0]).toBe('2025-08-01');
    expect(result.trendWindow.start).toBe('2025-08-01');
  });
});

describe('resolveDashboardPeriods — week', () => {
  it('returns Monday-start weeks and a six-week trend window', () => {
    // 2026-02-11 is a Wednesday; its Monday-start week is 2026-02-09..2026-02-15.
    const result = resolveDashboardPeriods('2026-02-11', 'week');

    expect(result.period).toEqual({ start: '2026-02-09', end: '2026-02-15' });
    expect(result.previousPeriod).toEqual({ start: '2026-02-02', end: '2026-02-08' });
    expect(result.periodStarts).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
      '2026-02-02',
      '2026-02-09',
    ]);
    expect(result.trendWindow).toEqual({ start: '2026-01-05', end: '2026-02-15' });
  });

  it('is correct across a month boundary', () => {
    // 2026-03-02 (Monday) — five weeks earlier lands in January.
    const result = resolveDashboardPeriods('2026-03-02', 'week');
    expect(result.periodStarts[0]).toBe('2026-01-26');
  });

  it('is correct across a year boundary', () => {
    // 2026-01-05 (Monday) — five weeks earlier lands in 2025.
    const result = resolveDashboardPeriods('2026-01-05', 'week');
    expect(result.periodStarts[0]).toBe('2025-12-01');
    expect(result.trendWindow.start).toBe('2025-12-01');
  });
});

describe('toRepositoryPeriod', () => {
  it('maps { start, end } to { startDateLocal, endDateLocal }', () => {
    expect(toRepositoryPeriod({ start: '2026-02-01', end: '2026-02-28' })).toEqual({
      startDateLocal: '2026-02-01',
      endDateLocal: '2026-02-28',
    });
  });
});
