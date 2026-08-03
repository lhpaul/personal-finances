/**
 * Screen-level constants for `home` (implementation plan for issue #12, Assumptions A5, A8).
 * Extracted so both `read-home-data.ts` (which calls `listRecentMovements` with a bound) and
 * `summary.ts` (which slices the top categories after apportionment) share one number each,
 * rather than a literal repeated at two call sites.
 */

/** "Transacciones recientes" shows the 3 most recent movements (Assumption A8). */
export const HOME_RECENT_MOVEMENT_LIMIT = 3;

/** "Análisis por categorías" lists the top 4 buckets by included total; the subtitle still
 * counts every bucket (Assumption A5). */
export const HOME_CATEGORY_ROW_LIMIT = 4;
