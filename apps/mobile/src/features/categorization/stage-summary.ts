import type { Period } from '@finanzas/shared-utils';

import { countCategorized, sumIncludedExpensesInPeriod } from '../../db/repositories/transactions';
import type { AppDatabase } from '../../db/types';
import { dailyAverage, formatMonthOverMonthChange, type MonthOverMonthChange } from './completion';

/**
 * Categorization flow (#13) implementation plan Layer-by-Layer, Decision 11: the completion
 * screen's two summary tiles, composed from `countCategorized` and `sumIncludedExpensesInPeriod`
 * — both of which read through the one shared inclusion rule (`src/db/fragments.ts`), so these
 * tiles can never disagree with home or the dashboard.
 */
export interface StageSummary {
  totalCategorized: number;
  dailyAverageMinorUnits: number;
  change: MonthOverMonthChange;
}

export function readStageSummary(
  db: AppDatabase,
  params: { period: Period; previousPeriod: Period; elapsedDays: number },
): StageSummary {
  const currentTotal = sumIncludedExpensesInPeriod(db, {
    startDateLocal: params.period.start,
    endDateLocal: params.period.end,
  });
  const previousTotal = sumIncludedExpensesInPeriod(db, {
    startDateLocal: params.previousPeriod.start,
    endDateLocal: params.previousPeriod.end,
  });

  return {
    totalCategorized: countCategorized(db),
    dailyAverageMinorUnits: dailyAverage(currentTotal, params.elapsedDays),
    change: formatMonthOverMonthChange(currentTotal, previousTotal),
  };
}
