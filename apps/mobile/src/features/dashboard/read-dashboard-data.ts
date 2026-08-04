import type { Period } from '@finanzas/shared-utils';

import { listCategories } from '../../db/repositories/categories';
import {
  sumIncludedByDirectionAndCategory,
  sumIncludedByDirectionAndDay,
} from '../../db/repositories/transactions';
import type { AppDatabase, Category, DirectionCategoryTotal, DirectionDayTotal } from '../../db/types';
import type { SupportedLocale } from '../../db/labels';
import { toRepositoryPeriod } from './dashboard-period';

export interface DashboardDataParams {
  /** The period in progress — `resolveDashboardPeriods(...).period`. */
  period: Period;
  previousPeriod: Period;
  trendWindow: Period;
  locale: SupportedLocale;
}

/**
 * The pure composition `readDashboardData(db, params)` performs (implementation plan Decision 1,
 * Decision 12). Every field here traces to one of the four repository calls in Decision 1's
 * table — this item adds no fifth.
 */
export interface DashboardData {
  /** One row per `(date_local, type)` pair inside `trendWindow` — the trend card's, the spending
   * card's and the two bars' shared source (Decision 2). */
  windowDailyTotals: DirectionDayTotal[];
  /** The category report's *Este mes* / *Esta semana* buckets. */
  currentCategoryTotals: DirectionCategoryTotal[];
  /** The category report's *Mes anterior* / *Semana anterior* buckets. */
  previousCategoryTotals: DirectionCategoryTotal[];
  categories: Category[];
}

/**
 * The pure composition of four repository calls, all pre-existing (implementation plan Decision
 * 1's table; brief AC1). No React, so it is testable against a real in-memory store in the `db`
 * tier (Scenario 5) — every call here is synchronous
 * (`BaseSQLiteDatabase<'sync', …>`), so all four reads happen in one uninterrupted pass: the
 * trend, the bars and both donuts are guaranteed to describe the same store state, with no
 * interleaved write (Decision 12).
 *
 * `readDashboardData` performs **no row-level read of any kind**: it never calls `listMonth`,
 * `listRecentMovements` or `listByMerchant` (Decision 2). No `sql` tag, no fragment import, no
 * repository function this item did not already find on `develop` — the three tree-wide scans
 * (`inclusion-rule-single-definition`, `db-access-boundary`, `peso-total-guard`) are satisfied
 * vacuously by this file.
 */
export function readDashboardData(db: AppDatabase, params: DashboardDataParams): DashboardData {
  const { period, previousPeriod, trendWindow, locale } = params;

  return {
    windowDailyTotals: sumIncludedByDirectionAndDay(db, toRepositoryPeriod(trendWindow)),
    currentCategoryTotals: sumIncludedByDirectionAndCategory(db, toRepositoryPeriod(period)),
    previousCategoryTotals: sumIncludedByDirectionAndCategory(db, toRepositoryPeriod(previousPeriod)),
    categories: [
      ...listCategories(db, { income: 0, locale }),
      ...listCategories(db, { income: 1, locale }),
    ],
  };
}
