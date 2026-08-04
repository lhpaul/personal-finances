import {
  getMonthPeriod,
  getWeekPeriod,
  shiftMonthPeriod,
  shiftWeekPeriod,
  type DateLocal,
  type Period,
} from '@finanzas/shared-utils';

import type { DateLocalPeriod } from '../../db/repositories/transactions';

/** The manifest's two `#screen=dashboard` states (implementation plan Decision 13). */
export type DashboardPeriodType = 'month' | 'week';

/** The trend card's fixed window size — "Últimos 6 meses" / "Últimas 6 semanas" (implementation
 * plan Decision 3). */
export const DASHBOARD_TREND_PERIOD_COUNT = 6;

export interface DashboardPeriods {
  /** The period in progress — the only one this screen ever shows (Assumption A3; no
   * past-period navigation, because the mockup draws none). */
  period: Period;
  /** For the category report's *Mes anterior* / *Semana anterior* comparison and the spending
   * card's delta badge. */
  previousPeriod: Period;
  /** The whole six-period span the trend card charts — `period.start` through `period.end`. */
  trendWindow: Period;
  /** Ascending, exactly `DASHBOARD_TREND_PERIOD_COUNT` entries — each the `start` of one period
   * in the trend window, oldest first, `period.start` last. */
  periodStarts: readonly DateLocal[];
}

/**
 * Every period boundary this screen shows, derived from one `today` and one `periodType`
 * (implementation plan Decision 3). Built entirely from `@finanzas/shared-utils`'s
 * `getMonthPeriod` / `getWeekPeriod` / `shiftMonthPeriod` / `shiftWeekPeriod` — this module
 * writes no date arithmetic of its own, so week boundaries stay Monday-start and month lengths
 * stay correct across February and leap years for free.
 */
export function resolveDashboardPeriods(
  today: DateLocal,
  periodType: DashboardPeriodType,
): DashboardPeriods {
  const period = periodType === 'month' ? getMonthPeriod(today) : getWeekPeriod(today);
  const shift = (offset: number): Period =>
    periodType === 'month' ? shiftMonthPeriod(period, offset) : shiftWeekPeriod(period, offset);

  const periods: Period[] = [];
  for (let offset = DASHBOARD_TREND_PERIOD_COUNT - 1; offset >= 0; offset -= 1) {
    periods.push(shift(-offset));
  }
  // `DASHBOARD_TREND_PERIOD_COUNT` is a positive compile-time constant, so `periods` always has
  // at least one entry — the fallback below only satisfies the type checker, it is never reached.
  const earliestPeriod = periods[0] ?? period;

  return {
    period,
    previousPeriod: shift(-1),
    trendWindow: { start: earliestPeriod.start, end: period.end },
    periodStarts: periods.map((p) => p.start),
  };
}

/**
 * Maps the shared `Period` shape (`{ start, end }`) to the `DateLocalPeriod` shape item #12's
 * aggregates take (`{ startDateLocal, endDateLocal }`) — implementation plan Decision 3. Not the
 * identity: Step 0's re-verification (`transactions.ts`) confirmed the shipped aggregates take
 * the latter shape.
 */
export function toRepositoryPeriod(period: Period): DateLocalPeriod {
  return { startDateLocal: period.start, endDateLocal: period.end };
}
