import type { TrendSeriesPoint } from './trend-report';

export type SpendingColumnKey = 'previous' | 'current';

export interface SpendingOverviewColumn {
  key: SpendingColumnKey;
  total: number;
  /** Relative to the largest expense period total in the six-period trend window — **not**
   * relative to each other (implementation plan Decision 16, Assumption A7). Clamped to
   * `[0, 1]`; `0` when the window's maximum is `0`. */
  heightRatio: number;
}

export type SpendingDeltaDirection = 'down' | 'up' | 'flat';

export interface SpendingDelta {
  direction: SpendingDeltaDirection;
  /** A whole percent — the mockup draws `12%`, not `12,0%` (Decision 16). This is the one
   * percentage on this screen that is not a share of a total, so it does not go through
   * `apportionTenths` / `formatPercentTenths`. */
  percentWhole: number;
}

export interface SpendingOverview {
  /** `[previous, current]`. */
  columns: SpendingOverviewColumn[];
  currentTotal: number;
  previousTotal: number;
  /** `null` means "render no badge" — a change from a zero previous period has no percentage
   * (Decision 16). */
  delta: SpendingDelta | null;
}

function clampRatio(ratio: number): number {
  return Math.min(1, Math.max(0, ratio));
}

/**
 * `null` when `previous === 0` — a percentage change from nothing is undefined, and the badge is
 * **not** rendered rather than showing `∞%` or a misleading `100%` (implementation plan Decision
 * 16).
 */
export function describeSpendingDelta({
  current,
  previous,
}: {
  current: number;
  previous: number;
}): SpendingDelta | null {
  if (previous === 0) return null;
  if (current === previous) return { direction: 'flat', percentWhole: 0 };
  const percentWhole = Math.round((Math.abs(current - previous) * 100) / previous);
  return { direction: current < previous ? 'down' : 'up', percentWhole };
}

/**
 * "Resumen de gastos"'s total, delta badge and two bars (implementation plan Decision 16, brief
 * AC4). `expenseSeries` is the trend card's own six-period expense series — the bars are scaled
 * against the same window the trend card charts, so a short bar here always corresponds to a low
 * point there.
 */
export function buildSpendingOverview(expenseSeries: readonly TrendSeriesPoint[]): SpendingOverview {
  const maxPeriodTotal = expenseSeries.reduce((max, point) => Math.max(max, point.total), 0);
  const lastIndex = expenseSeries.length - 1;
  const currentTotal = expenseSeries[lastIndex]?.total ?? 0;
  const previousTotal = expenseSeries[lastIndex - 1]?.total ?? 0;

  const heightRatio = (total: number): number =>
    maxPeriodTotal > 0 ? clampRatio(total / maxPeriodTotal) : 0;

  return {
    columns: [
      { key: 'previous', total: previousTotal, heightRatio: heightRatio(previousTotal) },
      { key: 'current', total: currentTotal, heightRatio: heightRatio(currentTotal) },
    ],
    currentTotal,
    previousTotal,
    delta: describeSpendingDelta({ current: currentTotal, previous: previousTotal }),
  };
}
