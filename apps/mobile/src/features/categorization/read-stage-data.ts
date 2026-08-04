import { listMostUsedCategories, listCategories } from '../../db/repositories/categories';
import { countUncategorized, listPendingBatch } from '../../db/repositories/transactions';
import type { AppDatabase, Category, StageMovement } from '../../db/types';
import type { SupportedLocale } from '../../i18n/locale';
import { MAX_CATEGORY_CHIPS } from './category-choices';
import { STAGE_BATCH_SIZE } from './stage-batch';

/**
 * Categorization flow (#13) implementation plan Decision 16, Layer-by-Layer: the pure
 * composition of four repository functions (in five calls) into one internally-consistent
 * snapshot. No React, no SQL of its own — `useStageData` is the only caller.
 */
export interface StageDataParams {
  locale: SupportedLocale;
}

export interface StageData {
  batch: StageMovement[];
  pendingCount: number;
  expenseCategories: Category[];
  incomeCategories: Category[];
  usedExpenseCategories: Category[];
  usedIncomeCategories: Category[];
}

export function readStageData(db: AppDatabase, params: StageDataParams): StageData {
  const batch = listPendingBatch(db, { limit: STAGE_BATCH_SIZE });
  const pendingCount = countUncategorized(db);
  const expenseCategories = listCategories(db, { income: 0, locale: params.locale });
  const incomeCategories = listCategories(db, { income: 1, locale: params.locale });
  const usedExpenseCategories = listMostUsedCategories(db, {
    income: 0,
    limit: MAX_CATEGORY_CHIPS,
    locale: params.locale,
  });
  const usedIncomeCategories = listMostUsedCategories(db, {
    income: 1,
    limit: MAX_CATEGORY_CHIPS,
    locale: params.locale,
  });

  return { batch, pendingCount, expenseCategories, incomeCategories, usedExpenseCategories, usedIncomeCategories };
}
