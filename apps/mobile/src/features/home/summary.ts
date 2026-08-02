import { apportionTenths } from '@finanzas/shared-domain';

import type { DirectionCategoryTotal } from '../../db/types';
import { theme } from '../../theme';

/** Not a real category id — the key `apportionTenths` sees for the "Sin categorizar" bucket
 * (implementation plan Decision 3). Never written to, or read from, the database. */
const UNCATEGORIZED_KEY = '__uncategorized__';

export interface FinancialSummary {
  incomeTotal: number;
  incomeMovementCount: number;
  expenseTotal: number;
  expenseMovementCount: number;
  /** `incomeTotal - expenseTotal`. Can be negative. */
  balance: number;
}

/**
 * `home`'s two stat tiles and its balance line (implementation plan Decision 1). Pure; every
 * input total already comes from SQL through the shared fragments — this function states no
 * inclusion rule of its own.
 */
export function buildFinancialSummary(
  categoryTotals: readonly DirectionCategoryTotal[],
): FinancialSummary {
  let incomeTotal = 0;
  let incomeMovementCount = 0;
  let expenseTotal = 0;
  let expenseMovementCount = 0;

  for (const row of categoryTotals) {
    if (row.type === 'credit') {
      incomeTotal += row.total;
      incomeMovementCount += row.movementCount;
    } else {
      expenseTotal += row.total;
      expenseMovementCount += row.movementCount;
    }
  }

  return {
    incomeTotal,
    incomeMovementCount,
    expenseTotal,
    expenseMovementCount,
    balance: incomeTotal - expenseTotal,
  };
}

export interface CategoryBucket {
  /** `null` is the "Sin categorizar" bucket — the caller resolves its display name/emoji through
   * i18n, not this pure module (Decision 3, no React/i18n here). */
  transactionCategoryId: string | null;
  total: number;
  movementCount: number;
  /** Integer tenths of a percent, from `@finanzas/shared-domain`'s `apportionTenths` — every
   * bucket's share, not only the ones the card displays (Decision 3). */
  percentTenths: number;
  /** 0-1, relative to the largest bucket in this list. */
  ratio: number;
  fillColor: string;
}

/**
 * "Análisis por categorías" (implementation plan Decision 1, Decision 3, Assumption A6). Returns
 * **every** expense bucket, sorted by total descending with the "Sin categorizar" bucket last
 * among equal totals — the caller slices the top `HOME_CATEGORY_ROW_LIMIT` for display and uses
 * the full length for the subtitle ("N categorías"), per Assumption A5.
 *
 * Apportionment runs over every bucket returned here, not only the ones later displayed —
 * otherwise the percentages would be shares of a truncated total (Decision 3).
 */
export function buildCategoryBreakdown(
  categoryTotals: readonly DirectionCategoryTotal[],
): CategoryBucket[] {
  const expenseRows = categoryTotals.filter((row) => row.type === 'debit');

  const tenths = apportionTenths(
    expenseRows.map((row) => ({
      key: row.transactionCategoryId ?? UNCATEGORIZED_KEY,
      weight: row.total,
    })),
  );

  const sorted = [...expenseRows].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.transactionCategoryId === null) return 1; // uncategorized sorts last among equals
    if (b.transactionCategoryId === null) return -1;
    return 0;
  });

  const largestTotal = sorted[0]?.total ?? 0;

  return sorted.map((row, index) => {
    const key = row.transactionCategoryId ?? UNCATEGORIZED_KEY;
    return {
      transactionCategoryId: row.transactionCategoryId,
      total: row.total,
      movementCount: row.movementCount,
      percentTenths: tenths.get(key) ?? 0,
      ratio: largestTotal > 0 ? row.total / largestTotal : 0,
      fillColor:
        row.transactionCategoryId === null
          ? theme.colors.palette.slate['300']
          : (theme.chart.series[index % theme.chart.series.length] as string),
    };
  });
}
