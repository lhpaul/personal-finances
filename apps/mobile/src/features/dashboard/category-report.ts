import { apportionTenths } from '@finanzas/shared-domain';

import type { Category, DirectionCategoryTotal } from '../../db/types';
import { resolveDonutColorIndex } from './dashboard-palette';

/** The donut draws the top five buckets by included total; the remainder is left as visible
 * track (implementation plan Decision 6, Assumption A10). */
export const DASHBOARD_DONUT_SEGMENT_LIMIT = 5;

/** Not a real category id — the key `apportionTenths` sees for the "Sin categorizar" bucket
 * (mirrors `home`'s `summary.ts` `UNCATEGORIZED_KEY`). Never written to, or read from, the
 * database. */
const UNCATEGORIZED_KEY = '__uncategorized__';

export interface DonutSegmentReport {
  key: string;
  label: string;
  emoji: string;
  /** Tenths of a percent, from `apportionTenths` over **every** bucket of this direction — not
   * only the ones displayed (Decision 6). */
  tenths: number;
  /** An index into `theme.chart.series` (Decision 7) — resolved to an actual colour at the
   * render site, never here (this module never imports `theme`'s colour tables). */
  colorIndex: number;
  amount: number;
}

export interface DonutReport {
  /** The direction's total across **every** bucket, not only the displayed top
   * `DASHBOARD_DONUT_SEGMENT_LIMIT` — this is what the card's total line shows. */
  total: number;
  /** Capped at `DASHBOARD_DONUT_SEGMENT_LIMIT`, sorted by total descending with the
   * uncategorized bucket last among equals. Both the `DonutChart` arcs and the `Legend` rows
   * render from this same array, so they cannot disagree (Decision 6, Scenario 11). */
  segments: DonutSegmentReport[];
}

/** Injected labels for the "Sin categorizar" bucket — resolved by the caller (`t()` for the
 * label, `theme.categoryIcons.uncategorized` for the emoji) so this module stays free of any
 * React or i18n import, matching every other file in `src/features/dashboard/`. */
export interface UncategorizedDisplay {
  label: string;
  emoji: string;
}

/**
 * The expense donut, the income donut, and both directions' legends (implementation plan
 * Decision 6, Decision 7, Decision 8, brief AC2). Filters `totals` to `direction`, apportions
 * over **every** bucket of that direction via `apportionTenths` (the "sum to 100" half of AC2),
 * sorts by total descending with the uncategorized bucket last among equals, then takes the top
 * `DASHBOARD_DONUT_SEGMENT_LIMIT` and attaches its label, emoji and palette rank. Pure — no
 * React, no SQL, no percentage formatting.
 */
export function buildDonutReport(
  totals: readonly DirectionCategoryTotal[],
  direction: 'debit' | 'credit',
  categories: readonly Category[],
  uncategorized: UncategorizedDisplay,
): DonutReport {
  const buckets = totals.filter((row) => row.type === direction);
  const total = buckets.reduce((sum, row) => sum + row.total, 0);

  const tenthsByKey = apportionTenths(
    buckets.map((row) => ({
      key: row.transactionCategoryId ?? UNCATEGORIZED_KEY,
      weight: row.total,
    })),
  );

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const sorted = [...buckets].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.transactionCategoryId === null) return 1; // uncategorized sorts last among equals
    if (b.transactionCategoryId === null) return -1;
    return 0;
  });

  const segments = sorted.slice(0, DASHBOARD_DONUT_SEGMENT_LIMIT).map((row, rank) => {
    const key = row.transactionCategoryId ?? UNCATEGORIZED_KEY;
    const category = row.transactionCategoryId === null ? undefined : categoryById.get(row.transactionCategoryId);
    return {
      key,
      label: category?.name ?? uncategorized.label,
      emoji: category?.emoji ?? uncategorized.emoji,
      tenths: tenthsByKey.get(key) ?? 0,
      colorIndex: resolveDonutColorIndex(direction, rank),
      amount: row.total,
    };
  });

  return { total, segments };
}
