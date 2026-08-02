import { addDays, differenceInDays, type Period } from '@finanzas/shared-utils';

import type { DirectionDayTotal } from '../../db/types';

export interface TrendPoint {
  dateLocal: string;
  /** The included total for `direction`, accumulated from `period.start` through this day. */
  cumulativeTotal: number;
}

export interface PolylineViewBox {
  width: number;
  height: number;
}

/** Every `date_local` from `period.start` to `period.end`, inclusive. Empty when `period.end` is
 * before `period.start` (Scenario 13's "empty period" case) — `Array.from` would otherwise throw
 * on a negative length. */
function enumerateDatesInPeriod(period: Period): string[] {
  const dayCount = differenceInDays(period.start, period.end) + 1;
  if (dayCount <= 0) return [];
  return Array.from({ length: dayCount }, (_, index) => addDays(period.start, index));
}

/**
 * `home`'s trend chart source series (implementation plan Assumption A7): the cumulative included
 * total per local day, for one direction over one period. A day with no included movement of that
 * direction carries the previous day's value forward — the series is non-decreasing by
 * construction, never a same-day reset to zero.
 */
export function buildCumulativeSeries(
  dailyTotals: readonly DirectionDayTotal[],
  period: Period,
  direction: 'debit' | 'credit',
): TrendPoint[] {
  const totalByDay = new Map<string, number>();
  for (const row of dailyTotals) {
    if (row.type === direction) totalByDay.set(row.dateLocal, row.total);
  }

  let cumulative = 0;
  return enumerateDatesInPeriod(period).map((dateLocal) => {
    cumulative += totalByDay.get(dateLocal) ?? 0;
    return { dateLocal, cumulativeTotal: cumulative };
  });
}

/** The largest `cumulativeTotal` across one or more series — callers combine the current and
 * previous series' maxima before calling {@link toPolylinePoints} so both lines share one y-axis
 * scale (Assumption A7, "normalized … to the shared maximum on the y axis"). */
export function maxCumulativeTotal(series: readonly TrendPoint[]): number {
  return series.reduce((max, point) => Math.max(max, point.cumulativeTotal), 0);
}

/**
 * Maps a cumulative series to an SVG `points` string (implementation plan Assumption A7,
 * Layer-by-Layer — `LineChart` "takes already-computed polyline point strings"). The x axis is
 * normalized to **this series' own** day count (`series.length`); the y axis is normalized to
 * `sharedMaxValue`, which the caller computes across both the current and previous series so the
 * two lines share one scale. Never produces `NaN`: an empty series returns `''`, a single point
 * returns one coordinate pair, and an all-zero series (or a zero `sharedMaxValue`) renders every
 * point at the track's bottom edge instead of dividing by zero.
 */
export function toPolylinePoints(
  series: readonly TrendPoint[],
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
          ? viewBox.height - (point.cumulativeTotal / sharedMaxValue) * viewBox.height
          : viewBox.height;
      return `${Math.round(x)},${Math.round(y)}`;
    })
    .join(' ');
}
