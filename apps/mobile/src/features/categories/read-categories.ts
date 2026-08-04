import type { DateLocal } from '@finanzas/shared-utils';
import { getMonthPeriod } from '@finanzas/shared-utils';

import { listCategoriesWithUsage } from '../../db/repositories/categories';
import type { SupportedLocale } from '../../db/labels';
import type { AppDatabase, CategoryWithUsage } from '../../db/types';
import { incomeFlagFor, type CategoryDirection } from './direction';

/**
 * React-free composition `use-categories-settings.ts` awaits (implementation plan for issue #21,
 * Decision 2, Layer-by-Layer). The seam that makes `categories-settings.db.test.ts` possible
 * (Scenario 11) — no hook, so it runs against a real in-memory store in the `db` Jest project.
 */
export function readCategoriesSettings(
  db: AppDatabase,
  params: { direction: CategoryDirection; locale: SupportedLocale; todayDateLocal: DateLocal },
): CategoryWithUsage[] {
  const period = getMonthPeriod(params.todayDateLocal);
  return listCategoriesWithUsage(db, {
    income: incomeFlagFor(params.direction),
    locale: params.locale,
    startDateLocal: period.start,
    endDateLocal: period.end,
  });
}
