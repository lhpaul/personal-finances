import type { Period } from '@finanzas/shared-utils';

import { listBankConnections } from '../../db/repositories/connections';
import { listCategories } from '../../db/repositories/categories';
import {
  countUncategorized,
  listRecentMovements,
  sumIncludedByDirectionAndCategory,
  sumIncludedByDirectionAndDay,
} from '../../db/repositories/transactions';
import type {
  AppDatabase,
  BankConnection,
  Category,
  DirectionCategoryTotal,
  DirectionDayTotal,
  RecentMovement,
} from '../../db/types';
import type { SupportedLocale } from '../../db/labels';
import { HOME_RECENT_MOVEMENT_LIMIT } from './constants';

export interface HomeDataParams {
  /** The month in progress, in `date_local` terms (Decision 8 — `getMonthPeriod(deriveDateLocal(now))`). */
  period: Period;
  /** The previous month, for the trend chart's dashed comparison line. */
  previousPeriod: Period;
  locale: SupportedLocale;
}

/**
 * The pure composition `readHomeData(db, params)` awaits (implementation plan Decision 7).
 * `categoryTotals` covers only `period` — the trend chart is the only section that also needs
 * `previousPeriod`, so its own daily totals are fetched separately as `previousDailyTotals`.
 */
export interface HomeData {
  uncategorizedCount: number;
  categoryTotals: DirectionCategoryTotal[];
  dailyTotals: DirectionDayTotal[];
  previousDailyTotals: DirectionDayTotal[];
  recentMovements: RecentMovement[];
  connections: BankConnection[];
  categories: Category[];
}

/**
 * The pure composition of six repository functions, called eight times in total (implementation
 * plan Decision 7, Code Samples). No React, so it is testable against a real in-memory store in
 * the `db` tier (Scenario 25) — every call here is synchronous (`BaseSQLiteDatabase<'sync', …>`),
 * so all eight reads happen in one uninterrupted pass: the stat tiles, the chart and the category
 * rows are guaranteed to describe the same store state, with no interleaved write.
 */
export function readHomeData(db: AppDatabase, params: HomeDataParams): HomeData {
  const { period, previousPeriod, locale } = params;
  const dateLocalPeriod = { startDateLocal: period.start, endDateLocal: period.end };
  const previousDateLocalPeriod = {
    startDateLocal: previousPeriod.start,
    endDateLocal: previousPeriod.end,
  };

  return {
    uncategorizedCount: countUncategorized(db),
    categoryTotals: sumIncludedByDirectionAndCategory(db, dateLocalPeriod),
    dailyTotals: sumIncludedByDirectionAndDay(db, dateLocalPeriod),
    previousDailyTotals: sumIncludedByDirectionAndDay(db, previousDateLocalPeriod),
    recentMovements: listRecentMovements(db, { limit: HOME_RECENT_MOVEMENT_LIMIT, locale }),
    connections: listBankConnections(db),
    categories: [
      ...listCategories(db, { income: 0, locale }),
      ...listCategories(db, { income: 1, locale }),
    ],
  };
}
