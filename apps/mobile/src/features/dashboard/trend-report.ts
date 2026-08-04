import type { DirectionDayTotal } from '../../db/types';

/** The trailing dashed average's window — "Promedio 3 períodos" (implementation plan Decision
 * 15, Assumption A6). */
export const DASHBOARD_TREND_AVERAGE_WINDOW = 3;

export interface TrendSeriesPoint {
  /** 0-based, ascending — matches `DashboardPeriods.periodStarts`' order. */
  periodIndex: number;
  total: number;
}

export interface TrendReport {
  /** One point per period in the trend window, oldest first. */
  incomeSeries: TrendSeriesPoint[];
  expenseSeries: TrendSeriesPoint[];
  /** The trailing `DASHBOARD_TREND_AVERAGE_WINDOW`-period average of `expenseSeries` (Decision
   * 15). */
  averageSeries: TrendSeriesPoint[];
  /** The flat tiles' figures — the **current** period's totals, not the six-period window's
   * (Assumption A14). */
  currentIncomeTotal: number;
  currentExpenseTotal: number;
}

/**
 * Assigns each `dailyTotals` row to exactly one period bucket (implementation plan Decision 2,
 * brief AC1). `periodStarts` must be ascending and cover contiguous, non-overlapping periods (as
 * `resolveDashboardPeriods` produces) — a day belongs to the bucket with the greatest start that
 * does not exceed it, which is well-defined because `date_local` strings sort lexicographically
 * in calendar order. Drops nothing that falls inside the window; a row whose day is before every
 * `periodStarts` entry (which should not happen — the SQL query is already bounded to the window)
 * is defensively ignored rather than thrown on, order-independent with respect to the input rows.
 */
export function foldDailyTotalsIntoPeriods(
  dailyTotals: readonly DirectionDayTotal[],
  periodStarts: readonly string[],
): { debit: TrendSeriesPoint[]; credit: TrendSeriesPoint[] } {
  const debitTotals = periodStarts.map(() => 0);
  const creditTotals = periodStarts.map(() => 0);

  for (const row of dailyTotals) {
    const periodIndex = findPeriodIndex(row.dateLocal, periodStarts);
    if (periodIndex === -1) continue;
    if (row.type === 'debit') {
      debitTotals[periodIndex] = (debitTotals[periodIndex] ?? 0) + row.total;
    } else {
      creditTotals[periodIndex] = (creditTotals[periodIndex] ?? 0) + row.total;
    }
  }

  return {
    debit: debitTotals.map((total, periodIndex) => ({ periodIndex, total })),
    credit: creditTotals.map((total, periodIndex) => ({ periodIndex, total })),
  };
}

/** The greatest index in the ascending `periodStarts` whose value is `<= dateLocal`, or `-1` if
 * every start is after `dateLocal`. */
function findPeriodIndex(dateLocal: string, periodStarts: readonly string[]): number {
  let index = -1;
  for (let i = 0; i < periodStarts.length; i += 1) {
    if ((periodStarts[i] as string) <= dateLocal) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

/**
 * The trend card's whole data shape (implementation plan Decisions 2, 15; Assumption A14). Folds
 * one day-grained read into the six period buckets, then derives the trailing expense average —
 * pure integer arithmetic over totals SQL has already filtered, so this function states no
 * inclusion or currency rule of its own (Decision 2's "bounded fold" precedent, `home`'s
 * `buildCumulativeSeries`).
 */
export function buildTrendReport(
  dailyTotals: readonly DirectionDayTotal[],
  periodStarts: readonly string[],
): TrendReport {
  const { debit: expenseSeries, credit: incomeSeries } = foldDailyTotalsIntoPeriods(
    dailyTotals,
    periodStarts,
  );
  const averageSeries = buildTrailingAverage(expenseSeries, DASHBOARD_TREND_AVERAGE_WINDOW);
  const lastIndex = periodStarts.length - 1;

  return {
    incomeSeries,
    expenseSeries,
    averageSeries,
    currentIncomeTotal: incomeSeries[lastIndex]?.total ?? 0,
    currentExpenseTotal: expenseSeries[lastIndex]?.total ?? 0,
  };
}

/**
 * For period *i*, the mean of periods `max(0, i-window+1)..i` — the average over the periods
 * **available** inside the series, so the first `window - 1` points average fewer periods rather
 * than being omitted or reaching outside the series (implementation plan Decision 15, Assumption
 * A6). Integer arithmetic with floor division on minor units — no float ever enters the money
 * path (non-negotiable 2).
 */
export function buildTrailingAverage(
  series: readonly TrendSeriesPoint[],
  window: number,
): TrendSeriesPoint[] {
  return series.map((point, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = series.slice(start, index + 1);
    const sum = slice.reduce((total, entry) => total + entry.total, 0);
    return { periodIndex: point.periodIndex, total: Math.floor(sum / slice.length) };
  });
}

export interface PolylineViewBox {
  width: number;
  height: number;
}

/**
 * Maps a period-indexed series to an SVG `points` string (implementation plan Decision 11b,
 * Scenario 13) — the trend card's equivalent of `home`'s `toPolylinePoints`, over periods instead
 * of days. The x axis is normalized to `series.length`; the y axis to `sharedMaxValue`, which the
 * caller computes across every series sharing the chart so they all share one scale. Never
 * produces `NaN`: an empty series returns `''`, and an all-zero series (or a zero
 * `sharedMaxValue`) renders every point at the track's bottom edge instead of dividing by zero.
 */
export function toPeriodPolylinePoints(
  series: readonly TrendSeriesPoint[],
  viewBox: PolylineViewBox,
  sharedMaxValue: number,
): string {
  if (series.length === 0) return '';

  const stepCount = series.length > 1 ? series.length - 1 : 1;

  return series
    .map((point, index) => {
      const x = (index / stepCount) * viewBox.width;
      const y =
        sharedMaxValue > 0
          ? viewBox.height - (point.total / sharedMaxValue) * viewBox.height
          : viewBox.height;
      return `${Math.round(x)},${Math.round(y)}`;
    })
    .join(' ');
}
